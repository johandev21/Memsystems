import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { createGateway } from '@ai-sdk/gateway';
import { gatewayServerKey } from './providers/gateway.provider';
import {
  buildChatCatalog,
  SEED_GATEWAY_MODELS,
} from './providers/model-catalog';
import type { ProviderModel } from './providers/provider';
import { UserSettingsService } from './user-settings.service';

/** Refresh the gateway model catalog every 6 hours. */
const MODEL_SYNC_CRON = '0 */6 * * *';

@Injectable()
export class ModelSyncService implements OnModuleInit {
  private readonly logger = new Logger(ModelSyncService.name);
  private models: ProviderModel[] = [...SEED_GATEWAY_MODELS];
  private source: 'gateway' | 'seed' = 'seed';
  private lastSyncAt: string | null = null;

  constructor(private readonly userSettingsService: UserSettingsService) {}

  onModuleInit() {
    // Fire-and-forget: the seed catalog serves requests until the first
    // successful sync. refreshModels() never rejects.
    void this.refreshModels('startup');
  }

  @Cron(MODEL_SYNC_CRON)
  async handleCronRefresh() {
    await this.refreshModels('cron');
  }

  getModels(): ProviderModel[] {
    return this.models;
  }

  getStatus() {
    return {
      source: this.source,
      count: this.models.length,
      lastSyncAt: this.lastSyncAt,
    };
  }

  /**
   * Refresh the catalog. Key resolution order: an explicitly passed user key
   * (e.g. the manual refresh button), then the optional server key
   * (AI_GATEWAY_API_KEY), then the app-wide key stored in Settings. The stored
   * fallback lets startup/cron syncs reach the gateway without a server key.
   * Falls back to the seed catalog only when no key exists anywhere.
   *
   * This intentionally does not probe model capabilities with inference.
   * Tool-call probes spend user quota, add one request per model every six
   * hours, and can misclassify support during rate limits/provider outages.
   * Metadata refresh stays quota-free: buildChatCatalog() maps each gateway
   * entry through toProviderModel(), which merges curated regex capabilities
   * with any gateway metadata capability fields when present (see
   * capabilitiesFromGatewayEntry — currently a no-op because the gateway
   * returns no capability flags) and persists the result on
   * ProviderModel.capabilities. structuredOutput stays fail-closed (`false`
   * for unlisted families) as a UI/logging hint only — stream-handler.ts
   * attempts native Output.object first for every model regardless of the
   * flag and falls back to strict JSON prompting on native failure.
   */
  async refreshModels(
    reason = 'manual',
    apiKey?: string | null,
  ): Promise<ProviderModel[]> {
    const key =
      apiKey ??
      gatewayServerKey() ??
      (await this.userSettingsService.getGatewayApiKey());
    if (!key) {
      if (this.source !== 'seed' || this.models.length === 0) {
        this.models = [...SEED_GATEWAY_MODELS];
        this.source = 'seed';
      }
      this.logger.warn(
        `AI gateway model sync skipped (${reason}): no gateway key available. Using seed catalog (${this.models.length} models).`,
      );
      return this.models;
    }
    try {
      const gateway = createGateway({ apiKey: key });
      const { models: entries } = await gateway.getAvailableModels();
      const next = buildChatCatalog(entries);
      if (next.length === 0) {
        throw new Error('gateway returned no chat models');
      }
      this.models = next;
      this.source = 'gateway';
      this.lastSyncAt = new Date().toISOString();
      this.logger.log(
        `AI gateway model sync (${reason}): ${next.length} chat models from ${entries.length} gateway entries.`,
      );
    } catch (error) {
      this.logger.warn(
        `AI gateway model sync (${reason}) failed, keeping ${this.models.length} cached models (${this.source}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return this.models;
  }
}
