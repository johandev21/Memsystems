import { Injectable } from '@nestjs/common';
import { createGateway } from '@ai-sdk/gateway';
import { embed, embedMany, type EmbeddingModel } from 'ai';
import { ServiceUnavailableError } from '../../common/errors/domain-error';
import { GATEWAY_EMBEDDING_MODEL } from './providers/model-catalog';
import { SINGLE_USER_ID } from './providers/gateway.provider';
import { UserSettingsService } from './user-settings.service';

export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;

@Injectable()
export class EmbeddingService {
  constructor(private readonly userSettingsService: UserSettingsService) {}

  private async getEmbeddingModel(): Promise<{
    model: EmbeddingModel;
    userId: string;
  }> {
    // The global gateway key lives in the singleton app_settings row.
    const apiKey = await this.userSettingsService.getGatewayApiKey();
    if (!apiKey) {
      throw new ServiceUnavailableError(
        'Embedding model is not configured. Add your AI Gateway key in Settings.',
      );
    }
    const gateway = createGateway({ apiKey });
    return {
      model: gateway.embedding(GATEWAY_EMBEDDING_MODEL),
      userId: SINGLE_USER_ID,
    };
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const { model, userId: gatewayUser } = await this.getEmbeddingModel();
    const result = await embed({
      model,
      value: text,
      providerOptions: { gateway: { user: gatewayUser } },
    });
    return result.embedding;
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const { model, userId: gatewayUser } = await this.getEmbeddingModel();
    const result = await embedMany({
      model,
      values: texts,
      providerOptions: { gateway: { user: gatewayUser } },
    });
    return result.embeddings;
  }
}
