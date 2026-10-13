import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  DomainError,
  ServiceUnavailableError,
} from '../../common/errors/domain-error';
import { parseBoolean } from './config-parsing';
import { voyageContextualEmbed, voyageEmbed } from './providers/voyage.client';

export const EMBEDDING_MODEL = 'voyage-4';
export const CONTEXTUAL_EMBEDDING_MODEL = 'voyage-context-4';
export const EMBEDDING_DIMENSIONS = 1024;

const CAPABILITY_PROBE_TIMEOUT_MS = 15_000;

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

export interface DocumentEmbeddingResult {
  model: string;
  embeddings: number[][];
}

export function voyageApiKeyFromEnv(): string | null {
  const key = process.env.VOYAGE_API_KEY?.trim();
  return key ? key : null;
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly config: EmbeddingConfig;
  private contextualActive: boolean;

  constructor(
    @Optional()
    @Inject(EMBEDDING_CONFIG)
    config?: EmbeddingConfig,
  ) {
    this.config = config ?? loadEmbeddingConfig();
    this.contextualActive = this.config.contextualEnabled;
  }

  getVoyageApiKey(): Promise<string | null> {
    return Promise.resolve(voyageApiKeyFromEnv());
  }

  documentEmbeddingModel(): string {
    return this.contextualActive
      ? this.config.contextualModel
      : this.config.fallbackModel;
  }

  queryEmbeddingModel(): string {
    return this.documentEmbeddingModel();
  }

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
        'Embedding model is not configured. Set VOYAGE_API_KEY in your environment.',
        { messageKey: 'errors.ai.embedding.notConfigured' },
      );
    }
    return apiKey;
  }
}

function isCapabilityError(error: unknown): boolean {
  return (
    error instanceof DomainError &&
    (error.status === 400 || error.status === 403)
  );
}
