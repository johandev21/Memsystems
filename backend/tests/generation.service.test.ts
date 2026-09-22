import { describe, expect, it, vi } from 'vitest';
import {
  GENERATION_EVIDENCE_CHUNKS_PER_SOURCE,
  GenerationService,
} from '../src/modules/study-materials/generation.service';
import type { StartGenerationInput } from '../src/modules/study-materials/generation-request-manager';

function retrievalOutcome(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    chunks: [],
    abstained: true,
    abstentionReason: 'no_indexed_chunks',
    unhelpfulSources: [],
    trace: {
      version: 3,
      query: 'Cell biology',
      topK: GENERATION_EVIDENCE_CHUNKS_PER_SOURCE,
      scope: { kind: 'selected_sources', sourceIds: ['source-1'] },
      relevanceFloor: 0,
      embedding: { model: 'voyage-4', dimensions: 1024 },
      legs: [{ kind: 'dense', candidates: [] }],
      fusion: {
        k: 60,
        weights: { dense: 1, lexical: 1 },
        depths: { dense: 32, lexical: 32 },
      },
      fusedOrder: [],
      rerank: {
        model: 'rerank-2.5',
        applied: false,
        skippedReason: 'unavailable',
        threshold: 0,
        candidates: [],
        inputTokens: 0,
      },
      chosen: [],
      abstained: true,
      abstentionReason: 'no_indexed_chunks',
      latencyMs: 4,
      cost: { embeddingInputTokens: 4, rerankInputTokens: 0 },
    },
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
  const retrieve = vi.fn(async () => retrievalOutcome());
  const retrievalService = { retrieve };
  const recordTrace = vi.fn(async () => undefined);
  const retrievalTraceService = { record: recordTrace };
  const service = new GenerationService(
    notebooksService as never,
    connectionService as never,
    requestManager as never,
    streamHandler as never,
    retrievalService as never,
    retrievalTraceService as never,
  );
  return {
    service,
    requestManager,
    streamHandler,
    retrieve,
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
    const { service } = setup();

    await expect(
      service.generate('notebook-1', { ...baseInput, sourceIds: ['source-1'] }),
    ).rejects.toMatchObject({
      messageKey: 'errors.generation.sourcesUnavailable',
      code: 'bad_request',
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
  it('grounds a Generation on retrieved chunks from every selected source and records a trace', async () => {
    const { service, retrieve, streamHandler, recordTrace } = setup();
    retrieve.mockResolvedValue(
      retrievalOutcome({
        chunks: [
          {
            chunkId: 'chunk-b-2',
            chunkIndex: 2,
            sourceId: 'source-2',
            title: 'Second source',
            content: 'Source: "Second source"\nSecond source body',
            score: 0.6,
            url: null,
            kind: 'text',
            sourceVersionId: null,
            locator: null,
          },
          {
            chunkId: 'chunk-b-1',
            chunkIndex: 1,
            sourceId: 'source-2',
            title: 'Second source',
            content: 'Source: "Second source"\nSecond source intro',
            score: 0.5,
            url: null,
            kind: 'text',
            sourceVersionId: null,
            locator: null,
          },
          {
            chunkId: 'chunk-a-1',
            chunkIndex: 0,
            sourceId: 'source-1',
            title: 'First source',
            content: 'Source: "First source"\nFirst source body',
            score: 0.4,
            url: null,
            kind: 'text',
            sourceVersionId: null,
            locator: null,
          },
        ],
        abstained: false,
        abstentionReason: null,
      }),
    );

    await service.generate('notebook-1', {
      kind: 'quiz',
      brief: 'Cell biology',
      sourceIds: ['source-1', 'source-2'],
    });

    expect(retrieve).toHaveBeenCalledWith({
      notebookId: 'notebook-1',
      query: 'Cell biology',
      sourceIds: ['source-1', 'source-2'],
      topK: GENERATION_EVIDENCE_CHUNKS_PER_SOURCE,
      relevanceFloor: 0,
      rerankThreshold: 0,
    });

    expect(streamHandler.createStream.mock.calls[0][2]).toEqual([
      {
        id: 'source-1',
        title: 'First source',
        rawText: 'First source body',
      },
      {
        id: 'source-2',
        title: 'Second source',
        rawText: 'Second source intro\n\nSecond source body',
      },
    ]);

    expect(recordTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        notebookId: 'notebook-1',
        kind: 'generation',
        generationRequestId: 'request-1',
        trace: expect.objectContaining({ query: 'Cell biology' }),
      }),
    );
  });

  it('retrieves with the material kind when the brief is empty', async () => {
    const { service, retrieve } = setup();
    retrieve.mockResolvedValue(
      retrievalOutcome({
        chunks: [
          {
            chunkId: 'chunk-a-1',
            chunkIndex: 0,
            sourceId: 'source-1',
            title: 'First source',
            content: 'Source: "First source"\nBody',
            score: 0.4,
            url: null,
            kind: 'text',
            sourceVersionId: null,
            locator: null,
          },
        ],
        abstained: false,
        abstentionReason: null,
      }),
    );

    await service.generate('notebook-1', {
      kind: 'simple_flashcard',
      brief: '   ',
      sourceIds: ['source-1'],
    });

    expect(retrieve).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'simple flashcard' }),
    );
  });

  it('does not retrieve when no sources are selected', async () => {
    const { service, retrieve, recordTrace } = setup();

    await service.generate('notebook-1', {
      kind: 'study_guide',
      brief: 'Cell biology',
      sourceIds: [],
    });

    expect(retrieve).not.toHaveBeenCalled();
    expect(recordTrace).not.toHaveBeenCalled();
  });
});
