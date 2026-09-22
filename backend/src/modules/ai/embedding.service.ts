import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  DomainError,
  ServiceUnavailableError,
} from '../../common/errors/domain-error';
import { voyageContextualEmbed, voyageEmbed } from './providers/voyage.client';
import { UserSettingsService } from './user-settings.service';

/**
 * The app embeds with Voyage AI (https://docs.voyageai.com) instead of the
 * AI Gateway: a purpose-built embeddings vendor with a one-time 200M-token
 * free allowance per account. All supported models output 1024 dims, which
 * matches the pgvector column (see 0012_voyage-1024.sql), so the HNSW index
 * and the idempotency keys stay valid across an embedding-model switch.
 */
export const EMBEDDING_MODEL = 'voyage-4';
export const CONTEXTUAL_EMBEDDING_MODEL = 'voyage-context-4';
export const EMBEDDING_DIMENSIONS = 1024;

/**
 * A capability probe must fail fast: it runs during boot and when a key is
 * saved, and it never indexes anything.
 */
const CAPABILITY_PROBE_TIMEOUT_MS = 15_000;

/**
 * The embedding path. Contextualized chunk embeddings are the primary
 * document path: each Source's ordered chunks are embedded as one group, so
 * every chunk encodes its document context. The pre-contextual model is the
 * automatic fallback when the key or plan cannot use the contextual model;
 * documents and queries always share one embedding space.
 */
export interface EmbeddingConfig {
  contextualEnabled: boolean;
  contextualModel: string;
  fallbackModel: string;
}

export const EMBEDDING_CONFIG = 'EMBEDDING_CONFIG';

export const DEFAULT_EMBEDDING_CONFIG: EmbeddingConfig = {
  contextualEnabled: true,
  contextualModel: CONTEXTUAL_EMBEDDING_MODEL,
  fallbackModel: EMBEDDING_MODEL,
};

export function loadEmbeddingConfig(
  env: NodeJS.ProcessEnv = process.env,
): EmbeddingConfig {
  return {
    contextualEnabled: parseBoolean(env.EMBEDDING_CONTEXTUAL_ENABLED, true),
    contextualModel:
      env.EMBEDDING_CONTEXTUAL_MODEL?.trim() || CONTEXTUAL_EMBEDDING_MODEL,
    fallbackModel: EMBEDDING_MODEL,
  };
}

/**
 * The result of a document embedding call. `model` is the model that
 * actually produced the vectors, so indexing can record it for the
 * idempotency key.
 */
export interface DocumentEmbeddingResult {
  model: string;
  embeddings: number[][];
}

/**
 * Optional server-side fallback key (env/Docker convenience), mirroring
 * AI_GATEWAY_API_KEY: the stored settings key always wins.
 */
export function voyageApiKeyFromEnv(): string | null {
  const key = process.env.VOYAGE_API_KEY?.trim();
  return key ? key : null;
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly config: EmbeddingConfig;
  /**
   * Whether the contextual path is active. It starts from the configured
   * default and only a capability probe flips it, process-wide — never per
   * call. Documents and queries must share one embedding model, because
   * vectors from different models are not comparable.
   */
  private contextualActive: boolean;

  constructor(
    private readonly userSettingsService: UserSettingsService,
    @Optional()
    @Inject(EMBEDDING_CONFIG)
    config?: EmbeddingConfig,
  ) {
    this.config = config ?? loadEmbeddingConfig();
    this.contextualActive = this.config.contextualEnabled;
  }

  /** The effective Voyage key: stored settings key, else env fallback. */
  async getVoyageApiKey(): Promise<string | null> {
    return (
      (await this.userSettingsService.getVoyageApiKey()) ??
      voyageApiKeyFromEnv()
    );
  }

  /**
   * The model documents are embedded with. Queries must use the same model,
   * because vectors from different models are not comparable.
   */
  documentEmbeddingModel(): string {
    return this.contextualActive
      ? this.config.contextualModel
      : this.config.fallbackModel;
  }

  /** The model query embeddings are produced with. */
  queryEmbeddingModel(): string {
    return this.documentEmbeddingModel();
  }

  /**
   * Probes the contextual endpoint once, at boot and before the reindex-all
   * representation check. A capability failure — the key or plan cannot use
   * the model (HTTP 400/403) — flips the whole process to the fallback
   * model, so documents and queries stay in one space and the changed
   * representation key makes the reindex-all rebuild the corpus with it.
   * Transient failures (rate limit, outage, invalid key) keep the configured
   * path: they are not evidence the model is unavailable, and jobs retry.
   */
  async ensureContextualAvailability(apiKey: string): Promise<boolean> {
    if (!this.config.contextualEnabled) {
      this.contextualActive = false;
      return false;
    }

    try {
      await this.pingContextual(apiKey);
      this.contextualActive = true;
      return true;
    } catch (error) {
      if (isCapabilityError(error)) {
        this.contextualActive = false;
        this.logger.warn(
          `Contextual embeddings (${this.config.contextualModel}) are not available for this key; falling back to ${this.config.fallbackModel}. ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return false;
      }
      this.logger.warn(
        `Could not probe contextual embeddings; keeping ${this.config.contextualModel}. ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      this.contextualActive = true;
      return true;
    }
  }

  /**
   * Verifies a key for the settings save flow against the path the process
   * actually uses. A capability failure while the contextual path is active
   * flips the process to the fallback and verifies that path instead, so a
   * key without contextual access can still be stored; the boot
   * representation check reconciles the corpus on the next start.
   */
  async verifyApiKey(apiKey: string): Promise<void> {
    if (!this.contextualActive) {
      await this.pingStandard(apiKey);
      return;
    }

    try {
      await this.pingContextual(apiKey);
    } catch (error) {
      if (!isCapabilityError(error)) throw error;
      this.contextualActive = false;
      this.logger.warn(
        `Contextual embeddings (${this.config.contextualModel}) are not available for this key; falling back to ${this.config.fallbackModel}.`,
      );
      await this.pingStandard(apiKey);
    }
  }

  /**
   * Embeds one Source's ordered chunks as a group through the contextualized
   * chunk embedding endpoint, so each chunk's vector encodes its document
   * context. With the contextual path inactive, embeds each chunk
   * independently with the pre-contextual model.
   */
  async embedDocumentGroups(
    groups: string[][],
  ): Promise<DocumentEmbeddingResult> {
    const total = groups.reduce((sum, group) => sum + group.length, 0);
    if (total === 0) {
      return { model: this.documentEmbeddingModel(), embeddings: [] };
    }

    const apiKey = await this.requireApiKey();
    if (!this.contextualActive) {
      const embeddings = await this.embedDocuments(groups.flat());
      return { model: this.config.fallbackModel, embeddings };
    }

    const response = await voyageContextualEmbed({
      apiKey,
      model: this.config.contextualModel,
      groups,
      inputType: 'document',
    });
    return {
      model: this.config.contextualModel,
      embeddings: response.embeddings,
    };
  }

  /**
   * Legacy per-text document embedding. Retained as the documented fallback
   * path (`EMBEDDING_CONTEXTUAL_ENABLED=false`) and as the primitive the
   * contextual path degrades to.
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const apiKey = await this.requireApiKey();
    return voyageEmbed({
      apiKey,
      model: this.config.fallbackModel,
      input: texts,
      inputType: 'document',
    });
  }

  /**
   * Embeds a search query with the same model the documents use, so the
   * cosine search stays in one embedding space.
   */
  async embedQuery(text: string): Promise<number[]> {
    const apiKey = await this.requireApiKey();
    if (!this.contextualActive) {
      const embeddings = await voyageEmbed({
        apiKey,
        model: this.config.fallbackModel,
        input: [text],
        inputType: 'query',
      });
      return embeddings[0];
    }

    // A query is embedded as a single one-chunk group with input_type query.
    const response = await voyageContextualEmbed({
      apiKey,
      model: this.config.contextualModel,
      groups: [[text]],
      inputType: 'query',
    });
    return response.embeddings[0];
  }

  private async pingContextual(apiKey: string): Promise<void> {
    await voyageContextualEmbed({
      apiKey,
      model: this.config.contextualModel,
      groups: [['ping']],
      inputType: 'query',
      timeoutMs: CAPABILITY_PROBE_TIMEOUT_MS,
    });
  }

  private async pingStandard(apiKey: string): Promise<void> {
    await voyageEmbed({
      apiKey,
      model: this.config.fallbackModel,
      input: ['ping'],
      inputType: 'query',
      timeoutMs: CAPABILITY_PROBE_TIMEOUT_MS,
    });
  }

  private async requireApiKey(): Promise<string> {
    const apiKey = await this.getVoyageApiKey();
    if (!apiKey) {
      throw new ServiceUnavailableError(
        'Embedding model is not configured. Add your Voyage API key in Settings.',
        { messageKey: 'errors.ai.embedding.notConfigured' },
      );
    }
    return apiKey;
  }
}

/**
 * A capability error means the model cannot be used with this key or plan
 * (bad model name, no access), as opposed to a key, rate-limit, or outage
 * problem that the fallback would not fix either.
 */
function isCapabilityError(error: unknown): boolean {
  return (
    error instanceof DomainError &&
    (error.status === 400 || error.status === 403)
  );
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  return fallback;
}
