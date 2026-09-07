import { Injectable } from '@nestjs/common';
import { ServiceUnavailableError } from '../../common/errors/domain-error';
import { ModelSyncService } from './model-sync.service';
import {
  buildGatewayOptions,
  createGatewayProvider,
  SINGLE_USER_ID,
  type GatewayRequestOptions,
} from './providers/gateway.provider';
import { resolveModelId } from './providers/model-catalog';
import type { ProviderModel } from './providers/provider';
import { UserSettingsService } from './user-settings.service';

const HEALTH_TTL_MS = 60_000;

class TtlCache<T> {
  private value: T | null = null;
  private timestamp = 0;

  constructor(private readonly ttlMs: number) {}

  get(): T | null {
    if (this.value === null || Date.now() - this.timestamp > this.ttlMs)
      return null;
    return this.value;
  }

  set(value: T): void {
    this.value = value;
    this.timestamp = Date.now();
  }

  clear(): void {
    this.value = null;
    this.timestamp = 0;
  }

  getTimestamp(): number {
    return this.timestamp;
  }
}

interface GatewayHealth {
  ok: boolean;
  detail?: string;
  degraded?: boolean;
}

export interface GatewayKeyStatus {
  hasKey: boolean;
  checkedAt: string | null;
}

export interface ConnectionSnapshot {
  ok: boolean;
  detail?: string;
  degraded: boolean;
  degradedDetail?: string;
  models: ProviderModel[];
  checkedAt: string | null;
  gateway: GatewayKeyStatus;
}

function disconnectedSnapshot(detail: string): ConnectionSnapshot {
  return {
    ok: false,
    detail,
    degraded: false,
    degradedDetail: undefined,
    models: [],
    checkedAt: null,
    gateway: { hasKey: false, checkedAt: null },
  };
}

@Injectable()
export class ConnectionService {
  /** Single-user mode: one gateway health probe for the single gateway key. */
  private readonly healthCache = new TtlCache<GatewayHealth>(HEALTH_TTL_MS);

  constructor(
    private readonly userSettingsService: UserSettingsService,
    private readonly modelSyncService: ModelSyncService,
  ) {}

  private async checkHealth(
    apiKey: string,
    options: GatewayRequestOptions,
  ): Promise<GatewayHealth & { checkedAt: number }> {
    const cached = this.healthCache.get();
    if (cached)
      return { ...cached, checkedAt: this.healthCache.getTimestamp() };

    const health = await createGatewayProvider({
      apiKey,
      getModels: () => this.modelSyncService.getModels(),
      requestOptions: options,
    }).health();
    if (health.ok) this.healthCache.set(health);
    return { ...health, checkedAt: this.healthCache.getTimestamp() };
  }

  async requireConnected(modelId: string): Promise<void> {
    const resolved = resolveModelId(modelId);
    const catalog = this.modelSyncService.getModels();
    if (!catalog.some((model) => model.id === resolved)) {
      throw new ServiceUnavailableError(`Model ${modelId} is not supported.`);
    }
    const apiKey = await this.userSettingsService.getGatewayApiKey();
    if (!apiKey) {
      throw new ServiceUnavailableError(
        'AI Gateway is not connected. Add your AI Gateway key in Settings.',
      );
    }
    const health = await this.checkHealth(
      apiKey,
      buildGatewayOptions(SINGLE_USER_ID),
    );
    // Degraded (rate-limited, non-entitled, upstream blip) is NOT
    // disconnected: let the request through so it can retry, fall back,
    // or fail with a specific, user-facing error.
    if (!health.ok && !health.degraded)
      throw new ServiceUnavailableError(
        health.detail ?? 'AI Gateway connection failed',
      );
  }

  async snapshot(): Promise<ConnectionSnapshot> {
    const catalog = this.modelSyncService.getModels();
    const apiKey = await this.userSettingsService.getGatewayApiKey();
    if (!apiKey) {
      return disconnectedSnapshot(
        'No AI Gateway key configured. Add your key in Settings to use AI features.',
      );
    }

    const health = await this.checkHealth(
      apiKey,
      buildGatewayOptions(SINGLE_USER_ID),
    );
    const healthy = health.ok === true;
    const degraded = health.degraded === true && !healthy;
    // Degraded keeps the full catalog: auth is fine, the service is flaky,
    // and requests should still go through (retry/fallback/per-call errors).
    const models = healthy || degraded ? catalog : [];
    const checkedAt = new Date(health.checkedAt).toISOString();
    return {
      ok: healthy && models.length > 0,
      detail: healthy || degraded ? undefined : (health.detail ?? undefined),
      degraded,
      degradedDetail: degraded ? (health.detail ?? undefined) : undefined,
      models,
      checkedAt,
      gateway: { hasKey: true, checkedAt },
    };
  }

  invalidateCache(): void {
    this.healthCache.clear();
  }
}
