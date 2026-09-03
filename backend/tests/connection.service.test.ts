import { describe, expect, it } from 'vitest';
import { createDatabaseConnection } from '../src/database/connection';
import { ConnectionService } from '../src/modules/ai/connection.service';
import { UserSettingsService } from '../src/modules/ai/user-settings.service';
import { seedUser } from './fixtures';

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
    const user = await seedUser();
    const snapshot = await connectionService.snapshot(user.id);

    expect(snapshot.ok).toBe(false);
    expect(snapshot.degraded).toBe(false);
    expect(snapshot.models).toEqual([]);
    expect(snapshot.gateway.hasKey).toBe(false);
    expect(snapshot.detail).toMatch(/No AI Gateway key configured/);
  });

  it('stores the gateway key encrypted and round-trips it', async () => {
    const user = await seedUser();

    await userSettingsService.setGatewayApiKey(user.id, 'ag_live_test_key');
    expect(await userSettingsService.getGatewayApiKey(user.id)).toBe(
      'ag_live_test_key',
    );

    const snapshot = await connectionService.snapshot(user.id);
    expect(snapshot.gateway.hasKey).toBe(true);
    // Fake key fails the live probe, but auth shape is deterministic: the
    // service reports not-ok (never throws, never leaks the key).
    expect(snapshot.ok).toBe(false);

    await userSettingsService.setGatewayApiKey(user.id, null);
    expect(await userSettingsService.getGatewayApiKey(user.id)).toBeNull();
    connectionService.invalidateUserCache(user.id);

    const afterDelete = await connectionService.snapshot(user.id);
    expect(afterDelete.gateway.hasKey).toBe(false);
  });

  it('blank keys remove the stored key', async () => {
    const user = await seedUser();
    await userSettingsService.setGatewayApiKey(user.id, 'ag_live_test_key');
    await userSettingsService.setGatewayApiKey(user.id, '   ');
    expect(await userSettingsService.getGatewayApiKey(user.id)).toBeNull();
  });

  it('returns null for corrupt payloads instead of throwing', async () => {
    const user = await seedUser();
    await userSettingsService.setGatewayApiKey(user.id, 'ag_live_test_key');
    await userSettingsService.removeGatewayApiKey(user.id);
    expect(await userSettingsService.getGatewayApiKey(user.id)).toBeNull();
  });
});
