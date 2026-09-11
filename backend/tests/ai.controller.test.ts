import { describe, expect, it, vi } from 'vitest';
import {
  BadRequestError,
  ServiceUnavailableError,
  UnauthorizedError,
} from '../src/common/errors/domain-error';
import { AiController } from '../src/modules/ai/ai.controller';

const { mockGetCredits, mockGetAvailableModels, mockVoyageEmbed } =
  vi.hoisted(() => ({
    mockGetCredits: vi.fn(),
    mockGetAvailableModels: vi.fn(),
    mockVoyageEmbed: vi.fn(),
  }));

vi.mock('@ai-sdk/gateway', () => ({
  createGateway: vi.fn(() => ({
    getCredits: mockGetCredits,
    getAvailableModels: mockGetAvailableModels,
  })),
}));

vi.mock('../src/modules/ai/providers/voyage.client', () => ({
  voyageEmbed: mockVoyageEmbed,
}));

function controller() {
  return new AiController(
    {
      listModels: vi.fn().mockResolvedValue([{ id: 'openai/gpt-5.6-sol' }]),
    } as any,
    {
      snapshot: vi.fn().mockResolvedValue({ ok: true }),
      invalidateCache: vi.fn(),
    } as any,
    {
      refreshModels: vi.fn().mockResolvedValue([]),
      getStatus: vi.fn().mockReturnValue({ source: 'seed', count: 1 }),
    } as any,
    {
      getGatewayApiKey: vi.fn().mockResolvedValue(null),
      setGatewayApiKey: vi.fn().mockResolvedValue(undefined),
      removeGatewayApiKey: vi.fn().mockResolvedValue(undefined),
      getVoyageApiKey: vi.fn().mockResolvedValue(null),
      setVoyageApiKey: vi.fn().mockResolvedValue(undefined),
      removeVoyageApiKey: vi.fn().mockResolvedValue(undefined),
    } as any,
    {
      getVoyageApiKey: vi.fn().mockResolvedValue(null),
    } as any,
  );
}

describe('AiController gateway keys', () => {
  it('merges models with sync status on listModels', async () => {
    const result = await controller().listModels();
    expect(result).toMatchObject({
      models: [{ id: 'openai/gpt-5.6-sol' }],
      source: 'seed',
    });
  });

  it('refreshModels drives the sync with the user key then snapshots', async () => {
    const c = controller();
    (c as any).userSettingsService.getGatewayApiKey.mockResolvedValue(
      'ag_live_user',
    );
    const result = await c.refreshModels();
    expect((c as any).modelSyncService.refreshModels).toHaveBeenCalledWith(
      'manual',
      'ag_live_user',
    );
    expect(result).toMatchObject({ ok: true });
  });

  it('getCredits throws 503 without a user gateway key', async () => {
    await expect(controller().getCredits()).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
  });

  it('getCredits returns the gateway balance for the user key', async () => {
    const c = controller();
    (c as any).userSettingsService.getGatewayApiKey.mockResolvedValue(
      'ag_live_user',
    );
    mockGetCredits.mockResolvedValue({ balance: '10', totalUsed: '5' });
    await expect(c.getCredits()).resolves.toEqual({
      balance: '10',
      totalUsed: '5',
    });
  });

  it('saves a gateway key after verification', async () => {
    const c = controller();
    mockGetAvailableModels.mockResolvedValue({ models: [] });
    await c.updateSettings({ gatewayApiKey: 'ag_live_new' });
    expect(
      (c as any).userSettingsService.setGatewayApiKey,
    ).toHaveBeenCalledWith('ag_live_new');
    expect((c as any).modelSyncService.refreshModels).toHaveBeenCalledWith(
      'key-saved',
      'ag_live_new',
    );
  });

  it('rejects invalid gateway keys without storing them', async () => {
    const c = controller();
    mockGetAvailableModels.mockRejectedValue(
      Object.assign(new Error('Unauthorized'), {
        statusCode: 401,
        type: 'auth_error',
      }),
    );
    await expect(
      c.updateSettings({ gatewayApiKey: 'ag_live_bad' }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(
      (c as any).userSettingsService.setGatewayApiKey,
    ).not.toHaveBeenCalled();
  });

  it('removes the gateway key on null', async () => {
    const c = controller();
    await c.updateSettings({ gatewayApiKey: null });
    expect(
      (c as any).userSettingsService.removeGatewayApiKey,
    ).toHaveBeenCalledWith();
    expect((c as any).modelSyncService.refreshModels).toHaveBeenCalledWith(
      'key-removed',
    );
  });

  it('rejects the legacy per-provider payload with a migration message', async () => {
    const c = controller();
    await expect(
      c.updateSettings({ provider: 'openai', apiKey: 'sk-x' } as any),
    ).rejects.toThrow(BadRequestError);
    await expect(
      c.updateSettings({ provider: 'openai', apiKey: 'sk-x' } as any),
    ).rejects.toThrow(/Per-provider keys were removed/);
  });

  it('deleteSettings removes the gateway key', async () => {
    const c = controller();
    await c.deleteSettings();
    expect(
      (c as any).userSettingsService.removeGatewayApiKey,
    ).toHaveBeenCalledWith();
  });
});

describe('AiController voyage (embedding) key', () => {
  it('reports hasKey plus the configured model and dimensions', async () => {
    const c = controller();
    (c as any).embeddingService.getVoyageApiKey.mockResolvedValue('voy_key');
    await expect(c.getEmbeddingConnection()).resolves.toEqual({
      hasKey: true,
      model: 'voyage-4',
      dimensions: 1024,
    });
  });

  it('verifies then stores a voyage key', async () => {
    const c = controller();
    mockVoyageEmbed.mockResolvedValue([[0.1]]);
    (c as any).embeddingService.getVoyageApiKey.mockResolvedValue('voy_new');
    const result = await c.saveEmbeddingConnection({ voyageApiKey: 'voy_new' });
    expect(mockVoyageEmbed).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'voy_new', inputType: 'query' }),
    );
    expect(
      (c as any).userSettingsService.setVoyageApiKey,
    ).toHaveBeenCalledWith('voy_new');
    expect(result).toMatchObject({ hasKey: true, model: 'voyage-4' });
  });

  it('rejects a bad voyage key without storing it', async () => {
    const c = controller();
    mockVoyageEmbed.mockRejectedValue(new UnauthorizedError('rejected'));
    await expect(
      c.saveEmbeddingConnection({ voyageApiKey: 'voy_bad' }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(
      (c as any).userSettingsService.setVoyageApiKey,
    ).not.toHaveBeenCalled();
  });

  it('removes the voyage key', async () => {
    const c = controller();
    await c.deleteEmbeddingConnection();
    expect(
      (c as any).userSettingsService.removeVoyageApiKey,
    ).toHaveBeenCalledWith();
  });
});
