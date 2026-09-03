import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateText } from 'ai';
import { createGateway } from '@ai-sdk/gateway';
import {
  buildGatewayOptions,
  createGatewayProvider,
} from '../src/modules/ai/providers/gateway.provider';

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return { ...actual, generateText: vi.fn() };
});

const { mockGetAvailableModels } = vi.hoisted(() => ({
  mockGetAvailableModels: vi.fn(),
}));

vi.mock('@ai-sdk/gateway', () => ({
  createGateway: vi.fn(() => ({
    getAvailableModels: mockGetAvailableModels,
  })),
  gateway: vi.fn(() => ({})),
}));

const mockGenerateText = vi.mocked(generateText);
const mockCreateGateway = vi.mocked(createGateway);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('gateway provider health probe', () => {
  it('uses a quota-free metadata probe when a server key is present', async () => {
    mockGetAvailableModels.mockResolvedValue({ models: [] });
    const provider = createGatewayProvider({
      apiKey: 'gw-test',
      getModels: () => [],
    });

    await expect(provider.health()).resolves.toEqual({ ok: true });
    expect(mockCreateGateway).toHaveBeenCalledWith({ apiKey: 'gw-test' });
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('marks auth failures as disconnected, not degraded', async () => {
    mockGetAvailableModels.mockRejectedValue(
      Object.assign(new Error('Invalid API key'), {
        statusCode: 401,
        name: 'GatewayAuthenticationError',
      }),
    );
    const provider = createGatewayProvider({
      apiKey: 'gw-bad',
      getModels: () => [],
    });

    const health = await provider.health();
    expect(health.ok).toBe(false);
    expect(health.degraded).not.toBe(true);
  });

  it('marks rate limits as degraded instead of disconnected', async () => {
    mockGetAvailableModels.mockRejectedValue(
      Object.assign(new Error('requests are rate-limited'), {
        statusCode: 429,
        name: 'GatewayRateLimitError',
        isRetryable: true,
      }),
    );
    const provider = createGatewayProvider({
      apiKey: 'gw-test',
      getModels: () => [],
    });

    const health = await provider.health();
    expect(health).toMatchObject({ ok: false, degraded: true });
  });

  it('falls back to an inference probe for BYOK-only setups', async () => {
    mockGenerateText.mockResolvedValue({ text: 'OK' } as any);
    const provider = createGatewayProvider({ getModels: () => [] });

    await expect(provider.health()).resolves.toEqual({ ok: true });
    expect(mockGenerateText).toHaveBeenCalled();
  });
});

describe('buildGatewayOptions', () => {
  it('attaches user attribution for spend tracking', () => {
    expect(buildGatewayOptions('user-1')).toEqual({
      providerOptions: {
        gateway: { user: 'user-1' },
      },
    });
  });

  it('attaches a server-side fallback model chain when provided', () => {
    expect(buildGatewayOptions('user-1', ['openai/gpt-4o-mini'])).toEqual({
      providerOptions: {
        gateway: { user: 'user-1', models: ['openai/gpt-4o-mini'] },
      },
    });
  });

  it('builds an empty bag without user or fallbacks', () => {
    expect(buildGatewayOptions()).toEqual({ providerOptions: { gateway: {} } });
  });
});
