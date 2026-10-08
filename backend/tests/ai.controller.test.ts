import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceUnavailableError } from '../src/common/errors/domain-error';
import { AiController } from '../src/modules/ai/ai.controller';

const { mockGetCredits } = vi.hoisted(() => ({
  mockGetCredits: vi.fn(),
}));

vi.mock('@ai-sdk/gateway', () => ({
  createGateway: vi.fn(() => ({
    getCredits: mockGetCredits,
  })),
}));

function controller(model = 'voyage-context-4') {
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
      getVoyageApiKey: vi.fn().mockResolvedValue(null),
      documentEmbeddingModel: vi.fn().mockReturnValue(model),
    } as any,
  );
}

describe('AiController gateway', () => {
  const originalGatewayKey = process.env.AI_GATEWAY_API_KEY;

  beforeEach(() => {
    delete process.env.AI_GATEWAY_API_KEY;
  });

  afterEach(() => {
    if (originalGatewayKey !== undefined) {
      process.env.AI_GATEWAY_API_KEY = originalGatewayKey;
    } else {
      delete process.env.AI_GATEWAY_API_KEY;
    }
  });

  it('merges models with sync status on listModels', async () => {
    const result = await controller().listModels();
    expect(result).toMatchObject({
      models: [{ id: 'openai/gpt-5.6-sol' }],
      source: 'seed',
    });
  });

  it('refreshModels triggers model sync and snapshots', async () => {
    const c = controller();
    const result = await c.refreshModels();
    expect((c as any).modelSyncService.refreshModels).toHaveBeenCalledWith('manual');
    expect(result).toMatchObject({ ok: true });
  });

  it('getCredits throws 503 without AI_GATEWAY_API_KEY in environment', async () => {
    await expect(controller().getCredits()).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
  });

  it('getCredits returns the gateway balance when AI_GATEWAY_API_KEY is configured', async () => {
    process.env.AI_GATEWAY_API_KEY = 'ag_live_key';
    mockGetCredits.mockResolvedValue({ balance: '10', totalUsed: '5' });
    const c = controller();
    await expect(c.getCredits()).resolves.toEqual({
      balance: '10',
      totalUsed: '5',
    });
  });

  it('getConnectionStatus returns the snapshot from connectionService', async () => {
    const c = controller();
    await expect(c.getConnectionStatus()).resolves.toEqual({ ok: true });
  });
});

describe('AiController voyage (embedding) key', () => {
  it('reports hasKey plus the effective model and dimensions', async () => {
    const c = controller();
    (c as any).embeddingService.getVoyageApiKey.mockResolvedValue('voy_key');
    await expect(c.getEmbeddingConnection()).resolves.toEqual({
      hasKey: true,
      model: 'voyage-context-4',
      dimensions: 1024,
    });
  });

  it('reports the fallback model when the embedding path is the pre-contextual one', async () => {
    const c = controller('voyage-4');
    (c as any).embeddingService.getVoyageApiKey.mockResolvedValue('voy_key');
    await expect(c.getEmbeddingConnection()).resolves.toMatchObject({
      model: 'voyage-4',
    });
  });
});
