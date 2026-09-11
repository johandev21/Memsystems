import { Injectable } from '@nestjs/common';
import { ServiceUnavailableError } from '../../common/errors/domain-error';
import { voyageEmbed } from './providers/voyage.client';
import { UserSettingsService } from './user-settings.service';

/**
 * The app embeds with Voyage AI (https://docs.voyageai.com) instead of the
 * AI Gateway: a purpose-built embeddings vendor with a one-time 200M-token
 * free allowance per account. voyage-4 outputs 1024 dims by default, which
 * matches the pgvector column (see 0012_voyage-1024.sql). All voyage-4
 * models share one embedding space, so switching within the family needs
 * no re-index.
 */
export const EMBEDDING_MODEL = 'voyage-4';
export const EMBEDDING_DIMENSIONS = 1024;

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
  constructor(private readonly userSettingsService: UserSettingsService) {}

  /** The effective Voyage key: stored settings key, else env fallback. */
  async getVoyageApiKey(): Promise<string | null> {
    return (
      (await this.userSettingsService.getVoyageApiKey()) ??
      voyageApiKeyFromEnv()
    );
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

  /** Embeds a search query (Voyage `input_type: "query"`). */
  async embedQuery(text: string): Promise<number[]> {
    const apiKey = await this.requireApiKey();
    const embeddings = await voyageEmbed({
      apiKey,
      model: EMBEDDING_MODEL,
      input: [text],
      inputType: 'query',
    });
    return embeddings[0];
  }

  /** Embeds document chunks (Voyage `input_type: "document"`). */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const apiKey = await this.requireApiKey();
    return voyageEmbed({
      apiKey,
      model: EMBEDDING_MODEL,
      input: texts,
      inputType: 'document',
    });
  }
}
