import { Controller, Get, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { createGateway } from '@ai-sdk/gateway';
import { ServiceUnavailableError } from '../../common/errors/domain-error';
import { AiService } from './ai.service';
import { ConnectionService } from './connection.service';
import {
  EMBEDDING_DIMENSIONS,
  EmbeddingService,
} from './indexing/embedding.service';
import { ModelSyncService } from './model-sync.service';
import { gatewayServerKey } from './providers/gateway.provider';

@ApiTags('AI')
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly connectionService: ConnectionService,
    private readonly modelSyncService: ModelSyncService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  @Get('models')
  @ApiOperation({
    summary: 'List Models',
    description:
      'Lists the Model catalog reported by the Gateway, plus the sync status of the local catalog.',
  })
  @ApiOkResponse({
    description: 'Model catalog and sync status.',
    schema: {
      type: 'object',
      properties: {
        models: { type: 'array', items: { type: 'object' } },
        source: { type: 'string' },
        count: { type: 'integer' },
        lastSyncAt: { type: 'string', nullable: true },
        capabilitiesVerified: { type: 'boolean' },
      },
    },
  })
  async listModels() {
    const models = await this.aiService.listModels();
    return { models, ...this.modelSyncService.getStatus() };
  }

  @Post('models/refresh')
  @ApiOperation({
    summary: 'Refresh Models',
    description:
      'Re-reads the Model catalog from the Gateway and returns the Gateway connection snapshot.',
  })
  @ApiCreatedResponse({ description: 'Updated Gateway connection snapshot.' })
  async refreshModels() {
    await this.modelSyncService.refreshModels('manual');
    return this.connectionService.snapshot();
  }

  @Get('credits')
  @ApiOperation({
    summary: 'Get Gateway credits',
    description: 'Returns the Gateway credit balance and total usage.',
  })
  @ApiOkResponse({
    description: 'Gateway credit usage.',
    schema: {
      type: 'object',
      properties: {
        balance: { type: 'number' },
        totalUsed: { type: 'number' },
      },
    },
  })
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
  @ApiOperation({
    summary: 'Get Gateway connection',
    description:
      'Returns the current Gateway connection status and configured Model.',
  })
  @ApiOkResponse({ description: 'Gateway connection snapshot.' })
  async getConnectionStatus() {
    return this.connectionService.snapshot();
  }

  @Get('embedding-connection')
  @ApiOperation({
    summary: 'Get Embeddings Connection',
    description:
      'Returns whether the Voyage AI Embeddings Connection is configured, and which embedding Model it uses.',
  })
  @ApiOkResponse({
    description: 'Embeddings Connection status.',
    schema: {
      type: 'object',
      properties: {
        hasKey: { type: 'boolean' },
        model: { type: 'string' },
        dimensions: {
          type: 'integer',
          enum: [EMBEDDING_DIMENSIONS],
        },
      },
    },
  })
  async getEmbeddingConnection() {
    const hasKey = Boolean(await this.embeddingService.getVoyageApiKey());
    return {
      hasKey,
      model: this.embeddingService.documentEmbeddingModel(),
      dimensions: EMBEDDING_DIMENSIONS,
    };
  }
}
