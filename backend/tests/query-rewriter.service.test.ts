import { describe, expect, it, vi } from 'vitest';
import { AiService } from '../src/modules/ai/ai.service';
import { QueryRewriterService } from '../src/modules/ai/query-rewriter.service';
import {
  MAX_REWRITE_OUTPUT_TOKENS,
  REWRITE_INSTRUCTIONS,
} from '../src/modules/ai/query-understanding';

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
}));

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return { ...actual, generateText: mocks.generateText };
});

function service(provider: unknown) {
  const aiService = {
    getProviderIfConnected: vi.fn().mockResolvedValue(provider),
    getGatewayRequestOptions: vi.fn(() => ({
      providerOptions: { gateway: { user: 'single-user' } },
    })),
  };
  return new QueryRewriterService(aiService as unknown as AiService);
}

describe('QueryRewriterService', () => {
  it('returns null when the gateway is not connected', async () => {
    const rewriter = service(null);
    await expect(
      rewriter.rewrite({
        message: 'Give me a short summary of osmosis.',
        history: [],
        variants: 2,
        hypotheticalAnswer: false,
      }),
    ).resolves.toBeNull();
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it('asks the configured model with the history and returns the parsed query', async () => {
    const createModel = vi.fn((modelId: string) => ({ modelId }));
    mocks.generateText.mockResolvedValue({
      text: '{"query":"osmosis water membrane","variants":["water potential"],"hypotheticalAnswer":""}',
      usage: { inputTokens: 210, outputTokens: 24 },
    });

    const rewriter = service({ createModel });
    const result = await rewriter.rewrite({
      message: 'Can you expand on that in more detail?',
      history: [
        { role: 'user', content: 'What is osmosis across a membrane?' },
      ],
      variants: 1,
      hypotheticalAnswer: false,
    });

    expect(createModel).toHaveBeenCalledWith('openai/gpt-4o-mini');
    expect(mocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: REWRITE_INSTRUCTIONS,
        maxOutputTokens: MAX_REWRITE_OUTPUT_TOKENS,
        providerOptions: { gateway: { user: 'single-user' } },
        prompt: expect.stringContaining(
          'user: What is osmosis across a membrane?',
        ),
      }),
    );
    expect(result).toEqual({
      query: 'osmosis water membrane',
      variants: ['water potential'],
      hypotheticalAnswer: null,
      inputTokens: 210,
      outputTokens: 24,
    });
  });

  it('estimates token cost when the provider reports none', async () => {
    mocks.generateText.mockResolvedValue({
      text: '{"query":"osmosis","variants":[]}',
      usage: undefined,
    });

    const rewriter = service({ createModel: vi.fn() });
    const result = await rewriter.rewrite({
      message: 'osmosis?',
      history: [],
      variants: 0,
      hypotheticalAnswer: false,
    });

    expect(result?.inputTokens).toBeGreaterThan(0);
    expect(result?.outputTokens).toBeGreaterThan(0);
  });

  it('throws when the model reply has no usable query', async () => {
    mocks.generateText.mockResolvedValue({ text: 'I cannot help.', usage: {} });

    const rewriter = service({ createModel: vi.fn() });
    await expect(
      rewriter.rewrite({
        message: 'osmosis?',
        history: [],
        variants: 0,
        hypotheticalAnswer: false,
      }),
    ).rejects.toThrow('no usable query');
  });

  it('propagates provider failures so the stage can degrade', async () => {
    mocks.generateText.mockRejectedValue(new Error('gateway 503'));

    const rewriter = service({ createModel: vi.fn() });
    await expect(
      rewriter.rewrite({
        message: 'osmosis?',
        history: [],
        variants: 0,
        hypotheticalAnswer: false,
      }),
    ).rejects.toThrow('gateway 503');
  });
});
