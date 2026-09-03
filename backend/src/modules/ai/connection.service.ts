import { Injectable } from '@nestjs/common';
import { ServiceUnavailableError } from '../../common/errors/domain-error';
import { ModelSyncService } from './model-sync.service';
import {
  buildGatewayOptions,
  createGatewayProvider,
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
  /** Gateway health probes are per user — every user has their own key. */
  private readonly userHealth = new Map<string, TtlCache<GatewayHealth>>();

  constructor(
    private readonly userSettingsService: UserSettingsService,
    private readonly modelSyncService: ModelSyncService,
  ) {}

  private async checkHealth(
    apiKey: string,
    options: GatewayRequestOptions,
    userId: string,
  ): Promise<GatewayHealth & { checkedAt: number }> {
    let cache = this.userHealth.get(userId);
    if (!cache) {
      cache = new TtlCache<GatewayHealth>(HEALTH_TTL_MS);
      this.userHealth.set(userId, cache);
    }
    const cached = cache.get();
    if (cached) return { ...cached, checkedAt: cache.getTimestamp() };

    const health = await createGatewayProvider({
      apiKey,
      getModels: () => this.modelSyncService.getModels(),
      requestOptions: options,
    }).health();
    if (health.ok) cache.set(health);
    return { ...health, checkedAt: cache.getTimestamp() };
  }

  async requireConnected(userId: string, modelId: string): Promise<void> {
    const resolved = resolveModelId(modelId);
    const catalog = this.modelSyncService.getModels();
    if (!catalog.some((model) => model.id === resolved)) {
      throw new ServiceUnavailableError(`Model ${modelId} is not supported.`);
    }
    const apiKey = await this.userSettingsService.getGatewayApiKey(userId);
    if (!apiKey) {
      throw new ServiceUnavailableError(
        'AI Gateway is not connected. Add your AI Gateway key in Settings.',
      );
    }
    const health = await this.checkHealth(
      apiKey,
      buildGatewayOptions(userId),
      userId,
    );
    // Degraded (rate-limited, non-entitled, upstream blip) is NOT
    // disconnected: let the request through so it can retry, fall back,
    // or fail with a specific, user-facing error.
    if (!health.ok && !health.degraded)
      throw new ServiceUnavailableError(
        health.detail ?? 'AI Gateway connection failed',
      );
  }

  async snapshot(userId?: string): Promise<ConnectionSnapshot> {
    const catalog = this.modelSyncService.getModels();
    if (!userId) {
      return disconnectedSnapshot('User context required.');
    }
    const apiKey = await this.userSettingsService.getGatewayApiKey(userId);
    if (!apiKey) {
      return disconnectedSnapshot(
        'No AI Gateway key configured. Add your key in Settings to use AI features.',
      );
    }

    const health = await this.checkHealth(
      apiKey,
      buildGatewayOptions(userId),
      userId,
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

  invalidateUserCache(userId: string): void {
    this.userHealth.delete(userId);
  }
}
