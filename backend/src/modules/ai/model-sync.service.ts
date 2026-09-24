import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { createGateway } from '@ai-sdk/gateway';
import { gatewayServerKey } from './providers/gateway.provider';
import {
  buildCapabilityOverlay,
  buildChatCatalog,
  SEED_GATEWAY_MODELS,
  type GatewayPublicModel,
} from './providers/model-catalog';
import type { ProviderModel } from './providers/provider';
import { UserSettingsService } from './user-settings.service';

/** Refresh the gateway model catalog every 6 hours. */
const MODEL_SYNC_CRON = '0 */6 * * *';

/**
 * Public Gateway model list (`GET /v1/models`, no auth). It is the only
 * source of Model Capabilities — the SDK's `getAvailableModels()` zod schema
 * strips `tags` and `supported_parameters`. The AI SDK exposes no configured
 * base URL for this call, so the endpoint lives here as a named constant.
 */
export const GATEWAY_PUBLIC_MODELS_URL =
  'https://ai-gateway.vercel.sh/v1/models';

/** Bound the capability fetch so a hung gateway cannot stall the sync. */
const GATEWAY_PUBLIC_MODELS_TIMEOUT_MS = 10_000;

function isGatewayPublicModel(value: unknown): value is GatewayPublicModel {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { id?: unknown }).id === 'string'
  );
}

/**
 * Fetches the public model list. Never rejects: any failure (network, HTTP
 * status, malformed payload, timeout) returns `null`, which callers treat as
 * "capabilities not verified" and fail closed.
 */
async function fetchGatewayPublicModels(): Promise<
  GatewayPublicModel[] | null
> {
  try {
    const response = await fetch(GATEWAY_PUBLIC_MODELS_URL, {
      signal: AbortSignal.timeout(GATEWAY_PUBLIC_MODELS_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    const data = (payload as { data?: unknown })?.data;
    if (!Array.isArray(data)) return null;
    return data.filter(isGatewayPublicModel);
  } catch {
    return null;
  }
}

@Injectable()
export class ModelSyncService implements OnModuleInit {
  private readonly logger = new Logger(ModelSyncService.name);
  private models: ProviderModel[] = [...SEED_GATEWAY_MODELS];
  private source: 'gateway' | 'seed' = 'seed';
  private lastSyncAt: string | null = null;
  /**
   * True only when the Gateway public list was fetched successfully as part
   * of the current catalog state. Consumed by capability gates, which fail
   * closed when it is false.
   */
  private capabilitiesVerified = false;

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
      capabilitiesVerified: this.capabilitiesVerified,
    };
  }

  /**
   * Refresh the catalog. Key resolution order: an explicitly passed user key
   * (e.g. the manual refresh button), then the optional server key
   * (AI_GATEWAY_API_KEY), then the app-wide key stored in Settings. The stored
   * fallback lets startup/cron syncs reach the gateway without a server key.
   * Falls back to the seed catalog only when no key exists anywhere.
   *
   * Chat models, pricing and availability come from the SDK catalog. Model
   * Capabilities are merged in by id from the Gateway public REST list, fetched
   * alongside; the SDK list is account-scoped and carries no capability
   * fields. When that public fetch fails the catalog may still refresh from
   * the SDK, but every model gets no capability claims and
   * `capabilitiesVerified` is false, so capability gates fail closed.
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
      this.capabilitiesVerified = false;
      this.logger.warn(
        `AI gateway model sync skipped (${reason}): no gateway key available. Using seed catalog (${this.models.length} models).`,
      );
      return this.models;
    }
    try {
      const gateway = createGateway({ apiKey: key });
      const [{ models: entries }, publicModels] = await Promise.all([
        gateway.getAvailableModels(),
        fetchGatewayPublicModels(),
      ]);
      const capabilityOverlay = publicModels
        ? buildCapabilityOverlay(publicModels)
        : undefined;
      const next = buildChatCatalog(entries, capabilityOverlay);
      if (next.length === 0) {
        throw new Error('gateway returned no chat models');
      }
      this.models = next;
      this.source = 'gateway';
      this.lastSyncAt = new Date().toISOString();
      this.capabilitiesVerified = publicModels !== null;
      this.logger.log(
        `AI gateway model sync (${reason}): ${next.length} chat models from ${entries.length} gateway entries; capabilities ${
          publicModels
            ? `verified from ${publicModels.length} public models`
            : 'unavailable (fail closed)'
        }.`,
      );
    } catch (error) {
      this.capabilitiesVerified = false;
      this.logger.warn(
        `AI gateway model sync (${reason}) failed, keeping ${this.models.length} cached models (${this.source}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return this.models;
  }
}
