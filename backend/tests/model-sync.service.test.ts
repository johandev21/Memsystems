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

function publicModel(
  id: string,
  tags: string[],
  supportedParameters: string[] = [],
) {
  return {
    id,
    name: `Name for ${id}`,
    type: 'language',
    tags,
    supported_parameters: supportedParameters,
  };
}

/** Stubs the global fetch with the Gateway public model list response. */
function mockPublicList(data: unknown[]) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data }),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function settingsStub(storedKey: string | null = null) {
  return {
    getGatewayApiKey: vi.fn().mockResolvedValue(storedKey),
  } as any;
}

describe('ModelSyncService', () => {
  const previousKey = process.env.AI_GATEWAY_API_KEY;

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    if (previousKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previousKey;
  });

  it('serves the seed catalog, unverified, before any sync', () => {
    const service = new ModelSyncService(settingsStub());
    expect(service.getModels()).toEqual(SEED_GATEWAY_MODELS);
    expect(service.getStatus()).toMatchObject({
      source: 'seed',
      count: SEED_GATEWAY_MODELS.length,
      lastSyncAt: null,
      capabilitiesVerified: false,
    });
  });

  it('falls back to the seed catalog without an API key', async () => {
    delete process.env.AI_GATEWAY_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const service = new ModelSyncService(settingsStub());
    const models = await service.refreshModels('test');
    expect(models).toEqual(SEED_GATEWAY_MODELS);
    expect(mockCreateGateway).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(service.getStatus()).toMatchObject({
      source: 'seed',
      capabilitiesVerified: false,
    });
  });

  it('syncs from the stored key when no server key exists', async () => {
    delete process.env.AI_GATEWAY_API_KEY;
    const getAvailableModels = vi.fn().mockResolvedValue({
      models: [entry('openai/gpt-5.6-sol', 'language')],
    });
    mockCreateGateway.mockReturnValue({ getAvailableModels });
    mockPublicList([
      publicModel('openai/gpt-5.6-sol', ['structured-output'], [
        'structured_outputs',
      ]),
    ]);

    const service = new ModelSyncService(settingsStub('stored-key'));
    const models = await service.refreshModels('startup');

    expect(mockCreateGateway).toHaveBeenCalledWith({ apiKey: 'stored-key' });
    expect(models.map((m) => m.id)).toEqual(['openai/gpt-5.6-sol']);
    expect(service.getStatus()).toMatchObject({
      source: 'gateway',
      capabilitiesVerified: true,
    });
  });

  it('merges capabilities from the public list by resolved model id', async () => {
    process.env.AI_GATEWAY_API_KEY = 'gw-test-key';
    const getAvailableModels = vi.fn().mockResolvedValue({
      models: [
        entry('openai/gpt-5.6-sol', 'language'),
        entry('openai/text-embedding-3-small', 'embedding'),
        entry('moonshotai/kimi-k3', 'language'),
      ],
    });
    mockCreateGateway.mockReturnValue({ getAvailableModels });
    mockPublicList([
      publicModel(
        'openai/gpt-5.6-sol',
        ['vision', 'file-input', 'tool-use', 'structured-output', 'reasoning'],
        ['tools', 'structured_outputs'],
      ),
      // Alias: the public id differs from the SDK catalog id.
      publicModel('kimi/kimi-k3', ['tool-use']),
      // A public model absent from the SDK catalog is simply unused.
      publicModel('acme/unlisted', ['structured-output']),
    ]);

    const service = new ModelSyncService(settingsStub());
    const models = await service.refreshModels('test');
    const byId = new Map(models.map((m) => [m.id, m]));

    expect(models.map((m) => m.id)).toEqual([
      'moonshotai/kimi-k3',
      'openai/gpt-5.6-sol',
    ]);
    expect(byId.get('openai/gpt-5.6-sol')?.capabilities).toEqual({
      imageInput: true,
      fileInput: true,
      audioInput: false,
      tools: true,
      structuredOutput: true,
      reasoning: true,
      webSearch: false,
    });
    expect(byId.get('openai/gpt-5.6-sol')?.supportsWebSearch).toBe(false);
    expect(byId.get('moonshotai/kimi-k3')?.capabilities).toMatchObject({
      tools: true,
      structuredOutput: false,
    });
    expect(service.getStatus()).toMatchObject({
      source: 'gateway',
      count: 2,
      capabilitiesVerified: true,
    });
    expect(service.getStatus().lastSyncAt).toBeTruthy();
    expect(service.getModels()).toBe(models);
  });

  it('refreshes the catalog with no claims when the public list fails', async () => {
    process.env.AI_GATEWAY_API_KEY = 'gw-test-key';
    const getAvailableModels = vi.fn().mockResolvedValue({
      models: [entry('openai/gpt-5.6-sol', 'language')],
    });
    mockCreateGateway.mockReturnValue({ getAvailableModels });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down')),
    );

    const service = new ModelSyncService(settingsStub());
    const models = await service.refreshModels('test');

    expect(models.map((m) => m.id)).toEqual(['openai/gpt-5.6-sol']);
    expect(models[0].capabilities).toBeUndefined();
    expect(models[0].supportsWebSearch).toBeUndefined();
    expect(service.getStatus()).toMatchObject({
      source: 'gateway',
      capabilitiesVerified: false,
    });
  });

  it('treats a malformed public list as unverified', async () => {
    process.env.AI_GATEWAY_API_KEY = 'gw-test-key';
    mockCreateGateway.mockReturnValue({
      getAvailableModels: vi.fn().mockResolvedValue({
        models: [entry('openai/gpt-5.6-sol', 'language')],
      }),
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'not-an-array' }),
      }),
    );

    const service = new ModelSyncService(settingsStub());
    const models = await service.refreshModels('test');

    expect(models[0].capabilities).toBeUndefined();
    expect(service.getStatus().capabilitiesVerified).toBe(false);
  });

  it('keeps the cached catalog when the gateway sync fails', async () => {
    process.env.AI_GATEWAY_API_KEY = 'gw-test-key';
    mockCreateGateway.mockReturnValue({
      getAvailableModels: vi.fn().mockRejectedValue(new Error('gateway down')),
    });
    mockPublicList([publicModel('openai/gpt-5.6-sol', ['structured-output'])]);

    const service = new ModelSyncService(settingsStub());
    const models = await service.refreshModels('test');

    expect(models).toEqual(SEED_GATEWAY_MODELS);
    expect(service.getStatus()).toMatchObject({
      source: 'seed',
      capabilitiesVerified: false,
    });
  });
});
