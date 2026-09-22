import { describe, expect, it, vi } from 'vitest';
import { GenerationService } from '../src/modules/study-materials/generation.service';
import type { StartGenerationInput } from '../src/modules/study-materials/generation-request-manager';
import type { GenerationGrounding } from '../src/modules/study-materials/generation-grounding';
import type { RetrievedChunk } from '../src/modules/ai/retrieval.service';

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

function setup() {
  const notebooksService = {
    assertNotebookOwner: vi.fn(async () => undefined),
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
    requestManager,
    streamHandler,
    ground,
    recordTrace,
  };
}

const baseInput: StartGenerationInput = {
  kind: 'study_guide',
  brief: '',
  sourceIds: [],
};

describe('GenerationService message keys', () => {
  it('keys unavailable study guide sources', async () => {
    const { service, ground } = setup();
    ground.mockResolvedValue(
      grounding({
        unavailableSources: [
          { id: 'source-1', title: 'First source', kind: 'text' },
        ],
      }),
    );

    await expect(
      service.generate('notebook-1', { ...baseInput, sourceIds: ['source-1'] }),
    ).rejects.toMatchObject({
      messageKey: 'errors.generation.sourcesUnavailable',
      code: 'bad_request',
    });
  });

  it('reports unavailable selected sources for every kind, not only study guides', async () => {
    const { service, ground } = setup();
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

  it('persists the traces of the passes it ran before rejecting unavailable sources', async () => {
    const { service, ground, recordTrace } = setup();
    ground.mockResolvedValue(
      grounding({
        traces: [trace('Cell biology Part 1'), trace('Cell biology Part 2')],
        unavailableSources: [
          { id: 'source-2', title: 'Second source', kind: 'text' },
        ],
      }),
    );

    await expect(
      service.generate('notebook-1', {
        kind: 'quiz',
        brief: 'Cell biology',
        sourceIds: ['source-1', 'source-2'],
      }),
    ).rejects.toMatchObject({
      messageKey: 'errors.generation.sourcesUnavailable',
    });

    // The Generation never streamed, so there is no request id to correlate
    // with, but the retrieval work is still diagnosable.
    expect(recordTrace).toHaveBeenCalledTimes(2);
    expect(recordTrace).toHaveBeenCalledWith({
      notebookId: 'notebook-1',
      kind: 'generation',
      generationRequestId: undefined,
      trace: expect.objectContaining({ query: 'Cell biology Part 1' }),
    });
  });

  it('keys the study guide brief requirement', async () => {
    const { service } = setup();

    await expect(
      service.generate('notebook-1', baseInput),
    ).rejects.toMatchObject({
      messageKey: 'errors.generation.sourceOrBrief.studyGuide',
      code: 'bad_request',
    });
  });

  it('keys the practice problem count with params', async () => {
    const { service } = setup();

    await expect(
      service.generate('notebook-1', {
        ...baseInput,
        kind: 'practice_problems',
        brief: 'Cell biology',
        questionCount: 31,
      }),
    ).rejects.toMatchObject({
      messageKey: 'errors.generation.problemCount',
      code: 'bad_request',
      params: { min: 1, max: 30 },
    });
  });

  it('keys the practice problems brief requirement', async () => {
    const { service } = setup();

    await expect(
      service.generate('notebook-1', {
        ...baseInput,
        kind: 'practice_problems',
      }),
    ).rejects.toMatchObject({
      messageKey: 'errors.generation.sourceOrBrief.practiceProblems',
      code: 'bad_request',
    });
  });

  it('keys the case study question count with params', async () => {
    const { service } = setup();

    await expect(
      service.generate('notebook-1', {
        ...baseInput,
        kind: 'case_study',
        brief: 'A case',
        questionCount: 11,
      }),
    ).rejects.toMatchObject({
      messageKey: 'errors.generation.questionCount',
      code: 'bad_request',
      params: { min: 1, max: 10 },
    });
  });

  it('keys a missing generation request', async () => {
    const { service } = setup();

    await expect(service.cancel('missing-request')).rejects.toMatchObject({
      messageKey: 'errors.generation.requestNotFound',
      code: 'not_found',
    });
  });

  it('aborts the in-flight stream controller when cancelled', async () => {
    const { service, requestManager, streamHandler } = setup();
    requestManager.get.mockResolvedValue({
      id: 'request-1',
      notebookId: 'notebook-1',
    } as never);

    await service.generate('notebook-1', {
      ...baseInput,
      brief: 'Cell biology',
    });

    const signal = streamHandler.createStream.mock.calls[0][6] as AbortSignal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal.aborted).toBe(false);

    await service.cancel('request-1');

    expect(signal.aborted).toBe(true);
  });
});

describe('GenerationService retrieval grounding', () => {
  it('grounds on the retrieved sections of every selected source and records one trace per pass', async () => {
    const { service, ground, streamHandler, recordTrace } = setup();
    const first = chunk();
    const second = chunk({
      chunkId: 'chunk-2',
      chunkIndex: 2,
      sourceId: 'source-2',
      title: 'Second source',
      content: 'Source: "Second source"\nSecond source body',
    });
    const evidence = [
      { ...first, citationKey: 'R1', rank: 1 },
      { ...second, citationKey: 'R2', rank: 2 },
    ];
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
          {
            id: 'source-2',
            title: 'Second source',
            kind: 'text',
            url: null,
            chunks: [second],
            promptChunks: [second],
          },
        ],
        evidence,
        traces: [trace('Cell biology Part 1'), trace('Cell biology Part 2')],
      }),
    );

    await service.generate('notebook-1', {
      kind: 'quiz',
      brief: 'Cell biology',
      sourceIds: ['source-1', 'source-2'],
    });

    expect(ground).toHaveBeenCalledWith({
      notebookId: 'notebook-1',
      kind: 'quiz',
      brief: 'Cell biology',
      sourceIds: ['source-1', 'source-2'],
    });

    expect(streamHandler.createStream.mock.calls[0][2]).toEqual({
      sources: [
        expect.objectContaining({ id: 'source-1' }),
        expect.objectContaining({ id: 'source-2' }),
      ],
      evidence,
    });

    expect(recordTrace).toHaveBeenCalledTimes(2);
    expect(recordTrace).toHaveBeenCalledWith({
      notebookId: 'notebook-1',
      kind: 'generation',
      generationRequestId: 'request-1',
      trace: expect.objectContaining({ query: 'Cell biology Part 1' }),
    });
  });

  it('does not retrieve or record a trace when no sources are selected', async () => {
    const { service, ground, recordTrace, streamHandler } = setup();

    await service.generate('notebook-1', {
      kind: 'study_guide',
      brief: 'Cell biology',
      sourceIds: [],
    });

    expect(ground).toHaveBeenCalledWith(
      expect.objectContaining({ sourceIds: [] }),
    );
    expect(recordTrace).not.toHaveBeenCalled();
    expect(streamHandler.createStream.mock.calls[0][2]).toEqual({
      sources: [],
      evidence: [],
    });
  });
});
