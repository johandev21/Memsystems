import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiService } from '../src/modules/ai/ai.service';
import { ConnectionService } from '../src/modules/ai/connection.service';
import { RetrievalService } from '../src/modules/ai/retrieval.service';
import { RetrievalTraceService } from '../src/modules/ai/retrieval-trace.service';
import { ChatService } from '../src/modules/chat/chat.service';
import {
  MESSAGE_LANGUAGE_INSTRUCTION,
  groundingDirective,
} from '../src/modules/chat/grounding-directives';
import { DRIZZLE } from '../src/modules/database/database.module';
import { NotebooksService } from '../src/modules/notebooks/notebooks.service';

const mocks = vi.hoisted(() => ({
  streamText: vi.fn(),
}));

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return { ...actual, streamText: mocks.streamText };
});

const baseRetrievalTrace = {
  version: 5,
  query: 'Explain Plato',
  topK: 8,
  scope: { kind: 'notebook', sourceIds: null },
  relevanceFloor: 0.3,
  embedding: { model: 'voyage-4', dimensions: 1024 },
  rewrite: null,
  legs: [{ kind: 'dense', variant: 0, candidates: [] }],
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
    skippedReason: 'unavailable',
    threshold: 0.4,
    candidates: [],
    inputTokens: 0,
  },
  evidence: {
    overlapThreshold: 0.8,
    maxPerSource: 4,
    tokenBudget: 20000,
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
  latencyMs: 8,
  cost: {
    embeddingInputTokens: 3,
    rerankInputTokens: 0,
    rewriteInputTokens: 0,
    rewriteOutputTokens: 0,
  },
};

const retrievalOk = (
  overrides: Record<string, unknown> = {},
  traceOverrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  chunks: [],
  abstained: false,
  abstentionReason: null,
  unhelpfulSources: [],
  trace: { ...baseRetrievalTrace, ...traceOverrides },
  ...overrides,
});

const evidenceChunk = {
  chunkId: 'chunk-1',
  chunkIndex: 0,
  sourceId: 'source-1',
  title: 'Lecture notes',
  content: 'Justice is harmony of the soul.',
  sectionPath: [],
  score: 0.8,
  url: null,
  kind: 'text',
  sourceVersionId: null,
  locator: null,
};

/**
 * Mocked-DB harness mirroring tests/chat.service.test.ts, plus a
 * configurable notebook grounding mode behind getGroundingMode.
 */
async function createGroundingHarness() {
  const insertedValues: Record<string, unknown>[] = [];
  const degradedRowsState: { rows: Record<string, unknown>[] } = { rows: [] };
  const historyRowsState: { rows: Record<string, unknown>[] } = { rows: [] };
  const notebookModeState: { mode: string | undefined } = {
    mode: undefined,
  };

  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => {
          const rows = Promise.resolve(degradedRowsState.rows);
          return {
            orderBy: vi
              .fn()
              .mockImplementation(() => Promise.resolve(historyRowsState.rows)),
            then: rows.then.bind(rows),
          };
        }),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => {
        insertedValues.push(values);
        return {
          returning: vi.fn().mockResolvedValue([
            {
              id: (values.id as string) || 'user-message-1',
              role: values.role || 'user',
              content:
                typeof values.content === 'string'
                  ? values.content
                  : 'Explain Plato',
              parts: values.parts || null,
              citedSourceIds: null,
              createdAt: new Date('2026-08-22T10:00:00.000Z'),
            },
          ]),
        };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(undefined),
    })),
  };
  const provider = {
    createModel: vi.fn(() => ({ provider: 'test', modelId: 'test-model' })),
  };

  mocks.streamText.mockReturnValue({
    toUIMessageStreamResponse: vi.fn(() => new Response()),
  });

  const retrieve = vi.fn().mockResolvedValue(retrievalOk());
  const recordTrace = vi.fn().mockResolvedValue(undefined);

  const module = await Test.createTestingModule({
    providers: [
      ChatService,
      { provide: DRIZZLE, useValue: db },
      {
        provide: NotebooksService,
        useValue: {
          assertNotebookOwner: vi.fn().mockResolvedValue(undefined),
          getGroundingMode: vi.fn(() => Promise.resolve(notebookModeState.mode)),
        },
      },
      {
        provide: AiService,
        useValue: {
          getProviderForModel: vi.fn().mockResolvedValue(provider),
          getGatewayRequestOptions: vi.fn().mockResolvedValue({}),
          requireCapability: vi.fn(),
        },
      },
      {
        provide: ConnectionService,
        useValue: { requireConnected: vi.fn().mockResolvedValue(undefined) },
      },
      {
        provide: RetrievalService,
        useValue: { retrieve },
      },
      {
        provide: RetrievalTraceService,
        useValue: {
          record: recordTrace,
          clearChatTraces: vi.fn().mockResolvedValue(undefined),
        },
      },
    ],
  }).compile();

  return {
    service: module.get(ChatService),
    insertedValues,
    retrieve,
    recordTrace,
    set notebookGroundingMode(mode: string | undefined) {
      notebookModeState.mode = mode;
    },
  };
}

describe('groundingDirective', () => {
  it('strict answers only from passages and refuses the uncovered part', () => {
    const directive = groundingDirective('strict');

    expect(directive).toContain('ONLY from the provided source passages');
    expect(directive).toContain('Never use general knowledge');
    expect(directive).toContain('refuse the uncovered part');
    expect(directive).toContain('name what is not covered');
  });

  it('moderate cites sources and labels general-knowledge sections', () => {
    const directive = groundingDirective('moderate');

    expect(directive).toContain('[ref:Rn]');
    expect(directive).toContain('General knowledge:');
  });

  it('free grounds source questions but answers freely otherwise', () => {
    const directive = groundingDirective('free');

    expect(directive).toContain(
      'If the question is about the provided sources',
    );
    expect(directive).toContain('answer freely from general knowledge');
    expect(directive).toContain('do not force citations');
  });
});

describe('ChatService grounding mode', () => {
  let harness: Awaited<ReturnType<typeof createGroundingHarness>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    harness = await createGroundingHarness();
  });

  it('appends the strict directive to the model instructions', async () => {
    harness.retrieve.mockResolvedValue(
      retrievalOk({ chunks: [evidenceChunk] }),
    );

    await harness.service.sendMessage('notebook-1', {
      content: 'Explain Plato',
      model: 'openai/gpt-5.6-sol',
      groundingMode: 'strict',
    });

    const streamOptions = mocks.streamText.mock.calls[0][0] as {
      instructions: string;
    };
    expect(streamOptions.instructions).toContain(
      'ONLY from the provided source passages',
    );
    expect(streamOptions.instructions).toContain('Justice is harmony');
  });

  it('appends the moderate directive with its general-knowledge label', async () => {
    harness.retrieve.mockResolvedValue(
      retrievalOk({ chunks: [evidenceChunk] }),
    );

    await harness.service.sendMessage('notebook-1', {
      content: 'Explain Plato',
      model: 'openai/gpt-5.6-sol',
      groundingMode: 'moderate',
    });

    const streamOptions = mocks.streamText.mock.calls[0][0] as {
      instructions: string;
    };
    expect(streamOptions.instructions).toContain('General knowledge:');
    expect(streamOptions.instructions).toContain('[ref:Rn]');
  });

  it('appends the free directive without forcing citations', async () => {
    harness.retrieve.mockResolvedValue(
      retrievalOk({ chunks: [evidenceChunk] }),
    );

    await harness.service.sendMessage('notebook-1', {
      content: 'Tell me a joke',
      model: 'openai/gpt-5.6-sol',
      groundingMode: 'free',
    });

    const streamOptions = mocks.streamText.mock.calls[0][0] as {
      instructions: string;
    };
    expect(streamOptions.instructions).toContain(
      'answer freely from general knowledge',
    );
    expect(streamOptions.instructions).toContain('do not force citations');
  });

  it('instructs the model to follow the user message language, not the interface language', async () => {
    harness.retrieve.mockResolvedValue(
      retrievalOk({ chunks: [evidenceChunk] }),
    );

    await harness.service.sendMessage('notebook-1', {
      content: 'Explícame a Platón',
      model: 'openai/gpt-5.6-sol',
      language: 'es',
      groundingMode: 'strict',
    });

    const streamOptions = mocks.streamText.mock.calls[0][0] as {
      instructions: string;
    };
    expect(streamOptions.instructions).toContain(MESSAGE_LANGUAGE_INSTRUCTION);
    expect(streamOptions.instructions).not.toContain('Respond in Spanish');
    expect(streamOptions.instructions).not.toContain('Respond in English');
  });

  it('strict abstention sends the no-evidence reply without a model call', async () => {
    harness.retrieve.mockResolvedValue(
      retrievalOk(
        {
          chunks: [],
          abstained: true,
          abstentionReason: 'below_threshold',
          unhelpfulSources: [
            { id: 'source-9', title: 'Lecture notes', kind: 'text', url: null },
          ],
        },
        { abstained: true, abstentionReason: 'below_threshold' },
      ),
    );

    await harness.service.sendMessage('notebook-1', {
      content: 'Explain Plato',
      model: 'openai/gpt-5.6-sol',
      groundingMode: 'strict',
    });

    expect(mocks.streamText).not.toHaveBeenCalled();
    const assistantInsert = harness.insertedValues.find(
      (values) => values.role === 'assistant',
    );
    expect(assistantInsert).toMatchObject({
      metadata: expect.objectContaining({ finishReason: 'no_evidence' }),
    });
  });

  it('moderate abstention streams through the model instead of the no-evidence state', async () => {
    harness.retrieve.mockResolvedValue(
      retrievalOk(
        {
          chunks: [],
          abstained: true,
          abstentionReason: 'below_threshold',
          unhelpfulSources: [],
        },
        { abstained: true, abstentionReason: 'below_threshold' },
      ),
    );

    await harness.service.sendMessage('notebook-1', {
      content: 'Explain Plato',
      model: 'openai/gpt-5.6-sol',
      groundingMode: 'moderate',
    });

    expect(mocks.streamText).toHaveBeenCalledOnce();
    const assistantInsert = harness.insertedValues.find(
      (values) => values.role === 'assistant',
    );
    expect(assistantInsert).toBeUndefined();
    const streamOptions = mocks.streamText.mock.calls[0][0] as {
      instructions: string;
    };
    expect(streamOptions.instructions).toContain('General knowledge:');
  });

  it('free abstention streams through the model instead of the no-evidence state', async () => {
    harness.retrieve.mockResolvedValue(
      retrievalOk(
        {
          chunks: [],
          abstained: true,
          abstentionReason: 'below_threshold',
          unhelpfulSources: [],
        },
        { abstained: true, abstentionReason: 'below_threshold' },
      ),
    );

    await harness.service.sendMessage('notebook-1', {
      content: 'Tell me a joke',
      model: 'openai/gpt-5.6-sol',
      groundingMode: 'free',
    });

    expect(mocks.streamText).toHaveBeenCalledOnce();
    const assistantInsert = harness.insertedValues.find(
      (values) => values.role === 'assistant',
    );
    expect(assistantInsert).toBeUndefined();
  });

  it('records the effective mode on the trace and both persisted messages', async () => {
    harness.retrieve.mockResolvedValue(
      retrievalOk({ chunks: [evidenceChunk] }),
    );

    await harness.service.sendMessage('notebook-1', {
      content: 'Explain Plato',
      model: 'openai/gpt-5.6-sol',
      groundingMode: 'free',
    });

    expect(harness.retrieve).toHaveBeenCalledWith(
      expect.objectContaining({ notebookId: 'notebook-1' }),
    );
    expect(harness.recordTrace).toHaveBeenCalledWith(
      expect.objectContaining({ groundingMode: 'free' }),
    );
    expect(
      harness.insertedValues.find((values) => values.role === 'user'),
    ).toMatchObject({ groundingMode: 'free' });

    const streamOptions = mocks.streamText.mock.calls[0][0] as {
      onEnd: (event: { text: string; finishReason?: string }) => Promise<void>;
    };
    await streamOptions.onEnd({
      text: 'Justice is harmony of the soul.',
      finishReason: 'stop',
    });

    const assistantInsert = harness.insertedValues.find(
      (values) => values.role === 'assistant',
    );
    expect(assistantInsert).toMatchObject({
      groundingMode: 'free',
      metadata: expect.objectContaining({ groundingMode: 'free' }),
    });
  });

  it('falls back to the notebook mode when no override is sent', async () => {
    harness.notebookGroundingMode = 'moderate';
    harness.retrieve.mockResolvedValue(
      retrievalOk({ chunks: [evidenceChunk] }),
    );

    await harness.service.sendMessage('notebook-1', {
      content: 'Explain Plato',
      model: 'openai/gpt-5.6-sol',
    });

    expect(harness.recordTrace).toHaveBeenCalledWith(
      expect.objectContaining({ groundingMode: 'moderate' }),
    );
    const streamOptions = mocks.streamText.mock.calls[0][0] as {
      instructions: string;
    };
    expect(streamOptions.instructions).toContain('General knowledge:');
  });

  it('always runs retrieval for text messages in every mode', async () => {
    for (const mode of ['strict', 'moderate', 'free'] as const) {
      vi.clearAllMocks();
      const turn = await createGroundingHarness();
      turn.retrieve.mockResolvedValue(retrievalOk({ chunks: [evidenceChunk] }));

      await turn.service.sendMessage('notebook-1', {
        content: 'Explain Plato',
        model: 'openai/gpt-5.6-sol',
        groundingMode: mode,
      });

      expect(turn.retrieve).toHaveBeenCalledWith(
        expect.objectContaining({
          notebookId: 'notebook-1',
          query: 'Explain Plato',
        }),
      );
      expect(turn.recordTrace).toHaveBeenCalledWith(
        expect.objectContaining({ groundingMode: mode }),
      );
    }
  });
});
