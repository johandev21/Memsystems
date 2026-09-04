import { describe, expect, it, vi } from 'vitest';
import { generateText } from 'ai';
import { CapabilityUnsupportedError } from '../src/common/errors/domain-error';
import {
  AiService,
  parseSearchJson,
  reconcileSearchSources,
} from '../src/modules/ai/ai.service';

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return { ...actual, generateText: vi.fn() };
});

const mockGenerateText = vi.mocked(generateText);

describe('AiService.searchWeb', () => {
  it('names the selected model and a compatible fallback in capability guards', () => {
    const aiService = new AiService({} as any, {} as any, {} as any);
    const provider = {
      listModels: () => [
        {
          id: 'deepseek/deepseek-r1',
          displayName: 'DeepSeek R1',
          supportsWebSearch: false,
          capabilities: { imageInput: false },
        },
        {
          id: 'openai/gpt-4o-mini',
          displayName: 'GPT-4o Mini',
          supportsWebSearch: true,
          capabilities: { imageInput: true },
        },
      ],
    } as any;

    expect(() =>
      aiService.requireCapability(
        provider,
        'deepseek/deepseek-r1',
        'imageInput',
        'image attachments',
      ),
    ).toThrow(
      "DeepSeek R1 doesn't support image attachments. Switch to a model that supports image attachments",
    );
  });

  it('rejects models that do not support web search', async () => {
    const aiService = new AiService(
      {} as any,
      {
        requireConnected: vi.fn().mockResolvedValue(undefined),
      } as any,
      { getModels: () => [] } as any,
    );
    const provider = {
      id: 'openai',
      name: 'OpenAI',
      listModels: vi.fn().mockReturnValue([
        {
          id: 'deepseek/deepseek-r1',
          displayName: 'DeepSeek R1',
          supportsWebSearch: false,
        },
        {
          id: 'openai/gpt-4o-mini',
          displayName: 'GPT-4o Mini',
          supportsWebSearch: true,
        },
      ]),
      createModel: vi.fn(),
      supportsWebSearch: vi.fn().mockReturnValue(false),
      createWebSearchTool: vi.fn(),
      health: vi.fn(),
    };
    vi.spyOn(aiService, 'getProviderForModel').mockResolvedValue(provider);

    await expect(
      aiService.searchWeb('philosophy', 'deepseek/deepseek-r1', 'user-1'),
    ).rejects.toThrow(CapabilityUnsupportedError);
    await expect(
      aiService.searchWeb('philosophy', 'deepseek/deepseek-r1', 'user-1'),
    ).rejects.toThrow(
      /DeepSeek R1 doesn't support web search.*model that supports web search/,
    );
    expect(provider.createModel).not.toHaveBeenCalled();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('maps escaped tool-choice rejections to a capability domain error', async () => {
    const aiService = new AiService(
      {} as any,
      { requireConnected: vi.fn().mockResolvedValue(undefined) } as any,
      { getModels: () => [] } as any,
    );
    vi.spyOn(aiService, 'getProviderForModel').mockResolvedValue({
      createModel: vi.fn(() => ({})),
      supportsWebSearch: vi.fn().mockReturnValue(true),
      createWebSearchTool: vi.fn(() => ({})),
    } as any);
    mockGenerateText.mockRejectedValue(
      new Error(
        'Tool choice `web_search_preview` not found in `tools` parameter.',
      ),
    );

    const failure = await aiService
      .searchWeb('philosophy', 'mystery/model', 'user-1')
      .catch((error) => error);
    expect(failure?.status).toBe(400);
    expect(failure?.code).toBe('gateway_capability_unsupported');
    expect(failure?.message).toMatch(/doesn't support web search/i);
  });

  it('returns curated sources and captures the gateway generation id', async () => {
    const aiService = new AiService(
      {} as any,
      {
        requireConnected: vi.fn().mockResolvedValue(undefined),
      } as any,
      { getModels: () => [] } as any,
    );
    const provider = {
      id: 'gateway',
      name: 'AI Gateway',
      listModels: vi.fn(),
      createModel: vi.fn(() => ({})),
      supportsWebSearch: vi.fn().mockReturnValue(true),
      createWebSearchTool: vi.fn(() => ({})),
      health: vi.fn(),
    };
    vi.spyOn(aiService, 'getProviderForModel').mockResolvedValue(
      provider as any,
    );
    vi.spyOn(aiService, 'getGatewayRequestOptions').mockResolvedValue({
      providerOptions: { gateway: {} },
    });

    let capturedOptions: Record<string, unknown> = {};
    mockGenerateText.mockImplementation(async (options: any) => {
      capturedOptions = options;
      options.onLanguageModelCallEnd?.({
        providerMetadata: { gateway: { generationId: 'gen_search1' } },
      });
      return {
        text: JSON.stringify({
          summary: 'Good overviews.',
          sources: [
            {
              url: 'https://plato.stanford.edu/entries/epistemology/',
              title: 'Epistemology',
              description: 'In-depth entry.',
            },
          ],
        }),
        toolResults: [
          {
            toolName: 'web_search',
            output: {
              results: [
                {
                  title: 'Epistemology',
                  url: 'https://plato.stanford.edu/entries/epistemology/',
                },
              ],
            },
          },
        ],
        sources: [],
        finishReason: 'stop',
      } as any;
    });

    const result = await aiService.searchWeb(
      'epistemology',
      'openai/gpt-5.6-sol',
      'user-1',
    );

    expect(result.summary).toBe('Good overviews.');
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].url).toBe(
      'https://plato.stanford.edu/entries/epistemology/',
    );
    expect(capturedOptions.toolChoice).toBe('required');
  });

  it('maps gateway rate limits to a 429 domain error', async () => {
    const aiService = new AiService(
      {} as any,
      {
        requireConnected: vi.fn().mockResolvedValue(undefined),
      } as any,
      { getModels: () => [] } as any,
    );
    vi.spyOn(aiService, 'getProviderForModel').mockResolvedValue({
      createModel: vi.fn(() => ({})),
      supportsWebSearch: vi.fn().mockReturnValue(true),
      createWebSearchTool: vi.fn(() => ({})),
    } as any);
    vi.spyOn(aiService, 'getGatewayRequestOptions').mockResolvedValue({
      providerOptions: { gateway: {} },
    });
    mockGenerateText.mockRejectedValue(
      Object.assign(new Error('requests are rate-limited'), {
        name: 'GatewayRateLimitError',
        statusCode: 429,
      }),
    );

    const failure = await aiService
      .searchWeb('philosophy', 'openai/gpt-5.6-sol', 'user-1')
      .catch((error) => error);
    expect(failure?.status).toBe(429);
    expect(failure?.code).toBe('gateway_rate_limited');
  });

  it('maps gateway entitlement gaps to a 403 domain error', async () => {
    const aiService = new AiService(
      {} as any,
      {
        requireConnected: vi.fn().mockResolvedValue(undefined),
      } as any,
      { getModels: () => [] } as any,
    );
    vi.spyOn(aiService, 'getProviderForModel').mockResolvedValue({
      createModel: vi.fn(() => ({})),
      supportsWebSearch: vi.fn().mockReturnValue(true),
      createWebSearchTool: vi.fn(() => ({})),
    } as any);
    vi.spyOn(aiService, 'getGatewayRequestOptions').mockResolvedValue({
      providerOptions: { gateway: {} },
    });
    mockGenerateText.mockRejectedValue(
      Object.assign(new Error('Free tier users do not have access'), {
        name: 'GatewayForbiddenError',
        statusCode: 403,
      }),
    );

    const failure = await aiService
      .searchWeb('philosophy', 'openai/gpt-5.6-sol', 'user-1')
      .catch((error) => error);
    expect(failure?.status).toBe(403);
    expect(failure?.code).toBe('gateway_entitlement');
  });
});

describe('reconcileSearchSources', () => {
  const webSearchResult = {
    sources: [
      {
        sourceType: 'url',
        url: 'https://plato.stanford.edu/entries/epistemology/',
        title: 'Epistemology (Stanford Encyclopedia of Philosophy)',
      },
      {
        sourceType: 'url',
        url: 'https://en.wikipedia.org/wiki/Epistemology',
        title: 'Epistemology - Wikipedia',
      },
    ],
    toolResults: [
      {
        toolName: 'web_search',
        output: {
          action: { type: 'search', queries: ['epistemology'] },
          sources: [
            {
              type: 'url',
              url: 'https://plato.stanford.edu/entries/epistemology/',
            },
            { type: 'url', url: 'https://en.wikipedia.org/wiki/Epistemology' },
            { type: 'url', url: 'https://www.reddit.com/r/philosophy/' },
            { type: 'url', url: 'https://www.youtube.com/watch?v=abc' },
          ],
        },
      },
    ],
  };

  it('keeps only sources the model curated from real search results', () => {
    const parsed = parseSearchJson(
      JSON.stringify({
        summary: 'Good overviews of epistemology.',
        sources: [
          {
            url: 'https://plato.stanford.edu/entries/epistemology/',
            description: 'In-depth encyclopedia entry.',
          },
          {
            url: 'https://www.reddit.com/r/philosophy/',
            description: 'Forum thread.',
          },
        ],
      }),
    );
    const sources = reconcileSearchSources(webSearchResult, parsed);

    // Model curation is trusted: both real URLs are kept, even forum sources.
    expect(sources).toHaveLength(2);
    expect(sources[0].url).toBe(
      'https://plato.stanford.edu/entries/epistemology/',
    );
  });

  it('drops hallucinated URLs not present in real search output', () => {
    const parsed = parseSearchJson(
      JSON.stringify({
        summary: 'summary',
        sources: [
          {
            url: 'https://plato.stanford.edu/entries/epistemology/',
            description: 'Good.',
          },
          {
            url: 'https://totally-made-up.example.com/nope',
            description: 'Hallucinated.',
          },
        ],
      }),
    );
    const sources = reconcileSearchSources(webSearchResult, parsed);
    expect(sources).toHaveLength(1);
    expect(sources[0].url).toBe(
      'https://plato.stanford.edu/entries/epistemology/',
    );
  });

  it('uses citation title when available, model title otherwise', () => {
    const parsed = parseSearchJson(
      JSON.stringify({
        summary: 'summary',
        sources: [
          {
            url: 'https://en.wikipedia.org/wiki/Epistemology',
            title: 'Epistemology Wiki',
            description: 'Overview.',
          },
        ],
      }),
    );
    const sources = reconcileSearchSources(webSearchResult, parsed);
    expect(sources[0].title).toBe('Epistemology - Wikipedia');
  });

  it('falls back to real sources when the model emits no JSON', () => {
    const sources = reconcileSearchSources(webSearchResult, null);
    // No blocklist: all real sources survive, including forum/video results.
    expect(sources).toHaveLength(4);
    expect(sources.map((s) => s.url)).toEqual(
      expect.arrayContaining([
        'https://plato.stanford.edu/entries/epistemology/',
        'https://en.wikipedia.org/wiki/Epistemology',
      ]),
    );
  });

  it('extracts real URLs from gateway Perplexity tool output', () => {
    const perplexityResult = {
      sources: [],
      toolResults: [
        {
          toolName: 'web_search',
          output: {
            id: 'search-1',
            results: [
              {
                title: 'Epistemology (Stanford Encyclopedia of Philosophy)',
                url: 'https://plato.stanford.edu/entries/epistemology/',
                snippet: 'Epistemology is the study of knowledge.',
              },
              {
                title: 'Forum thread',
                url: 'https://www.reddit.com/r/philosophy/',
                snippet: 'Discussion.',
              },
            ],
          },
        },
      ],
    };
    const sources = reconcileSearchSources(perplexityResult, null);
    // No blocklist: both real results survive with tool titles.
    expect(sources).toHaveLength(2);
    expect(sources[0].url).toBe(
      'https://plato.stanford.edu/entries/epistemology/',
    );
    expect(sources[0].title).toBe(
      'Epistemology (Stanford Encyclopedia of Philosophy)',
    );
  });

  it('ignores gateway search error payloads without results', () => {
    const errorResult = {
      sources: [],
      toolResults: [
        {
          toolName: 'web_search',
          output: { error: 'timeout', message: 'Search timed out' },
        },
      ],
    };
    expect(reconcileSearchSources(errorResult, null)).toEqual([]);
  });
});
