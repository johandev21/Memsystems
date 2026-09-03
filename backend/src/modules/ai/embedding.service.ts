import { Injectable } from '@nestjs/common';
import { createGateway } from '@ai-sdk/gateway';
import { embed, embedMany, type EmbeddingModel } from 'ai';
import { ServiceUnavailableError } from '../../common/errors/domain-error';
import { GATEWAY_EMBEDDING_MODEL } from './providers/model-catalog';
import { UserSettingsService } from './user-settings.service';

export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;

@Injectable()
export class EmbeddingService {
  constructor(private readonly userSettingsService: UserSettingsService) {}

  private async getEmbeddingModel(
    userId: string,
  ): Promise<{ model: EmbeddingModel; userId: string }> {
    const apiKey = await this.userSettingsService.getGatewayApiKey(userId);
    if (!apiKey) {
      throw new ServiceUnavailableError(
        'Embedding model is not configured. Add your AI Gateway key in Settings.',
      );
    }
    const gateway = createGateway({ apiKey });
    return {
      model: gateway.embedding(GATEWAY_EMBEDDING_MODEL),
      userId,
    };
  }

  async generateEmbedding(text: string, userId: string): Promise<number[]> {
    const { model, userId: gatewayUser } = await this.getEmbeddingModel(userId);
    const result = await embed({
      model,
      value: text,
      providerOptions: { gateway: { user: gatewayUser } },
    });
    return result.embedding;
  }

  async generateEmbeddings(
    texts: string[],
    userId: string,
  ): Promise<number[][]> {
    if (texts.length === 0) return [];
    const { model, userId: gatewayUser } = await this.getEmbeddingModel(userId);
    const result = await embedMany({
      model,
      values: texts,
      providerOptions: { gateway: { user: gatewayUser } },
    });
    return result.embeddings;
  }
}
