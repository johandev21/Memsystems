import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { z } from 'zod';
import { createGateway } from '@ai-sdk/gateway';
import {
  BadRequestError,
  EntitlementError,
  RateLimitedError,
  ServiceUnavailableError,
  UnauthorizedError,
} from '../../common/errors/domain-error';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AiService } from './ai.service';
import { ConnectionService } from './connection.service';
import { ModelSyncService } from './model-sync.service';
import { classifyGatewayError } from './providers/gateway-errors';
import { UserSettingsService } from './user-settings.service';

const updateSettingsSchema = z.object({
  gatewayApiKey: z.string().max(500).nullable().optional(),
  // Legacy per-provider payload — rejected with a migration message below.
  provider: z.string().optional(),
  apiKey: z.string().nullable().optional(),
  openaiApiKey: z.string().nullable().optional(),
});

const LEGACY_REMOVED_MESSAGE =
  'Per-provider keys were removed. Add your AI Gateway key in Settings.';

@Controller('ai')
@UseGuards(AuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly connectionService: ConnectionService,
    private readonly modelSyncService: ModelSyncService,
    private readonly userSettingsService: UserSettingsService,
  ) {}

  @Get('models')
  async listModels(@CurrentUser('id') userId: string) {
    const models = await this.aiService.listModels(userId);
    return { models, ...this.modelSyncService.getStatus() };
  }

  @Post('models/refresh')
  async refreshModels(@CurrentUser('id') userId: string) {
    // A user's own key can drive the shared metadata sync, so the catalog
    // stays fresh even without a server gateway key.
    const userKey = await this.userSettingsService.getGatewayApiKey(userId);
    await this.modelSyncService.refreshModels('manual', userKey);
    return this.connectionService.snapshot(userId);
  }

  @Get('credits')
  async getCredits(@CurrentUser('id') userId: string) {
    const apiKey = await this.userSettingsService.getGatewayApiKey(userId);
    if (!apiKey) {
      throw new ServiceUnavailableError(
        'Add your AI Gateway key in Settings to view credits.',
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
      );
    }
  }

  @Get('connection')
  async getConnectionStatus(@CurrentUser('id') userId: string) {
    return this.connectionService.snapshot(userId);
  }

  @Post('connection')
  @Post('connection/settings')
  @UsePipes(new ZodValidationPipe(updateSettingsSchema))
  async updateSettings(
    @CurrentUser('id') userId: string,
    @Body() body: z.infer<typeof updateSettingsSchema>,
  ) {
    if (
      body.provider !== undefined ||
      body.apiKey !== undefined ||
      body.openaiApiKey !== undefined
    ) {
      throw new BadRequestError(LEGACY_REMOVED_MESSAGE);
    }
    if (body.gatewayApiKey !== undefined) {
      if (body.gatewayApiKey == null || body.gatewayApiKey.trim() === '') {
        await this.userSettingsService.removeGatewayApiKey(userId);
      } else {
        await this.verifyGatewayKey(body.gatewayApiKey.trim());
        await this.userSettingsService.setGatewayApiKey(
          userId,
          body.gatewayApiKey,
        );
      }
      this.connectionService.invalidateUserCache(userId);
    }
    return this.connectionService.snapshot(userId);
  }

  @Delete('connection')
  @Delete('connection/settings')
  async deleteSettings(@CurrentUser('id') userId: string) {
    await this.userSettingsService.removeGatewayApiKey(userId);
    this.connectionService.invalidateUserCache(userId);
    return this.connectionService.snapshot(userId);
  }

  /**
   * Verify-then-store: a metadata call proves the key reaches the gateway
   * without spending inference quota. Failures map to user-facing errors so
   * the UI can explain what went wrong instead of storing a dead key.
   */
  private async verifyGatewayKey(apiKey: string): Promise<void> {
    try {
      await createGateway({ apiKey }).getAvailableModels();
    } catch (error) {
      const classified = classifyGatewayError(error);
      if (classified.kind === 'auth') {
        throw new UnauthorizedError(
          'That gateway key was rejected. Check the key and try again.',
        );
      }
      if (classified.kind === 'rate_limited') {
        throw new RateLimitedError(
          'The AI service is busy right now. Please retry in a moment.',
        );
      }
      if (classified.kind === 'entitlement') {
        throw new EntitlementError(
          'That gateway key has no model access on its plan.',
        );
      }
      throw new ServiceUnavailableError(
        classified.detail ?? 'Could not verify the gateway key.',
      );
    }
  }
}
