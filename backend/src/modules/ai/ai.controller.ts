import { Controller, Get, Post } from '@nestjs/common';
import { createGateway } from '@ai-sdk/gateway';
import { ServiceUnavailableError } from '../../common/errors/domain-error';
import { AiService } from './ai.service';
import { ConnectionService } from './connection.service';
import { EMBEDDING_DIMENSIONS, EmbeddingService } from './embedding.service';
import { ModelSyncService } from './model-sync.service';
import { gatewayServerKey } from './providers/gateway.provider';

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly connectionService: ConnectionService,
    private readonly modelSyncService: ModelSyncService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  @Get('models')
  async listModels() {
    const models = await this.aiService.listModels();
    return { models, ...this.modelSyncService.getStatus() };
  }

  @Post('models/refresh')
  async refreshModels() {
    await this.modelSyncService.refreshModels('manual');
    return this.connectionService.snapshot();
  }

  @Get('credits')
  async getCredits() {
    const apiKey = gatewayServerKey();
    if (!apiKey) {
      throw new ServiceUnavailableError(
        'Configure AI_GATEWAY_API_KEY in your environment to view credits.',
        { messageKey: 'errors.ai.gateway.creditsKeyMissing' },
      );
    }
    try {
      const credits = await createGateway({ apiKey }).getCredits();
      return { balance: credits.balance, totalUsed: credits.totalUsed };
    } catch (error) {
      throw new ServiceUnavailableError(
        error instanceof Error
          ? error.message
          : 'Could not load gateway credits.',
        { messageKey: 'errors.ai.gateway.creditsLoadFailed' },
      );
    }
  }

  @Get('connection')
  async getConnectionStatus() {
    return this.connectionService.snapshot();
  }

  @Get('embedding-connection')
  async getEmbeddingConnection() {
    const hasKey = Boolean(await this.embeddingService.getVoyageApiKey());
    return {
      hasKey,
      // The model indexing and retrieval actually use, which is the fallback
      // when the contextual path is disabled or the key cannot use it.
      model: this.embeddingService.documentEmbeddingModel(),
      dimensions: EMBEDDING_DIMENSIONS,
    };
  }
}
