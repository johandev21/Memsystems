import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_REWRITE_CONFIG,
  DEFAULT_REWRITE_MODEL,
  DEFAULT_REWRITE_TIMEOUT_MS,
  DEFAULT_REWRITE_VARIANT_COUNT,
  MAX_REWRITE_VARIANTS,
  QueryUnderstandingService,
  buildHeuristicRewrite,
  contentWords,
  decideRewrite,
  hasFollowUpReference,
  hasMetaInstructions,
  historyTopicTerms,
  isAmbiguousQuery,
  loadRetrievalRewriteConfig,
  parseRewriteResponse,
  passthroughUnderstanding,
  stripMetaInstructions,
  traceRewrite,
  type QueryRewriteRequest,
  type QueryRewriteResult,
  type QueryRewriter,
} from '../src/modules/ai/query-understanding';
import { MAX_TRACE_HYPOTHETICAL_CHARS } from '../src/modules/ai/retrieval-trace';

function rewriter(
  result: Awaited<ReturnType<QueryRewriter['rewrite']>> | (() => never),
): QueryRewriter & { calls: QueryRewriteRequest[] } {
  const calls: QueryRewriteRequest[] = [];
  const rewrite = vi.fn(
    async (
      request: QueryRewriteRequest,
    ): Promise<QueryRewriteResult | null> => {
      calls.push(request);
      if (typeof result === 'function') return result();
      return result;
    },
  );
  return { rewrite, calls };
}

const AT_MITOS: [{ role: 'user'; content: string }] = [
  { role: 'user', content: 'How do mitochondria generate ATP in a cell?' },
];

describe('query rewrite decision', () => {
  it('skips a single-shot factual question that already reads as a search query', () => {
    expect(
      decideRewrite('How do mitochondria generate ATP in a cell?', {
        enabled: true,
      }),
    ).toEqual({
      shouldRewrite: false,
      trigger: null,
      skipReason: 'search_ready',
    });
  });

  it('skips the existing golden-set questions', () => {
    const searchReady = [
      'What is osmosis across a selectively permeable membrane?',
      'How does a competitive inhibitor affect an enzyme?',
      'What does a p-value tell us about the null hypothesis?',
      'How should I interpret a 95 percent confidence interval?',
      'Explain the slope coefficient in simple linear regression.',
      'When was the Treaty of Versailles signed?',
      'When did Operation Barbarossa begin?',
      'Where did the D-Day landings take place?',
      'What is the grading policy for CS-3300?',
      'How do I bake sourdough bread with a starter culture?',
      'What is the Schrodinger equation for a hydrogen atom?',
    ];
    for (const message of searchReady) {
      expect(
        decideRewrite(message, { enabled: true }).shouldRewrite,
        message,
      ).toBe(false);
    }
  });

  it('rewrites a message that asks for a tone, length, or format', () => {
    expect(
      decideRewrite(
        'Give me a short chapter summary explaining osmosis across a selectively permeable membrane.',
        { enabled: true },
      ),
    ).toEqual({
      shouldRewrite: true,
      trigger: 'meta_instructions',
      skipReason: null,
    });
    expect(hasMetaInstructions('Answer in two sentences.')).toBe(true);
    expect(hasMetaInstructions('Explain it in Spanish please.')).toBe(true);
    expect(hasMetaInstructions('Keep it short and use bullet points.')).toBe(
      true,
    );
  });

  it('does not mistake subject phrases for format directives', () => {
    expect(
      hasMetaInstructions(
        'Explain the slope coefficient in simple linear regression.',
      ),
    ).toBe(false);
    expect(hasMetaInstructions('What is the grading policy for CS-3300?')).toBe(
      false,
    );
  });

  it('rewrites tone, narrative, and audience requests', () => {
    expect(
      decideRewrite('Explain osmosis across a membrane in a friendly tone.', {
        enabled: true,
      }),
    ).toEqual({
      shouldRewrite: true,
      trigger: 'meta_instructions',
      skipReason: null,
    });
    expect(
      hasMetaInstructions(
        'Explain osmosis across a membrane in a friendly tone.',
      ),
    ).toBe(true);
    expect(hasMetaInstructions('Tell me about the treaty as a story.')).toBe(
      true,
    );
    expect(hasMetaInstructions('Rewrite the summary in a formal voice.')).toBe(
      true,
    );
    expect(hasMetaInstructions('Explain photosynthesis for a beginner.')).toBe(
      true,
    );
    expect(hasMetaInstructions("Explain gravity like I'm five.")).toBe(true);
  });

  it('does not mistake a subject for a tone or audience directive', () => {
    expect(
      hasMetaInstructions('How does the academic peer review process work?'),
    ).toBe(false);
    expect(
      hasMetaInstructions('What is the role of the letter of credit?'),
    ).toBe(false);
    expect(hasMetaInstructions('How do children acquire language?')).toBe(
      false,
    );
  });

  it('rewrites a follow-up that needs the recent turns', () => {
    expect(hasFollowUpReference('Can you expand on that in more detail?')).toBe(
      true,
    );
    expect(hasFollowUpReference('What about the second type?')).toBe(true);
    expect(hasFollowUpReference('How do mitochondria generate ATP?')).toBe(
      false,
    );
    expect(
      decideRewrite('Can you expand on that in more detail?', {
        enabled: true,
      }),
    ).toEqual({
      shouldRewrite: true,
      trigger: 'follow_up',
      skipReason: null,
    });
  });

  it('rewrites a message too short to carry a subject', () => {
    expect(isAmbiguousQuery('osmosis?')).toBe(true);
    expect(decideRewrite('osmosis?', { enabled: true })).toEqual({
      shouldRewrite: true,
      trigger: 'ambiguous',
      skipReason: null,
    });
  });

  it('honors the disabled switch and empty messages', () => {
    expect(
      decideRewrite('Give me a short summary.', { enabled: false }),
    ).toEqual({ shouldRewrite: false, trigger: null, skipReason: 'disabled' });
    expect(decideRewrite('   ', { enabled: true })).toEqual({
      shouldRewrite: false,
      trigger: null,
      skipReason: 'empty_message',
    });
  });
});

describe('heuristic rewrite', () => {
  it('strips meta-instructions so they cannot dominate the query', () => {
    const rewritten = buildHeuristicRewrite(
      'Give me a short chapter summary explaining osmosis across a selectively permeable membrane.',
    );
    expect(rewritten).toBe('osmosis selectively permeable membrane');
    expect(rewritten).not.toMatch(/summary|chapter|short/i);
  });

  it('strips leading request boilerplate', () => {
    expect(stripMetaInstructions('Can you explain the derivative?')).toBe(
      'the derivative',
    );
  });

  it('strips tone and narrative directives from the query', () => {
    expect(
      buildHeuristicRewrite(
        'Explain osmosis across a membrane in a friendly tone.',
      ),
    ).toBe('osmosis membrane');
    expect(
      buildHeuristicRewrite('Explain the Treaty of Versailles as a story.'),
    ).toBe('treaty versailles');
    expect(
      buildHeuristicRewrite('Explain photosynthesis for a beginner.'),
    ).toBe('photosynthesis');
  });

  it('keeps the original message when stripping would leave nothing', () => {
    expect(stripMetaInstructions('Give me a short summary.')).toBe(
      'Give me a short summary.',
    );
  });

  it('resolves a follow-up from the most recent user turn', () => {
    expect(
      buildHeuristicRewrite('Can you expand on that in more detail?', AT_MITOS),
    ).toBe('mitochondria generate atp cell');
  });

  it('resolves from the last message when the history has no user turn', () => {
    expect(
      historyTopicTerms([
        {
          role: 'assistant',
          content: 'Osmosis moves water across a membrane.',
        },
      ]),
    ).toEqual(['osmosis', 'moves', 'water', 'membrane']);
  });

  it('does not append history terms to a query that stands on its own', () => {
    expect(
      buildHeuristicRewrite('What is osmosis across a membrane?', AT_MITOS),
    ).toBe('osmosis membrane');
  });
});

describe('parseRewriteResponse', () => {
  it('reads the query, variants, and hypothetical answer out of the JSON reply', () => {
    const parsed = parseRewriteResponse(
      'Sure:\n{"query":"osmosis water membrane","variants":["water potential gradient"],"hypotheticalAnswer":"Osmosis moves water."}',
      { variantCount: 2, hypotheticalAnswer: true },
    );
    expect(parsed).toEqual({
      query: 'osmosis water membrane',
      variants: ['water potential gradient'],
      hypotheticalAnswer: 'Osmosis moves water.',
    });
  });

  it('drops variants the model repeated and caps the list', () => {
    const parsed = parseRewriteResponse(
      JSON.stringify({
        query: 'base',
        variants: ['base', 'one', 'two', 'three'],
      }),
      { variantCount: 2, hypotheticalAnswer: false },
    );
    expect(parsed?.variants).toEqual(['one', 'two']);
  });

  it('never returns a hypothetical answer that was not requested', () => {
    const parsed = parseRewriteResponse(
      JSON.stringify({ query: 'base', hypotheticalAnswer: 'answer' }),
      { variantCount: 0, hypotheticalAnswer: false },
    );
    expect(parsed?.hypotheticalAnswer).toBeNull();
  });

  it('rejects replies without a usable query', () => {
    expect(
      parseRewriteResponse('no json here', {
        variantCount: 2,
        hypotheticalAnswer: false,
      }),
    ).toBeNull();
    expect(
      parseRewriteResponse('{"variants":["x"]}', {
        variantCount: 2,
        hypotheticalAnswer: false,
      }),
    ).toBeNull();
    expect(
      parseRewriteResponse('{"query":"   "}', {
        variantCount: 2,
        hypotheticalAnswer: false,
      }),
    ).toBeNull();
  });
});

describe('QueryUnderstandingService', () => {
  const config = { ...DEFAULT_REWRITE_CONFIG };

  it('does not call the rewrite model when the message is search-ready', async () => {
    const model = rewriter({
      query: 'should not run',
      variants: [],
      hypotheticalAnswer: null,
      inputTokens: 1,
      outputTokens: 1,
    });
    const service = new QueryUnderstandingService(config, model);

    const understanding = await service.understand({
      message: 'How do mitochondria generate ATP in a cell?',
    });

    expect(model.rewrite).not.toHaveBeenCalled();
    expect(understanding).toMatchObject({
      queries: ['How do mitochondria generate ATP in a cell?'],
      strategy: null,
      reason: 'search_ready',
      trigger: null,
      model: DEFAULT_REWRITE_MODEL,
    });
  });

  it('runs the rewritten query when the model rewrites a meta-instruction message', async () => {
    const model = rewriter({
      query: 'mitochondria atp oxidative phosphorylation',
      variants: ['cellular respiration energy'],
      hypotheticalAnswer: null,
      inputTokens: 120,
      outputTokens: 18,
    });
    const service = new QueryUnderstandingService(config, model);

    const understanding = await service.understand({
      message: 'Give me a short summary of the cell powerhouse.',
      history: AT_MITOS,
    });

    expect(model.rewrite).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Give me a short summary of the cell powerhouse.',
        history: AT_MITOS,
        // Paraphrases are only requested for short or ambiguous messages.
        variantCount: 0,
        hypotheticalAnswer: false,
      }),
    );
    expect(understanding).toMatchObject({
      queries: ['mitochondria atp oxidative phosphorylation'],
      strategy: 'model',
      reason: null,
      trigger: 'meta_instructions',
      inputTokens: 120,
      outputTokens: 18,
    });
  });

  it('requests and fuses paraphrases for a short or ambiguous message', async () => {
    const model = rewriter({
      query: 'mitochondria atp',
      variants: ['cell energy mitochondria', 'oxidative phosphorylation'],
      hypotheticalAnswer: null,
      inputTokens: 80,
      outputTokens: 20,
    });
    const service = new QueryUnderstandingService(config, model);

    const understanding = await service.understand({
      message: 'the powerhouse?',
    });

    expect(model.rewrite).toHaveBeenCalledWith(
      expect.objectContaining({
        variantCount: DEFAULT_REWRITE_VARIANT_COUNT,
        hypotheticalAnswer: false,
      }),
    );
    expect(understanding.queries).toEqual([
      'mitochondria atp',
      'cell energy mitochondria',
      'oxidative phosphorylation',
    ]);
    expect(understanding.trigger).toBe('ambiguous');
  });

  it('asks for a hypothetical answer only for a short query when enabled', async () => {
    const model = rewriter({
      query: 'mitochondria atp',
      variants: [],
      hypotheticalAnswer: 'Mitochondria produce ATP.',
      inputTokens: 10,
      outputTokens: 5,
    });
    const service = new QueryUnderstandingService(
      { ...config, hypotheticalAnswer: true },
      model,
    );

    const understanding = await service.understand({
      message: 'the powerhouse?',
    });

    expect(model.calls[0].hypotheticalAnswer).toBe(true);
    expect(understanding.hypotheticalAnswer).toBe('Mitochondria produce ATP.');
  });

  it('falls back to the heuristic when no model is configured', async () => {
    const service = new QueryUnderstandingService(config);

    const understanding = await service.understand({
      message:
        'Give me a short chapter summary explaining osmosis across a selectively permeable membrane.',
    });

    expect(understanding).toMatchObject({
      queries: ['osmosis selectively permeable membrane'],
      strategy: 'heuristic',
      reason: 'no_provider',
      trigger: 'meta_instructions',
    });
  });

  it('falls back to the heuristic when the model reports it is unavailable', async () => {
    const model = rewriter(null);
    const service = new QueryUnderstandingService(config, model);

    const understanding = await service.understand({
      message: 'Can you expand on that in more detail?',
      history: AT_MITOS,
    });

    expect(understanding).toMatchObject({
      queries: ['mitochondria generate atp cell'],
      strategy: 'heuristic',
      reason: 'no_provider',
      trigger: 'follow_up',
    });
  });

  it('falls back to the heuristic when the model throws', async () => {
    const model = rewriter(() => {
      throw new Error('gateway is down');
    });
    const service = new QueryUnderstandingService(config, model);

    const understanding = await service.understand({
      message: 'Can you expand on that in more detail?',
      history: AT_MITOS,
    });

    expect(understanding).toMatchObject({
      queries: ['mitochondria generate atp cell'],
      strategy: 'heuristic',
      reason: 'failed',
    });
  });

  it('falls back to the heuristic when the model returns a blank query', async () => {
    const model = rewriter({
      query: '   ',
      variants: ['unused'],
      hypotheticalAnswer: null,
      inputTokens: 10,
      outputTokens: 1,
    });
    const service = new QueryUnderstandingService(config, model);

    const understanding = await service.understand({
      message: 'Can you expand on that in more detail?',
      history: AT_MITOS,
    });

    expect(understanding).toMatchObject({
      queries: ['mitochondria generate atp cell'],
      strategy: 'heuristic',
      reason: 'failed',
    });
  });

  it('degenerates to the heuristic when the model exceeds its latency budget', async () => {
    let aborted = false;
    const model: QueryRewriter = {
      rewrite: (request) =>
        new Promise((_resolve) => {
          request.signal?.addEventListener('abort', () => {
            aborted = true;
          });
        }),
    };
    const service = new QueryUnderstandingService(
      { ...config, timeoutMs: 20 },
      model,
    );

    const understanding = await service.understand({
      message: 'Can you expand on that in more detail?',
      history: AT_MITOS,
    });

    expect(understanding).toMatchObject({
      queries: ['mitochondria generate atp cell'],
      strategy: 'heuristic',
      reason: 'timeout',
    });
    expect(aborted).toBe(true);
  });

  it('disables rewriting entirely when configured off', async () => {
    const model = rewriter(null);
    const service = new QueryUnderstandingService(
      { ...config, enabled: false },
      model,
    );

    const understanding = await service.understand({
      message: 'Give me a short summary.',
    });

    expect(model.rewrite).not.toHaveBeenCalled();
    expect(understanding).toMatchObject({
      queries: ['Give me a short summary.'],
      strategy: null,
      reason: 'disabled',
    });
  });
});

describe('query understanding trace mapping', () => {
  it('records a passthrough when the stage is not wired', () => {
    expect(passthroughUnderstanding('How does osmosis work?')).toEqual({
      enabled: false,
      queries: ['How does osmosis work?'],
      hypotheticalAnswer: null,
      trigger: null,
      strategy: null,
      reason: 'disabled',
      model: DEFAULT_REWRITE_MODEL,
      inputTokens: 0,
      outputTokens: 0,
    });
  });

  it('records the paraphrases and keeps the hypothetical answer bounded', () => {
    const hypothetical = 'x'.repeat(MAX_TRACE_HYPOTHETICAL_CHARS + 300);
    const trace = traceRewrite(
      {
        enabled: true,
        queries: ['primary', 'variant one', 'variant two'],
        hypotheticalAnswer: hypothetical,
        trigger: 'ambiguous',
        strategy: 'model',
        reason: null,
        model: DEFAULT_REWRITE_MODEL,
        inputTokens: 40,
        outputTokens: 12,
      },
      'the original message',
    );

    expect(trace).toEqual({
      enabled: true,
      original: 'the original message',
      query: 'primary',
      variants: ['variant one', 'variant two'],
      hypotheticalAnswer: 'x'.repeat(MAX_TRACE_HYPOTHETICAL_CHARS),
      trigger: 'ambiguous',
      strategy: 'model',
      reason: null,
      model: DEFAULT_REWRITE_MODEL,
    });
  });
});

describe('loadRetrievalRewriteConfig', () => {
  it('falls back to the documented defaults', () => {
    expect(loadRetrievalRewriteConfig({})).toEqual(DEFAULT_REWRITE_CONFIG);
  });

  it('reads the rewrite configuration from the environment', () => {
    expect(
      loadRetrievalRewriteConfig({
        RETRIEVAL_REWRITE_ENABLED: 'false',
        RETRIEVAL_REWRITE_MODEL: 'openai/gpt-5.6-luna',
        RETRIEVAL_REWRITE_TIMEOUT_MS: '800',
        RETRIEVAL_REWRITE_MULTI_QUERY: 'off',
        RETRIEVAL_REWRITE_VARIANT_COUNT: '3',
        RETRIEVAL_REWRITE_HYPOTHETICAL_ANSWER: 'yes',
      }),
    ).toEqual({
      enabled: false,
      model: 'openai/gpt-5.6-luna',
      timeoutMs: 800,
      multiQuery: false,
      variantCount: 3,
      hypotheticalAnswer: true,
    });
  });

  it('clamps the budget and the variant count and ignores unusable values', () => {
    expect(
      loadRetrievalRewriteConfig({
        RETRIEVAL_REWRITE_TIMEOUT_MS: '999999',
        RETRIEVAL_REWRITE_VARIANT_COUNT: '99',
        RETRIEVAL_REWRITE_MODEL: '   ',
      }),
    ).toMatchObject({
      timeoutMs: 10000,
      variantCount: MAX_REWRITE_VARIANTS,
      model: DEFAULT_REWRITE_MODEL,
    });
    expect(
      loadRetrievalRewriteConfig({
        RETRIEVAL_REWRITE_TIMEOUT_MS: '0',
        RETRIEVAL_REWRITE_VARIANT_COUNT: 'many',
        RETRIEVAL_REWRITE_ENABLED: 'maybe',
      }),
    ).toMatchObject({
      timeoutMs: DEFAULT_REWRITE_TIMEOUT_MS,
      variantCount: DEFAULT_REWRITE_VARIANT_COUNT,
      enabled: true,
    });
  });
});

describe('contentWords', () => {
  it('keeps identifiers and numbers while dropping instruction verbs', () => {
    expect(contentWords('Explain the CS-3300 grading policy briefly.')).toEqual(
      ['cs-3300', 'grading', 'policy'],
    );
  });
});
