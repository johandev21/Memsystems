import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConnectionService } from '../src/modules/ai/connection.service';

describe('ConnectionService Tests', () => {
  const originalKey = process.env.AI_GATEWAY_API_KEY;

  beforeEach(() => {
    delete process.env.AI_GATEWAY_API_KEY;
  });

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.AI_GATEWAY_API_KEY = originalKey;
    } else {
      delete process.env.AI_GATEWAY_API_KEY;
    }
  });

  const modelSyncService = {
    getModels: () => [],
    getStatus: () => ({ source: 'seed', count: 0, lastSyncAt: null }),
  };
  const connectionService = new ConnectionService(modelSyncService as any);

  it('snapshots as disconnected when no gateway key is configured in environment', async () => {
    const snapshot = await connectionService.snapshot();

    expect(snapshot.ok).toBe(false);
    expect(snapshot.degraded).toBe(false);
    expect(snapshot.models).toEqual([]);
    expect(snapshot.gateway.hasKey).toBe(false);
    expect(snapshot.detail).toMatch(/No AI Gateway key configured/);
  });

  it('reflects gateway key presence when AI_GATEWAY_API_KEY is set in environment', async () => {
    process.env.AI_GATEWAY_API_KEY = 'ag_live_test_key';
    const snapshot = await connectionService.snapshot();
    expect(snapshot.gateway.hasKey).toBe(true);
    // Fake key fails the live probe, but auth shape is deterministic: the
    // service reports not-ok (never throws, never leaks the key).
    expect(snapshot.ok).toBe(false);
  });
});
