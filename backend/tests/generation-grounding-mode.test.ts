import { beforeEach, describe, expect, it, vi } from 'vitest';
import { streamText } from 'ai';
import { GenerationService } from '../src/modules/study-materials/generation.service';
import type { StartGenerationInput } from '../src/modules/study-materials/generation-request-manager';
import type { GenerationGrounding } from '../src/modules/study-materials/generation-grounding';
import type { RetrievedChunk } from '../src/modules/ai/retrieval.service';
import { StreamHandler } from '../src/modules/study-materials/stream-handler';
import { validateContent } from '../src/modules/study-materials/shapes';
import { GENERAL_KNOWLEDGE_SUPPLEMENT_FIELD } from '../src/modules/study-materials/generation-supplement';

vi.mock('ai', () => ({
  streamText: vi.fn(),
  Output: { object: vi.fn() },
  parsePartialJson: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Shared fakes (GenerationService level, after generation.service.test.ts).
// ---------------------------------------------------------------------------

function chunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    chunkId: 'chunk-1',
    chunkIndex: 0,
    sourceId: 'source-1',
    title: 'First source',
    content: 'Source: "First source"\nFirst source body',
    score: 0.6,
    url: null,
    kind: 'text',
    sourceVersionId: null,
    locator: null,
    sectionPath: [],
    ...overrides,
  };
}

function trace(query: string) {
  return {
    version: 5 as const,
    query,
    topK: 16,
    scope: { kind: 'selected_sources' as const, sourceIds: ['source-1'] },
    relevanceFloor: 0,
    embedding: { model: 'voyage-4', dimensions: 1024 },
    rewrite: null,
    legs: [{ kind: 'dense' as const, variant: 0, candidates: [] }],
    fusion: {
      k: 60,
      weights: { dense: 1, lexical: 1 },
      depths: { dense: 32, lexical: 32 },
      variants: 1,
    },
    fusedOrder: [],
    rerank: {
      model: 'rerank-2.5',
      applied: false,
      skippedReason: 'unavailable' as const,
      threshold: 0,
      candidates: [],
      inputTokens: 0,
    },
    evidence: {
      overlapThreshold: 0.8,
      maxPerSource: 4,
      tokenBudget: 20_000,
      sectionExpansion: true,
      tokens: 0,
      budgetExhausted: false,
      items: [],
      droppedOverlap: [],
      droppedDiversity: [],
      droppedBudget: [],
    },
    chosen: [],
    abstained: false,
    abstentionReason: null,
    latencyMs: 4,
    cost: {
      embeddingInputTokens: 4,
      rerankInputTokens: 0,
      rewriteInputTokens: 0,
      rewriteOutputTokens: 0,
    },
  };
}

function grounding(
  overrides: Partial<GenerationGrounding> = {},
): GenerationGrounding {
  return {
    sources: [],
    evidence: [],
    unavailableSources: [],
    degradedSources: [],
    traces: [],
    ...overrides,
  };
}

function setupGeneration() {
  const notebooksService = {
    assertNotebookOwner: vi.fn(async () => undefined),
    getGroundingMode: vi.fn(async () => 'strict'),
  };
  const connectionService = {
    requireConnected: vi.fn(async () => undefined),
  };
  const requestManager = {
    get: vi.fn(async () => undefined),
    create: vi.fn(async () => 'request-1'),
    cancel: vi.fn(async () => undefined),
  };
  const streamHandler = {
    createStream: vi.fn((..._args: unknown[]) => ({
      stream: new ReadableStream(),
    })),
  };
  const ground = vi.fn(async () => grounding());
  const groundingService = { ground };
  const recordTrace = vi.fn(async () => undefined);
  const retrievalTraceService = { record: recordTrace };
  const service = new GenerationService(
    notebooksService as never,
    connectionService as never,
    requestManager as never,
    streamHandler as never,
    groundingService as never,
    retrievalTraceService as never,
  );
  return {
    service,
    notebooksService,
    requestManager,
    streamHandler,
    ground,
    recordTrace,
  };
}

// ---------------------------------------------------------------------------
// Stream fakes (after study-guide-generation.test.ts).
// ---------------------------------------------------------------------------

const quizContent = {
  title: 'cell-biology-quiz',
  questions: [
    {
      id: 'q1',
      prompt: 'What does the mitochondrion do?',
      options: [
        { id: 'q1-a', text: 'Produces energy', explanation: 'Correct.' },
        { id: 'q1-b', text: 'Stores water', explanation: 'Incorrect.' },
      ],
      correctOptionId: 'q1-a',
      hint: '',
      topic: '',
    },
  ],
};

const supplementText =
  'General knowledge supplement: Mitochondria carry their own small genome, a standard textbook fact beyond the selected sources.';

function setupStream() {
  let saved: Record<string, unknown> | undefined;
  const database = {
    insert: vi.fn(() => ({
      values: (value: Record<string, unknown>) => ({
        returning: async () => {
          saved = { ...value, id: 'material-1' };
          return [saved];
        },
      }),
    })),
  };
  const aiService = {
    getProviderForModel: async () => ({
      listModels: () => [
        { id: 'test-model', capabilities: { structuredOutput: true } },
      ],
      createModel: () => ({}),
    }),
    getGatewayRequestOptions: () => ({}),
  };
  const handler = new StreamHandler(database as never, aiService as never);
  return {
    handler,
    database,
    saved: () => saved as Record<string, unknown> & { content: Record<string, unknown> },
  };
}

async function drain(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  let text = '';
  while (true) {
    const result = await reader.read();
    if (result.done) return text;
    text += new TextDecoder().decode(result.value);
  }
}

function mockNativeOutput(content: unknown) {
  vi.mocked(streamText).mockReturnValue({
    partialOutputStream: (async function* () {
      yield content;
    })(),
    output: Promise.resolve(content),
  } as never);
}

function mockFallbackOutput(content: unknown) {
  vi.mocked(streamText)
    .mockImplementationOnce(() => {
      throw new Error('Native unavailable');
    })
    .mockReturnValue({
      textStream: (async function* () {
        yield JSON.stringify(content);
      })(),
    } as never);
}

const groundedQuiz = {
  sources: [
    {
      id: 'source-1',
      title: 'First source',
      kind: 'text',
      url: null,
      chunks: [chunk()],
      promptChunks: [chunk()],
    },
  ],
  evidence: [{ ...chunk(), citationKey: 'R1', rank: 1 }],
};

// ---------------------------------------------------------------------------
// GenerationService gating per mode.
// ---------------------------------------------------------------------------

describe('generation grounding modes: service gates', () => {
  it('strict keeps the study guide source-or-brief gate', async () => {
    const { service, requestManager } = setupGeneration();

    await expect(
      service.generate('notebook-1', {
        kind: 'study_guide',
        brief: '',
        sourceIds: [],
      }),
    ).rejects.toMatchObject({
      messageKey: 'errors.generation.sourceOrBrief.studyGuide',
      code: 'bad_request',
    });
    expect(requestManager.create).not.toHaveBeenCalled();
  });

  it('strict refuses selected-but-unavailable sources', async () => {
    const { service, ground } = setupGeneration();
    ground.mockResolvedValue(
      grounding({
        unavailableSources: [
          { id: 'source-1', title: 'First source', kind: 'text' },
        ],
      }),
    );

    await expect(
      service.generate('notebook-1', {
        kind: 'quiz',
        brief: 'Cell biology',
        sourceIds: ['source-1'],
      }),
    ).rejects.toMatchObject({
      messageKey: 'errors.generation.sourcesUnavailable',
      code: 'bad_request',
    });
  });

  it('moderate keeps strict gates: source-or-brief still rejects', async () => {
    const { service, requestManager } = setupGeneration();

    await expect(
      service.generate('notebook-1', {
        kind: 'study_guide',
        brief: '',
        sourceIds: [],
        groundingMode: 'moderate',
      }),
    ).rejects.toMatchObject({
      messageKey: 'errors.generation.sourceOrBrief.studyGuide',
      code: 'bad_request',
    });
    expect(requestManager.create).not.toHaveBeenCalled();
  });

  it('moderate refuses selected-but-unavailable sources like strict', async () => {
    const { service, ground } = setupGeneration();
    ground.mockResolvedValue(
      grounding({
        unavailableSources: [
          { id: 'source-1', title: 'First source', kind: 'text' },
        ],
      }),
    );

    await expect(
      service.generate('notebook-1', {
        kind: 'quiz',
        brief: 'Cell biology',
        sourceIds: ['source-1'],
        groundingMode: 'moderate',
      }),
    ).rejects.toMatchObject({
      messageKey: 'errors.generation.sourcesUnavailable',
      code: 'bad_request',
    });
  });

  it('free generates brief-only with zero sources selected', async () => {
    const { service, requestManager, streamHandler } = setupGeneration();

    await service.generate('notebook-1', {
      kind: 'practice_problems',
      brief: 'Cell biology',
      sourceIds: [],
      groundingMode: 'free',
    });

    expect(requestManager.create).toHaveBeenCalledTimes(1);
    expect(streamHandler.createStream).toHaveBeenCalledTimes(1);
  });

  it('free skips the source-or-brief gates even with an empty brief', async () => {
    const { service, requestManager } = setupGeneration();

    for (const kind of [
      'study_guide',
      'practice_problems',
      'case_study',
    ] as const) {
      await service.generate('notebook-1', {
        kind,
        brief: '',
        sourceIds: [],
        groundingMode: 'free',
      } as StartGenerationInput);
    }

    expect(requestManager.create).toHaveBeenCalledTimes(3);
  });

  it('free still refuses selected-but-unavailable sources', async () => {
    const { service, ground } = setupGeneration();
    ground.mockResolvedValue(
      grounding({
        unavailableSources: [
          { id: 'source-1', title: 'First source', kind: 'text' },
        ],
      }),
    );

    await expect(
      service.generate('notebook-1', {
        kind: 'quiz',
        brief: 'Cell biology',
        sourceIds: ['source-1'],
        groundingMode: 'free',
      }),
    ).rejects.toMatchObject({
      messageKey: 'errors.generation.sourcesUnavailable',
      code: 'bad_request',
    });
  });

  it('free still enforces the problem count bounds', async () => {
    const { service } = setupGeneration();

    await expect(
      service.generate('notebook-1', {
        kind: 'practice_problems',
        brief: 'Cell biology',
        sourceIds: [],
        questionCount: 31,
        groundingMode: 'free',
      }),
    ).rejects.toMatchObject({
      messageKey: 'errors.generation.problemCount',
      code: 'bad_request',
    });
  });
});

// ---------------------------------------------------------------------------
// Mode persistence: request row, stream input, retrieval traces.
// ---------------------------------------------------------------------------

describe('generation grounding modes: persistence', () => {
  it('persists the strict default on the request when no mode is set', async () => {
    const { service, requestManager } = setupGeneration();

    await service.generate('notebook-1', {
      kind: 'study_guide',
      brief: 'Cell biology',
      sourceIds: [],
    });

    expect(requestManager.create).toHaveBeenCalledWith(
      'notebook-1',
      expect.objectContaining({ groundingMode: 'strict' }),
    );
  });

  it('persists the override mode on the request', async () => {
    const { service, requestManager } = setupGeneration();

    await service.generate('notebook-1', {
      kind: 'study_guide',
      brief: 'Cell biology',
      sourceIds: [],
      groundingMode: 'moderate',
    });
    await service.generate('notebook-1', {
      kind: 'quiz',
      brief: 'Cell biology',
      sourceIds: [],
      groundingMode: 'free',
    });

    expect(requestManager.create).toHaveBeenNthCalledWith(
      1,
      'notebook-1',
      expect.objectContaining({ groundingMode: 'moderate' }),
    );
    expect(requestManager.create).toHaveBeenNthCalledWith(
      2,
      'notebook-1',
      expect.objectContaining({ groundingMode: 'free' }),
    );
  });

  it('resolves the notebook mode when the request carries no override', async () => {
    const { service, requestManager, notebooksService } = setupGeneration();
    notebooksService.getGroundingMode.mockResolvedValue('free');

    await service.generate('notebook-1', {
      kind: 'study_guide',
      brief: 'Cell biology',
      sourceIds: [],
    });

    expect(requestManager.create).toHaveBeenCalledWith(
      'notebook-1',
      expect.objectContaining({ groundingMode: 'free' }),
    );
  });

  it('forwards the resolved mode to the stream input', async () => {
    const { service, streamHandler, ground } = setupGeneration();
    const first = chunk();
    ground.mockResolvedValue(
      grounding({
        sources: [
          {
            id: 'source-1',
            title: 'First source',
            kind: 'text',
            url: null,
            chunks: [first],
            promptChunks: [first],
          },
        ],
        evidence: [{ ...first, citationKey: 'R1', rank: 1 }],
      }),
    );

    await service.generate('notebook-1', {
      kind: 'quiz',
      brief: 'Cell biology',
      sourceIds: ['source-1'],
      groundingMode: 'moderate',
    });

    expect(streamHandler.createStream.mock.calls[0][1]).toMatchObject({
      groundingMode: 'moderate',
    });
  });

  it('records retrieval traces with the resolved mode', async () => {
    const { service, ground, recordTrace } = setupGeneration();
    ground.mockResolvedValue(
      grounding({ traces: [trace('Cell biology')] }),
    );

    await service.generate('notebook-1', {
      kind: 'study_guide',
      brief: 'Cell biology',
      sourceIds: [],
      groundingMode: 'moderate',
    });

    expect(recordTrace).toHaveBeenCalledWith({
      notebookId: 'notebook-1',
      kind: 'generation',
      generationRequestId: 'request-1',
      groundingMode: 'moderate',
      trace: expect.objectContaining({ query: 'Cell biology' }),
    });
  });
});

// ---------------------------------------------------------------------------
// Stream behavior per mode: supplement field, prompts, storage.
// ---------------------------------------------------------------------------

describe('generation grounding modes: stream output', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(['native', 'fallback'])(
    'moderate persists the general-knowledge supplement (%s output)',
    async (mode) => {
      const { handler, saved } = setupStream();
      const groundedOutput = {
        ...quizContent,
        questions: [
          {
            ...quizContent.questions[0],
            prompt: 'What does the mitochondrion do [ref:R1]?',
          },
        ],
        [GENERAL_KNOWLEDGE_SUPPLEMENT_FIELD]: supplementText,
      };
      if (mode === 'native') mockNativeOutput(groundedOutput);
      else mockFallbackOutput(groundedOutput);

      const { stream } = handler.createStream(
        'notebook-1',
        {
          kind: 'quiz',
          brief: 'Cell biology',
          model: 'test-model',
          groundingMode: 'moderate',
        },
        groundedQuiz,
        'request-1',
        vi.fn(),
        vi.fn(),
      );
      expect(await drain(stream)).toContain('"materialId":"material-1"');

      expect(saved().content[GENERAL_KNOWLEDGE_SUPPLEMENT_FIELD]).toBe(
        supplementText,
      );
      const instructions = vi.mocked(streamText).mock.calls[0][0]
        .instructions as string;
      expect(instructions).toContain(
        GENERAL_KNOWLEDGE_SUPPLEMENT_FIELD,
      );
      // Citations still apply: the grounded claim keeps its evidence key.
      expect(saved().content.citations).toEqual([
        expect.objectContaining({ citationKey: 'R1' }),
      ]);
    },
  );

  it('strict never stores the supplement, even when the model emits one', async () => {
    const { handler, saved } = setupStream();
    mockNativeOutput({
      ...quizContent,
      [GENERAL_KNOWLEDGE_SUPPLEMENT_FIELD]: supplementText,
    });

    const { stream } = handler.createStream(
      'notebook-1',
      { kind: 'quiz', brief: 'Cell biology', model: 'test-model' },
      groundedQuiz,
      'request-1',
      vi.fn(),
      vi.fn(),
    );
    expect(await drain(stream)).toContain('"materialId":"material-1"');

    expect(saved().content).not.toHaveProperty(
      GENERAL_KNOWLEDGE_SUPPLEMENT_FIELD,
    );
    const instructions = vi.mocked(streamText).mock.calls[0][0]
      .instructions as string;
    expect(instructions).not.toContain(GENERAL_KNOWLEDGE_SUPPLEMENT_FIELD);
  });

  it('free without sources answers from general knowledge with no citations', async () => {
    const { handler, saved } = setupStream();
    mockNativeOutput(quizContent);

    const { stream } = handler.createStream(
      'notebook-1',
      {
        kind: 'quiz',
        brief: 'Cell biology',
        model: 'test-model',
        groundingMode: 'free',
      },
      { sources: [], evidence: [] },
      'request-1',
      vi.fn(),
      vi.fn(),
    );
    expect(await drain(stream)).toContain('"materialId":"material-1"');

    const instructions = vi.mocked(streamText).mock.calls[0][0]
      .instructions as string;
    expect(instructions).not.toContain('[ref:');
    expect(instructions).toContain('GROUNDING MODE: FREE');
    expect(saved().content).not.toHaveProperty(
      GENERAL_KNOWLEDGE_SUPPLEMENT_FIELD,
    );
    expect(saved().content.citations).toEqual([]);
  });

  it('free with sources keeps grounding and citations like strict', async () => {
    const { handler, saved } = setupStream();
    mockNativeOutput({
      ...quizContent,
      questions: [
        {
          ...quizContent.questions[0],
          prompt: 'Grounded in the source [ref:R1].',
        },
      ],
    });

    const { stream } = handler.createStream(
      'notebook-1',
      {
        kind: 'quiz',
        brief: 'Cell biology',
        model: 'test-model',
        groundingMode: 'free',
      },
      groundedQuiz,
      'request-1',
      vi.fn(),
      vi.fn(),
    );
    expect(await drain(stream)).toContain('"materialId":"material-1"');

    const instructions = vi.mocked(streamText).mock.calls[0][0]
      .instructions as string;
    expect(instructions).toContain('[ref:R1]');
    expect(saved().content.citations).toEqual([
      expect.objectContaining({ citationKey: 'R1' }),
    ]);
  });

  it('stored moderate content keeps validating', async () => {
    const { handler, saved } = setupStream();
    mockNativeOutput({
      ...quizContent,
      [GENERAL_KNOWLEDGE_SUPPLEMENT_FIELD]: supplementText,
    });

    const { stream } = handler.createStream(
      'notebook-1',
      {
        kind: 'quiz',
        brief: 'Cell biology',
        model: 'test-model',
        groundingMode: 'moderate',
      },
      groundedQuiz,
      'request-1',
      vi.fn(),
      vi.fn(),
    );
    await drain(stream);

    expect(() =>
      validateContent('quiz', saved().content),
    ).not.toThrow();
    expect(validateContent('quiz', saved().content)).toMatchObject({
      [GENERAL_KNOWLEDGE_SUPPLEMENT_FIELD]: supplementText,
    });
  });
});
