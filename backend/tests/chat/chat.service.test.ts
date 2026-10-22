import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiService } from '../../src/modules/ai/ai.service';
import { CapabilityUnsupportedError } from '../../src/common/errors/domain-error';
import { ConnectionService } from '../../src/modules/ai/connection.service';
import { RetrievalService } from '../../src/modules/ai/retrieval/retrieval.service';
import { RetrievalTraceService } from '../../src/modules/ai/retrieval/retrieval-trace.service';
import { ChatService } from '../../src/modules/chat/chat.service';
import { DRIZZLE } from '../../src/modules/database/database.module';
import {
  notebooks,
  notebookChatMessages,
} from '../../src/database/schema';
import { NotebooksService } from '../../src/modules/notebooks/notebooks.service';

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

/**
 * Builds a ChatService against a scripted db. The `where` chain resolves
 * degraded-source rows for the no-evidence lookup and stays chainable
 * (`orderBy`) for history queries.
 */
async function createChatServiceHarness() {
  const insertedValues: Record<string, unknown>[] = [];
  const degradedRowsState: { rows: Record<string, unknown>[] } = { rows: [] };
  const historyRowsState: { rows: Record<string, unknown>[] } = { rows: [] };
  const selectedMessageState: { id: string | null } = { id: null };

  const db = {
    select: vi.fn(() => ({
      from: vi.fn((table) => ({
        where: vi.fn(() => {
          if (table === notebooks) {
            return Promise.resolve([
              { selectedChatMessageId: selectedMessageState.id },
            ]);
          }
          const selectedRows = table === notebookChatMessages
            ? historyRowsState.rows
            : degradedRowsState.rows;
          const rows = Promise.resolve(selectedRows);
          return {
            orderBy: vi.fn().mockImplementation((orderCol) => {
              const rows = [...historyRowsState.rows];
              const isDesc = Boolean(
                orderCol?.queryChunks?.some((c) =>
                  c?.value?.some((v) => typeof v === 'string' && v.includes('desc')),
                ),
              );
              rows.sort((a, b) => {
                const at = a.createdAt ? new Date(a.createdAt as string | number | Date).getTime() : 0;
                const bt = b.createdAt ? new Date(b.createdAt as string | number | Date).getTime() : 0;
                return isDesc ? bt - at : at - bt;
              });
              const promise = Promise.resolve(rows);
              return Object.assign(promise, {
                limit: vi.fn().mockImplementation((lim) =>
                  Promise.resolve(rows.slice(0, lim)),
                ),
              });
            }),
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
      set: vi.fn((values: Record<string, unknown>) => {
        if (typeof values.selectedChatMessageId === 'string') {
          selectedMessageState.id = values.selectedChatMessageId;
        }
        return { where: vi.fn().mockResolvedValue(undefined) };
      }),
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
  const requireCapability = vi.fn();
  const recordTrace = vi.fn().mockResolvedValue(undefined);
  const clearChatTraces = vi.fn().mockResolvedValue(undefined);

  const module = await Test.createTestingModule({
    providers: [
      ChatService,
      { provide: DRIZZLE, useValue: db },
      {
        provide: NotebooksService,
        useValue: {
          assertNotebookOwner: vi.fn().mockResolvedValue(undefined),
        },
      },
      {
        provide: AiService,
        useValue: {
          getProviderForModel: vi.fn().mockResolvedValue(provider),
          getGatewayRequestOptions: vi.fn().mockResolvedValue({}),
          requireCapability,
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
        useValue: { record: recordTrace, clearChatTraces },
      },
    ],
  }).compile();

  return {
    service: module.get(ChatService),
    insertedValues,
    retrieve,
    requireCapability,
    recordTrace,
    clearChatTraces,
    get degradedSourceRows() {
      return degradedRowsState.rows;
    },
    set selectedMessageId(id: string | null) {
      selectedMessageState.id = id;
    },
    get selectedMessageId() {
      return selectedMessageState.id;
    },
    set degradedSourceRows(rows: Record<string, unknown>[]) {
      degradedRowsState.rows = rows;
    },
    set historyRows(rows: Record<string, unknown>[]) {
      let previousId: string | null = null;
      let lastUserId: string | null = null;
      let previousRole: string | null = null;
      historyRowsState.rows = rows.map((row) => {
        const parentId =
          row.parentId !== undefined
            ? (row.parentId as string | null)
            : row.role === 'user'
              ? previousId
              : previousRole === 'assistant'
                ? lastUserId
                : previousId;
        if (row.role === 'user') lastUserId = row.id as string;
        previousId = row.id as string;
        previousRole = row.role as string;
        return { ...row, parentId };
      });
      selectedMessageState.id = (historyRowsState.rows.at(-1)?.id as string) ?? null;
    },
  };
}

describe('ChatService streaming lifecycle', () => {
  let service: ChatService;
  let insertedValues: Record<string, unknown>[];
  let retrieve: ReturnType<typeof vi.fn>;
  let requireCapability: ReturnType<typeof vi.fn>;
  let recordTrace: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const harness = await createChatServiceHarness();
    service = harness.service;
    insertedValues = harness.insertedValues;
    retrieve = harness.retrieve;
    requireCapability = harness.requireCapability;
    recordTrace = harness.recordTrace;
  });

  it('persists the retrieval trace against the assistant message id', async () => {
    await service.sendMessage('notebook-1', {
      content: 'Explain Plato',
      model: 'openai/gpt-5.6-sol',
    });

    const streamResult = mocks.streamText.mock.results[0].value as {
      toUIMessageStreamResponse: ReturnType<typeof vi.fn>;
    };
    const responseOptions = streamResult.toUIMessageStreamResponse.mock
      .calls[0][0] as { generateMessageId: () => string };

    expect(retrieve).toHaveBeenCalledWith({
      notebookId: 'notebook-1',
      query: 'Explain Plato',
      history: [],
    });
    expect(recordTrace).toHaveBeenCalledWith({
      notebookId: 'notebook-1',
      kind: 'chat',
      chatMessageId: responseOptions.generateMessageId(),
      groundingMode: 'strict',
      trace: expect.objectContaining({ query: 'Explain Plato' }),
    });
  });

  it('treats an explicit null parent as a root even when a branch is selected', async () => {
    const harness = await createChatServiceHarness();
    harness.historyRows = [];
    harness.selectedMessageId = 'selected-assistant';

    await harness.service.sendMessage('notebook-1', {
      content: 'Who was Plato?',
      model: 'openai/gpt-5.6-sol',
      messageId: 'new-root-user',
      parentMessageId: null,
    });

    expect(harness.insertedValues.find((row) => row.id === 'new-root-user'))
      .toEqual(expect.objectContaining({ parentId: null }));
    expect(harness.retrieve).toHaveBeenCalledWith(expect.objectContaining({ history: [] }));
  });

  it('retries a persisted user ID only when payload and branch intent match', async () => {
    const harness = await createChatServiceHarness();
    harness.historyRows = [
      {
        id: 'prior-user', role: 'user', content: 'Earlier question',
        parentId: null, parts: [{ type: 'text', text: 'Earlier question' }],
        createdAt: new Date('2026-08-22T09:00:00.000Z'),
      },
      {
        id: 'prior-answer', role: 'assistant', content: 'Earlier answer',
        parentId: 'prior-user', parts: [{ type: 'text', text: 'Earlier answer' }],
        createdAt: new Date('2026-08-22T09:01:00.000Z'),
      },
      {
        id: 'retry-user', role: 'user', content: 'Retry this question',
        parentId: 'prior-answer',
        parts: [{ type: 'text', text: 'Retry this question', state: 'done' }],
        createdAt: new Date('2026-08-22T09:02:00.000Z'),
      },
    ];
    harness.selectedMessageId = 'retry-user';

    await harness.service.sendMessage('notebook-1', {
      content: 'Retry this question',
      parts: [{ type: 'text', text: 'Retry this question', state: 'streaming' }],
      messageId: 'retry-user',
      model: 'openai/gpt-5.6-sol',
    });

    expect(harness.insertedValues.some((row) => row.id === 'retry-user')).toBe(false);
    expect(harness.retrieve).toHaveBeenCalledWith(expect.objectContaining({
      history: [
        { role: 'user', content: 'Earlier question' },
        { role: 'assistant', content: 'Earlier answer' },
      ],
    }));

    await expect(harness.service.sendMessage('notebook-1', {
      content: 'A different question',
      parts: [{ type: 'text', text: 'A different question' }],
      messageId: 'retry-user',
      model: 'openai/gpt-5.6-sol',
    })).rejects.toThrow('Message ID already belongs to a different chat request');

    await expect(harness.service.sendMessage('notebook-1', {
      content: 'Retry this question',
      parts: [{ type: 'text', text: 'Retry this question' }],
      messageId: 'retry-user',
      parentMessageId: 'prior-user',
      model: 'openai/gpt-5.6-sol',
    })).rejects.toThrow('Message ID already belongs to a different chat request');
  });

  it('builds edit and regeneration context from the requested nested branch only', async () => {
    const branchRows = [
      { id: 'root-user', role: 'user', content: 'MARKER root user', parentId: null },
      { id: 'root-answer', role: 'assistant', content: 'MARKER root answer', parentId: 'root-user' },
      { id: 'question', role: 'user', content: 'MARKER original question', parentId: 'root-answer' },
      { id: 'answer-a', role: 'assistant', content: 'MARKER answer A', parentId: 'question' },
      { id: 'answer-b', role: 'assistant', content: 'MARKER answer B', parentId: 'question' },
      { id: 'nested-user-b', role: 'user', content: 'MARKER nested user B', parentId: 'answer-b' },
      { id: 'nested-answer-b', role: 'assistant', content: 'MARKER nested answer B', parentId: 'nested-user-b' },
      { id: 'other-root', role: 'user', content: 'MARKER unrelated root', parentId: null },
    ].map((row, index) => ({
      ...row,
      parts: [{ type: 'text', text: row.content }],
      createdAt: new Date(`2026-08-22T09:0${index}:00.000Z`),
    }));

    const editHarness = await createChatServiceHarness();
    editHarness.historyRows = branchRows;
    editHarness.selectedMessageId = 'nested-answer-b';
    await editHarness.service.sendMessage('notebook-1', {
      content: 'MARKER edited question',
      parts: [{ type: 'text', text: 'MARKER edited question' }],
      editMessageId: 'question',
      model: 'openai/gpt-5.6-sol',
    });
    expect(mocks.streamText.mock.calls.at(-1)?.[0].messages).toEqual([
      { role: 'user', content: 'MARKER root user' },
      { role: 'assistant', content: 'MARKER root answer' },
      { role: 'user', content: 'MARKER edited question' },
    ]);

    const regenerateHarness = await createChatServiceHarness();
    regenerateHarness.historyRows = branchRows;
    regenerateHarness.selectedMessageId = 'nested-answer-b';
    await regenerateHarness.service.sendMessage('notebook-1', {
      content: 'MARKER original question',
      regenerateMessageId: 'answer-a',
      model: 'openai/gpt-5.6-sol',
    });
    expect(mocks.streamText.mock.calls.at(-1)?.[0].messages).toEqual([
      { role: 'user', content: 'MARKER root user' },
      { role: 'assistant', content: 'MARKER root answer' },
      { role: 'user', content: 'MARKER original question' },
    ]);
  });

  it('restores a completed reply when selecting its user-message branch', async () => {
    const harness = await createChatServiceHarness();
    harness.historyRows = [
      {
        id: 'user-a', role: 'user', content: 'Question A', parentId: null,
        createdAt: new Date('2026-08-22T09:00:00.000Z'),
      },
      {
        id: 'assistant-a', role: 'assistant', content: 'Answer A', parentId: 'user-a',
        createdAt: new Date('2026-08-22T09:01:00.000Z'),
      },
      {
        id: 'user-b', role: 'user', content: 'Question B', parentId: null,
        createdAt: new Date('2026-08-22T09:02:00.000Z'),
      },
      {
        id: 'assistant-b', role: 'assistant', content: 'Answer B', parentId: 'user-b',
        createdAt: new Date('2026-08-22T09:03:00.000Z'),
      },
    ];

    await expect(harness.service.selectMessage('notebook-1', 'user-a'))
      .resolves.toBe('assistant-a');
    expect(harness.selectedMessageId).toBe('assistant-a');
    await expect(harness.service.selectMessage('notebook-1', 'assistant-b'))
      .resolves.toBe('assistant-b');
    expect(harness.selectedMessageId).toBe('assistant-b');
  });

  it('passes the recent turns to retrieval so follow-ups can be resolved', async () => {
    const harness = await createChatServiceHarness();
    harness.historyRows = [
      {
        id: 'user-0',
        role: 'user',
        content: 'What is osmosis across a membrane?',
        parts: null,
        createdAt: new Date('2026-08-22T09:00:00.000Z'),
      },
      {
        id: 'assistant-0',
        role: 'assistant',
        content: 'Osmosis moves water across a membrane [ref:R1].',
        parts: null,
        createdAt: new Date('2026-08-22T09:01:00.000Z'),
      },
    ];

    await harness.service.sendMessage('notebook-1', {
      content: 'Can you expand on that in more detail?',
      model: 'openai/gpt-5.6-sol',
    });

    expect(harness.retrieve).toHaveBeenCalledWith({
      notebookId: 'notebook-1',
      query: 'Can you expand on that in more detail?',
      history: [
        { role: 'user', content: 'What is osmosis across a membrane?' },
        {
          role: 'assistant',
          content: 'Osmosis moves water across a membrane.',
        },
      ],
    });
  });

  it('passes request cancellation to the model stream', async () => {
    const abortController = new AbortController();

    await service.sendMessage('notebook-1', {
      content: 'Explain Plato',
      model: 'openai/gpt-5.6-sol',
      abortSignal: abortController.signal,
    });

    expect(mocks.streamText).toHaveBeenCalledWith(
      expect.objectContaining({ abortSignal: abortController.signal }),
    );
  });

  it('does not start a model stream after the client has disconnected', async () => {
    const abortController = new AbortController();
    abortController.abort(new Error('Client disconnected'));

    await expect(
      service.sendMessage('notebook-1', {
        content: 'Explain Plato',
        model: 'openai/gpt-5.6-sol',
        abortSignal: abortController.signal,
      }),
    ).rejects.toThrow('Client disconnected');
    expect(mocks.streamText).not.toHaveBeenCalled();
  });

  it('persists partial streamed text on abort using the client-visible message id', async () => {
    await service.sendMessage('notebook-1', {
      content: 'Explain Plato',
      model: 'openai/gpt-5.6-sol',
    });

    const streamOptions = mocks.streamText.mock.calls[0][0] as {
      onChunk: (event: {
        chunk: { type: string; text: string; id: string };
      }) => void;
      onAbort: () => Promise<void>;
    };
    streamOptions.onChunk({
      chunk: { type: 'text-delta', text: 'Justice begins with ', id: 'text-1' },
    });
    streamOptions.onChunk({
      chunk: { type: 'text-delta', text: 'a question.', id: 'text-1' },
    });
    await streamOptions.onAbort();

    const assistantInsert = insertedValues.find(
      (values) => values.role === 'assistant',
    );
    expect(assistantInsert).toMatchObject({
      content: 'Justice begins with a question.',
      citedSourceIds: [],
    });

    const streamResult = mocks.streamText.mock.results[0].value as {
      toUIMessageStreamResponse: ReturnType<typeof vi.fn>;
    };
    const responseOptions = streamResult.toUIMessageStreamResponse.mock
      .calls[0][0] as {
      generateMessageId: () => string;
    };
    expect(responseOptions.generateMessageId()).toBe(assistantInsert?.id);
  });

  it('always forwards reasoning to the client, even for uncatalogued models', async () => {
    await service.sendMessage('notebook-1', {
      content: 'Explain Plato',
      model: 'some-unknown-model',
    });

    const streamResult = mocks.streamText.mock.results[0].value as {
      toUIMessageStreamResponse: ReturnType<typeof vi.fn>;
    };
    const responseOptions = streamResult.toUIMessageStreamResponse.mock
      .calls[0][0] as {
      sendReasoning: boolean;
    };
    expect(responseOptions.sendReasoning).toBe(true);
  });

  it('accumulates reasoning-delta chunks for abort persist', async () => {
    await service.sendMessage('notebook-1', {
      content: 'Explain Plato',
      model: 'openai/gpt-5.6-sol',
    });

    const streamOptions = mocks.streamText.mock.calls[0][0] as {
      onChunk: (event: {
        chunk: { type: string; text?: string; textDelta?: string; id: string };
      }) => void;
      onAbort: () => Promise<void>;
    };
    streamOptions.onChunk({
      chunk: { type: 'reasoning-delta', text: 'Analyzing ', id: 'reasoning-1' },
    });
    streamOptions.onChunk({
      chunk: { type: 'reasoning-delta', text: 'the cave.', id: 'reasoning-1' },
    });
    streamOptions.onChunk({
      chunk: {
        type: 'text-delta',
        text: 'The cave represents...',
        id: 'text-1',
      },
    });
    await streamOptions.onAbort();

    const assistantInsert = insertedValues.find(
      (values) => values.role === 'assistant',
    );
    expect(assistantInsert).toMatchObject({
      reasoning: 'Analyzing the cave.',
      parts: [
        { type: 'reasoning', text: 'Analyzing the cave.' },
        { type: 'text', text: 'The cave represents...' },
      ],
    });
  });

  it('persists message parts, reasoning, and usage metadata on finish', async () => {
    await service.sendMessage('notebook-1', {
      content: 'Explain the cave allegory',
      model: 'openai/gpt-5.6-sol',
    });

    const streamOptions = mocks.streamText.mock.calls[0][0] as {
      onEnd: (event: {
        text: string;
        reasoning?: string;
        usage?: {
          promptTokens: number;
          completionTokens: number;
          totalTokens: number;
        };
        finishReason?: string;
      }) => Promise<void>;
    };

    await streamOptions.onEnd({
      text: 'The cave represents human perception...',
      reasoning: 'Analyzing Plato Book VII...',
      usage: { inputTokens: 15, outputTokens: 40, totalTokens: 55 } as any,
      finishReason: 'stop',
    });

    const assistantInsert = insertedValues.find(
      (values) => values.role === 'assistant',
    );

    expect(assistantInsert).toMatchObject({
      content: 'The cave represents human perception...',
      reasoning: 'Analyzing Plato Book VII...',
      parts: [
        { type: 'reasoning', text: 'Analyzing Plato Book VII...' },
        { type: 'text', text: 'The cave represents human perception...' },
      ],
      metadata: expect.objectContaining({
        modelId: 'openai/gpt-5.6-sol',
        finishReason: 'stop',
        usage: { inputTokens: 15, outputTokens: 40, totalTokens: 55 },
      }),
    });
  });

  it('verifies citations against the retrieved Evidence before persisting them', async () => {
    retrieve.mockResolvedValue(
      retrievalOk({
        chunks: [
          {
            chunkId: 'chunk-1',
            chunkIndex: 0,
            sourceId: 'source-1',
            title: 'Cell Biology Lecture Notes',
            content:
              'Osmosis is the net movement of water molecules across a selectively permeable membrane. The osmotic pressure depends on the solute gradient.',
            sectionPath: ['Chapter 1', 'Membranes'],
            score: 0.8,
            url: null,
            kind: 'text',
            sourceVersionId: null,
            locator: { pageNumber: 12 },
          },
        ],
        abstained: false,
        abstentionReason: null,
        unhelpfulSources: [],
      }),
    );

    await service.sendMessage('notebook-1', {
      content: 'Explain osmosis',
      model: 'openai/gpt-5.6-sol',
    });

    const streamOptions = mocks.streamText.mock.calls[0][0] as {
      onEnd: (event: { text: string; finishReason?: string }) => Promise<void>;
    };
    await streamOptions.onEnd({
      text: 'The osmotic pressure depends on the solute gradient. [ref:R1] Osmosis moves water across a membrane. [ref:R9]',
      finishReason: 'stop',
    });

    const assistantInsert = insertedValues.find(
      (values) => values.role === 'assistant',
    );
    expect(assistantInsert?.citedSourceIds).toEqual([
      expect.objectContaining({
        citationKey: 'R1',
        chunkId: 'chunk-1',
        locator: { pageNumber: 12 },
        quote: 'The osmotic pressure depends on the solute gradient.',
        attribution: 'explicit',
      }),
    ]);
    expect(assistantInsert?.metadata).toMatchObject({
      citationCheck: { resolved: 1, attributed: 0, dropped: 1 },
    });
  });

  it('does not attribute an unmarked claim to evidence on persist (suppresses phantom citations)', async () => {
    retrieve.mockResolvedValue(
      retrievalOk({
        chunks: [
          {
            chunkId: 'chunk-1',
            chunkIndex: 0,
            sourceId: 'source-1',
            title: 'Cell Biology Lecture Notes',
            content:
              'Osmosis is the net movement of water molecules across a selectively permeable membrane.',
            sectionPath: [],
            score: 0.8,
            url: null,
            kind: 'text',
            sourceVersionId: null,
            locator: null,
          },
        ],
        abstained: false,
        abstentionReason: null,
        unhelpfulSources: [],
      }),
    );

    await service.sendMessage('notebook-1', {
      content: 'Explain osmosis',
      model: 'openai/gpt-5.6-sol',
    });

    const streamOptions = mocks.streamText.mock.calls[0][0] as {
      onEnd: (event: { text: string; finishReason?: string }) => Promise<void>;
    };
    await streamOptions.onEnd({
      text: 'Osmosis moves water molecules across a selectively permeable membrane.',
      finishReason: 'stop',
    });

    const assistantInsert = insertedValues.find(
      (values) => values.role === 'assistant',
    );
    expect(assistantInsert?.citedSourceIds).toEqual([]);
    expect(assistantInsert?.metadata).toMatchObject({
      citationCheck: { resolved: 0, attributed: 0, dropped: 0 },
    });
  });

  it('persists the gateway generation id for cost lookup', async () => {
    await service.sendMessage('notebook-1', {
      content: 'Explain the cave allegory',
      model: 'openai/gpt-5.6-sol',
    });

    const streamOptions = mocks.streamText.mock.calls[0][0] as {
      onLanguageModelCallEnd: (event: {
        providerMetadata?: Record<string, Record<string, unknown>>;
      }) => void;
      onEnd: (event: { text: string; finishReason?: string }) => Promise<void>;
    };

    streamOptions.onLanguageModelCallEnd({
      providerMetadata: { gateway: { generationId: 'gen_test123' } },
    });
    await streamOptions.onEnd({
      text: 'The cave represents human perception...',
      finishReason: 'stop',
    });

    const assistantInsert = insertedValues.find(
      (values) => values.role === 'assistant',
    );
    expect(assistantInsert).toMatchObject({
      metadata: expect.objectContaining({
        gatewayGenerationId: 'gen_test123',
      }),
    });
  });

  it('handles multimodal image parts in user messages', async () => {
    await service.sendMessage('notebook-1', {
      content: 'What is shown in this chart?',
      parts: [
        {
          type: 'file',
          mediaType: 'image/png',
          url: 'data:image/png;base64,iVBORw0KGgo=',
        },
        { type: 'text', text: 'What is shown in this chart?' },
      ],
      model: 'openai/gpt-5.6-sol',
    });

    expect(mocks.streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.arrayContaining([
              { type: 'text', text: 'What is shown in this chart?' },
              { type: 'image', image: 'data:image/png;base64,iVBORw0KGgo=' },
            ]),
          }),
        ]),
      }),
    );
    expect(requireCapability).toHaveBeenCalledWith(
      expect.anything(),
      'openai/gpt-5.6-sol',
      'imageInput',
      'image attachments',
    );
  });

  it('rejects unsupported image input before starting the model stream', async () => {
    requireCapability.mockImplementation(() => {
      throw new CapabilityUnsupportedError(
        "DeepSeek R1 doesn't support image attachments. Switch to a model that supports image attachments and try again.",
      );
    });

    await expect(
      service.sendMessage('notebook-1', {
        content: 'Explain this image',
        parts: [
          {
            type: 'file',
            mediaType: 'image/png',
            url: 'data:image/png;base64,iVBORw0KGgo=',
          },
        ],
        model: 'deepseek/deepseek-r1',
      }),
    ).rejects.toThrow(/doesn't support image attachments/);
    expect(mocks.streamText).not.toHaveBeenCalled();
  });

  it('handles non-image file parts in user messages', async () => {
    await service.sendMessage('notebook-1', {
      content: 'Summarize this PDF',
      parts: [
        {
          type: 'file',
          mediaType: 'application/pdf',
          url: 'https://example.com/doc.pdf',
          filename: 'doc.pdf',
        },
        { type: 'text', text: 'Summarize this PDF' },
      ],
      model: 'openai/gpt-5.6-sol',
    });

    expect(mocks.streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.arrayContaining([
              { type: 'text', text: 'Summarize this PDF' },
              {
                type: 'file',
                data: 'https://example.com/doc.pdf',
                mediaType: 'application/pdf',
                filename: 'doc.pdf',
              },
            ]),
          }),
        ]),
      }),
    );
    expect(requireCapability).toHaveBeenCalledWith(
      expect.anything(),
      'openai/gpt-5.6-sol',
      'fileInput',
      'file attachments',
    );
  });

  it('rejects unsupported file input before starting the model stream', async () => {
    requireCapability.mockImplementation(
      (_provider: unknown, _modelId: string, capability: string) => {
        if (capability === 'fileInput') {
          throw new CapabilityUnsupportedError(
            "DeepSeek R1 doesn't support file attachments. Switch to a model that supports file attachments and try again.",
          );
        }
      },
    );

    await expect(
      service.sendMessage('notebook-1', {
        content: 'Explain this document',
        parts: [
          {
            type: 'file',
            mediaType: 'application/pdf',
            url: 'https://example.com/doc.pdf',
          },
        ],
        model: 'deepseek/deepseek-r1',
      }),
    ).rejects.toThrow(/doesn't support file attachments/);
    expect(mocks.streamText).not.toHaveBeenCalled();
  });

  it('rejects file attachments without valid mediaType', async () => {
    await expect(
      service.sendMessage('notebook-1', {
        content: 'Check this file',
        parts: [
          {
            type: 'file',
            url: 'https://example.com/unknown',
          },
        ],
        model: 'openai/gpt-5.6-sol',
      }),
    ).rejects.toThrow(/mediaType is required/);
    expect(mocks.streamText).not.toHaveBeenCalled();
  });

  it('requests gateway options without any fallback model chain', async () => {
    const aiService = (service as any).aiService as {
      getGatewayRequestOptions: ReturnType<typeof vi.fn>;
    };

    await service.sendMessage('notebook-1', {
      content: 'Explain Plato',
      model: 'anthropic/claude-fable-5.1',
    });

    expect(aiService.getGatewayRequestOptions).toHaveBeenCalledWith();
    expect(aiService.getGatewayRequestOptions).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it('fails loud when the gateway serves a different model than requested', async () => {
    await service.sendMessage('notebook-1', {
      content: 'Explain Plato',
      model: 'anthropic/claude-fable-5.1',
    });

    const streamOptions = mocks.streamText.mock.calls[0][0] as {
      onLanguageModelCallEnd: (event: {
        providerMetadata?: Record<string, Record<string, unknown>>;
      }) => void;
    };

    expect(() =>
      streamOptions.onLanguageModelCallEnd({
        providerMetadata: {
          gateway: {
            generationId: 'gen_substituted',
            routing: { canonicalSlug: 'openai/gpt-4o-mini' },
          },
        },
      }),
    ).toThrow(/model_substituted/);
    expect(() =>
      streamOptions.onLanguageModelCallEnd({
        providerMetadata: {
          gateway: {
            generationId: 'gen_substituted',
            routing: { canonicalSlug: 'openai/gpt-4o-mini' },
          },
        },
      }),
    ).toThrow(/anthropic\/claude-fable-5\.1/);
  });

  it('accepts matching gateway routing metadata', async () => {
    await service.sendMessage('notebook-1', {
      content: 'Explain Plato',
      model: 'anthropic/claude-fable-5.1',
    });

    const streamOptions = mocks.streamText.mock.calls[0][0] as {
      onLanguageModelCallEnd: (event: {
        providerMetadata?: Record<string, Record<string, unknown>>;
      }) => void;
      onEnd: (event: { text: string; finishReason?: string }) => Promise<void>;
    };

    expect(() =>
      streamOptions.onLanguageModelCallEnd({
        providerMetadata: {
          gateway: {
            generationId: 'gen_matching',
            routing: { canonicalSlug: 'anthropic/claude-fable-5.1' },
          },
        },
      }),
    ).not.toThrow();
    await streamOptions.onEnd({
      text: 'Plato believed...',
      finishReason: 'stop',
    });

    const assistantInsert = insertedValues.find(
      (values) => values.role === 'assistant',
    );
    expect(assistantInsert).toMatchObject({
      metadata: expect.objectContaining({
        servedModelId: 'anthropic/claude-fable-5.1',
      }),
    });
  });

  it('maps stream failures to client envelopes naming the model', async () => {
    await service.sendMessage('notebook-1', {
      content: 'Explain Plato',
      model: 'anthropic/claude-fable-5.1',
    });

    const streamResult = mocks.streamText.mock.results[0].value as {
      toUIMessageStreamResponse: ReturnType<typeof vi.fn>;
    };
    const responseOptions = streamResult.toUIMessageStreamResponse.mock
      .calls[0][0] as { onError?: (error: unknown) => string };
    expect(typeof responseOptions.onError).toBe('function');

    const error = Object.assign(
      new Error('Free tier users do not have access'),
      { statusCode: 403 },
    );
    const parsed = JSON.parse(responseOptions.onError!(error)) as {
      error: string;
      code: string;
      model?: string;
    };
    expect(parsed.code).toBe('gateway_entitlement');
    expect(parsed.error).toContain('anthropic/claude-fable-5.1');
  });

  it('sends image-only input without embedding an empty retrieval query', async () => {
    await expect(
      service.sendMessage('notebook-1', {
        content: '',
        parts: [
          {
            type: 'file',
            mediaType: 'image/png',
            url: 'data:image/png;base64,iVBORw0KGgo=',
          },
        ],
        model: 'openai/gpt-5.6-sol',
      }),
    ).resolves.toMatchObject({ userMessageId: expect.any(String) });

    expect(retrieve).not.toHaveBeenCalled();
    expect(
      insertedValues.find((values) => values.role === 'user'),
    ).toMatchObject({ content: '', parts: [{ type: 'file' }] });
    expect(mocks.streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: [
              { type: 'image', image: 'data:image/png;base64,iVBORw0KGgo=' },
            ],
          }),
        ]),
      }),
    );
  });

  it('sends file-only input without embedding an empty retrieval query', async () => {
    await expect(
      service.sendMessage('notebook-1', {
        content: '',
        parts: [
          {
            type: 'file',
            mediaType: 'application/pdf',
            url: 'https://example.com/paper.pdf',
            filename: 'paper.pdf',
          },
        ],
        model: 'openai/gpt-5.6-sol',
      }),
    ).resolves.toMatchObject({ userMessageId: expect.any(String) });

    expect(retrieve).not.toHaveBeenCalled();
    expect(
      insertedValues.find((values) => values.role === 'user'),
    ).toMatchObject({ content: '', parts: [{ type: 'file' }] });
    expect(mocks.streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: [
              {
                type: 'file',
                data: 'https://example.com/paper.pdf',
                mediaType: 'application/pdf',
                filename: 'paper.pdf',
              },
            ],
          }),
        ]),
      }),
    );
  });
});

describe('ChatService no-evidence reply', () => {
  let service: ChatService;
  let insertedValues: Record<string, unknown>[];
  let retrieve: ReturnType<typeof vi.fn>;
  let harness: Awaited<ReturnType<typeof createChatServiceHarness>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    harness = await createChatServiceHarness();
    service = harness.service;
    insertedValues = harness.insertedValues;
    retrieve = harness.retrieve;
  });

  it('answers with a no-evidence reply instead of the model when retrieval abstains', async () => {
    retrieve.mockResolvedValue(
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

    const response = await service.sendMessage('notebook-1', {
      content: 'Explain Plato',
      model: 'openai/gpt-5.6-sol',
    });

    expect(mocks.streamText).not.toHaveBeenCalled();
    const assistantInsert = insertedValues.find(
      (values) => values.role === 'assistant',
    );
    expect(assistantInsert).toMatchObject({
      citedSourceIds: [],
      metadata: expect.objectContaining({
        finishReason: 'no_evidence',
        noEvidence: expect.objectContaining({
          abstentionReason: 'below_threshold',
          unhelpfulSources: [{ id: 'source-9', title: 'Lecture notes' }],
        }),
      }),
    });
    expect(assistantInsert?.content).toContain(
      'could not find usable material',
    );
    expect(assistantInsert?.content).toContain('Lecture notes');
    expect(response.userMessageId).toEqual(expect.any(String));
    expect(harness.recordTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        notebookId: 'notebook-1',
        kind: 'chat',
        trace: expect.objectContaining({ abstained: true }),
      }),
    );
  });

  it('clears chat retrieval traces together with the chat history', async () => {
    await service.clearMessages('notebook-1');

    expect(harness.clearChatTraces).toHaveBeenCalledWith('notebook-1');
  });

  it('names degraded sources with their quality reason in the no-evidence reply', async () => {
    harness.degradedSourceRows = [
      {
        id: 'source-1',
        title: 'Beyond Good and Evil Summary',
        kind: 'url',
        processingErrorCode: 'quality_navigation',
      },
    ];
    retrieve.mockResolvedValue(
      retrievalOk(
        {
          chunks: [],
          abstained: true,
          abstentionReason: 'no_indexed_chunks',
          unhelpfulSources: [],
        },
        { abstained: true, abstentionReason: 'no_indexed_chunks' },
      ),
    );

    await service.sendMessage('notebook-1', {
      content: 'Summarize chapter 3',
      model: 'openai/gpt-5.6-sol',
    });

    const assistantInsert = insertedValues.find(
      (values) => values.role === 'assistant',
    );
    expect(assistantInsert).toMatchObject({
      metadata: expect.objectContaining({
        noEvidence: expect.objectContaining({
          abstentionReason: 'no_indexed_chunks',
          degradedSources: [
            {
              id: 'source-1',
              title: 'Beyond Good and Evil Summary',
              reason: 'navigation',
            },
          ],
        }),
      }),
    });
    expect(assistantInsert?.content).toContain('Beyond Good and Evil Summary');
    expect(assistantInsert?.content).toContain('links or navigation');
  });

  it('still streams through the model when retrieval returns Evidence', async () => {
    retrieve.mockResolvedValue(
      retrievalOk({
        chunks: [
          {
            chunkId: 'chunk-1',
            chunkIndex: 0,
            sourceId: 'source-1',
            title: 'Lecture notes',
            content: 'Justice is harmony.',
            score: 0.8,
            url: null,
            kind: 'text',
            sourceVersionId: null,
            locator: null,
          },
        ],
        abstained: false,
        abstentionReason: null,
        unhelpfulSources: [],
      }),
    );

    await service.sendMessage('notebook-1', {
      content: 'Explain Plato',
      model: 'openai/gpt-5.6-sol',
    });

    expect(mocks.streamText).toHaveBeenCalledOnce();
    const streamOptions = mocks.streamText.mock.calls[0][0] as {
      instructions: string;
    };
    expect(streamOptions.instructions).toContain('Justice is harmony.');
  });

  it('streams Evidence only, never below-floor candidates, to the model', async () => {
    retrieve.mockResolvedValue(
      retrievalOk({
        chunks: [
          {
            chunkId: 'chunk-1',
            chunkIndex: 0,
            sourceId: 'source-1',
            title: 'Lecture notes',
            content: 'Justice is harmony.',
            score: 0.8,
            url: null,
            kind: 'text',
            sourceVersionId: null,
            locator: null,
          },
        ],
        abstained: false,
        abstentionReason: null,
        unhelpfulSources: [
          { id: 'source-2', title: 'Nav page', kind: 'url', url: null },
        ],
      }),
    );

    await service.sendMessage('notebook-1', {
      content: 'Explain Plato',
      model: 'openai/gpt-5.6-sol',
    });

    const streamOptions = mocks.streamText.mock.calls[0][0] as {
      instructions: string;
    };
    expect(streamOptions.instructions).toContain('Justice is harmony.');
    expect(streamOptions.instructions).not.toContain('Nav page');
  });

  it('does not character-slice the assembled Evidence block', async () => {
    // Longer than the old 80,000-character slice: the token budget bounds
    // retrieval, so the Chat renders the assembled block whole.
    const tail = 'THE-TAIL-MARKER';
    const content = `${'alpha '.repeat(20000)}${tail}`;
    retrieve.mockResolvedValue(
      retrievalOk({
        chunks: [
          {
            chunkId: 'chunk-1',
            chunkIndex: 0,
            sourceId: 'source-1',
            title: 'Long source',
            content,
            sectionPath: [],
            score: 0.8,
            url: null,
            kind: 'text',
            sourceVersionId: null,
            locator: null,
          },
        ],
        abstained: false,
        abstentionReason: null,
        unhelpfulSources: [],
      }),
    );

    await service.sendMessage('notebook-1', {
      content: 'Explain the long source',
      model: 'openai/gpt-5.6-sol',
    });

    const streamOptions = mocks.streamText.mock.calls[0][0] as {
      instructions: string;
    };
    expect(streamOptions.instructions.length).toBeGreaterThan(80000);
    expect(streamOptions.instructions).toContain(tail);
  });

  it('renders the assembled section context in the model Evidence block', async () => {
    retrieve.mockResolvedValue(
      retrievalOk({
        chunks: [
          {
            chunkId: 'chunk-1',
            chunkIndex: 0,
            sourceId: 'source-1',
            title: 'Organic Chemistry Laboratory Manual',
            content:
              'Heat the round-bottom flask slowly and collect the fraction that boils.',
            sectionPath: ['Experiment 3', 'Fractional Distillation'],
            score: 0.8,
            url: null,
            kind: 'file',
            sourceVersionId: null,
            locator: { pageNumber: 12 },
          },
        ],
        abstained: false,
        abstentionReason: null,
        unhelpfulSources: [],
      }),
    );

    await service.sendMessage('notebook-1', {
      content: 'Explain the distillation experiment',
      model: 'openai/gpt-5.6-sol',
    });

    const streamOptions = mocks.streamText.mock.calls[0][0] as {
      instructions: string;
    };
    expect(streamOptions.instructions).toContain(
      'Section: Experiment 3 > Fractional Distillation',
    );
    expect(streamOptions.instructions).toContain('Heat the round-bottom flask');
    expect(streamOptions.instructions).not.toMatch(/Relevance/);
  });
});
