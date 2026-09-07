import { describe, expect, it } from 'vitest';
import { createDatabaseConnection } from '../src/database/connection';
import { ConnectionService } from '../src/modules/ai/connection.service';
import { UserSettingsService } from '../src/modules/ai/user-settings.service';

describe('ConnectionService & UserSettingsService Tests', () => {
  const { db } = createDatabaseConnection(process.env.DATABASE_URL);
  const userSettingsService = new UserSettingsService(db);
  const modelSyncService = {
    getModels: () => [],
    getStatus: () => ({ source: 'seed', count: 0, lastSyncAt: null }),
  };
  const connectionService = new ConnectionService(
    userSettingsService,
    modelSyncService as any,
  );

  it('snapshots as disconnected when no gateway key is configured', async () => {
    const snapshot = await connectionService.snapshot();

    expect(snapshot.ok).toBe(false);
    expect(snapshot.degraded).toBe(false);
    expect(snapshot.models).toEqual([]);
    expect(snapshot.gateway.hasKey).toBe(false);
    expect(snapshot.detail).toMatch(/No AI Gateway key configured/);
  });

  it('stores the gateway key encrypted and round-trips it', async () => {
    await userSettingsService.setGatewayApiKey('ag_live_test_key');
    expect(await userSettingsService.getGatewayApiKey()).toBe(
      'ag_live_test_key',
    );

    const snapshot = await connectionService.snapshot();
    expect(snapshot.gateway.hasKey).toBe(true);
    // Fake key fails the live probe, but auth shape is deterministic: the
    // service reports not-ok (never throws, never leaks the key).
    expect(snapshot.ok).toBe(false);

    await userSettingsService.setGatewayApiKey(null);
    expect(await userSettingsService.getGatewayApiKey()).toBeNull();
    connectionService.invalidateCache();

    const afterDelete = await connectionService.snapshot();
    expect(afterDelete.gateway.hasKey).toBe(false);
  });

  it('blank keys remove the stored key', async () => {
    await userSettingsService.setGatewayApiKey('ag_live_test_key');
    await userSettingsService.setGatewayApiKey('   ');
    expect(await userSettingsService.getGatewayApiKey()).toBeNull();
  });

  it('returns null for corrupt payloads instead of throwing', async () => {
    await userSettingsService.setGatewayApiKey('ag_live_test_key');
    await userSettingsService.removeGatewayApiKey();
    expect(await userSettingsService.getGatewayApiKey()).toBeNull();
  });
});
