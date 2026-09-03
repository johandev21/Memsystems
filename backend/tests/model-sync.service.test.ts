import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModelSyncService } from '../src/modules/ai/model-sync.service';
import { SEED_GATEWAY_MODELS } from '../src/modules/ai/providers/model-catalog';

const { mockCreateGateway } = vi.hoisted(() => ({
  mockCreateGateway: vi.fn(),
}));

vi.mock('@ai-sdk/gateway', () => ({
  createGateway: mockCreateGateway,
}));

function entry(id: string, modelType?: string) {
  return {
    id,
    name: `Name for ${id}`,
    modelType,
    specification: {
      specificationVersion: 'v4',
      provider: 'gateway',
      modelId: id,
    },
  };
}

describe('ModelSyncService', () => {
  const previousKey = process.env.AI_GATEWAY_API_KEY;

  afterEach(() => {
    vi.clearAllMocks();
    if (previousKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previousKey;
  });

  it('serves the seed catalog before any sync', () => {
    const service = new ModelSyncService();
    expect(service.getModels()).toEqual(SEED_GATEWAY_MODELS);
    expect(service.getStatus()).toMatchObject({
      source: 'seed',
      count: SEED_GATEWAY_MODELS.length,
      lastSyncAt: null,
    });
  });

  it('falls back to the seed catalog without an API key', async () => {
    delete process.env.AI_GATEWAY_API_KEY;
    const service = new ModelSyncService();
    const models = await service.refreshModels('test');
    expect(models).toEqual(SEED_GATEWAY_MODELS);
    expect(mockCreateGateway).not.toHaveBeenCalled();
    expect(service.getStatus().source).toBe('seed');
  });

  it('builds the chat catalog from gateway metadata', async () => {
    process.env.AI_GATEWAY_API_KEY = 'gw-test-key';
    const getAvailableModels = vi.fn().mockResolvedValue({
      models: [
        entry('openai/gpt-5.6-sol', 'language'),
        entry('openai/text-embedding-3-small', 'embedding'),
        entry('moonshotai/kimi-k3', 'language'),
      ],
    });
    mockCreateGateway.mockReturnValue({ getAvailableModels });

    const service = new ModelSyncService();
    const models = await service.refreshModels('test');

    expect(mockCreateGateway).toHaveBeenCalledWith({ apiKey: 'gw-test-key' });
    expect(models.map((m) => m.id)).toEqual([
      'moonshotai/kimi-k3',
      'openai/gpt-5.6-sol',
    ]);
    expect(service.getStatus()).toMatchObject({
      source: 'gateway',
      count: 2,
    });
    expect(service.getStatus().lastSyncAt).toBeTruthy();
    expect(service.getModels()).toBe(models);
  });

  it('keeps the cached catalog when the gateway sync fails', async () => {
    process.env.AI_GATEWAY_API_KEY = 'gw-test-key';
    mockCreateGateway.mockReturnValue({
      getAvailableModels: vi.fn().mockRejectedValue(new Error('gateway down')),
    });

    const service = new ModelSyncService();
    const models = await service.refreshModels('test');

    expect(models).toEqual(SEED_GATEWAY_MODELS);
    expect(service.getStatus().source).toBe('seed');
  });
});
