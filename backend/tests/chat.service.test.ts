import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiService } from '../src/modules/ai/ai.service';
import { CapabilityUnsupportedError } from '../src/common/errors/domain-error';
import { ConnectionService } from '../src/modules/ai/connection.service';
import { RetrievalService } from '../src/modules/ai/retrieval.service';
import { RetrievalTraceService } from '../src/modules/ai/retrieval-trace.service';
import { ChatService } from '../src/modules/chat/chat.service';
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
  version: 3,
  query: 'Explain Plato',
  topK: 8,
  scope: { kind: 'notebook', sourceIds: null },
  relevanceFloor: 0.3,
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
    threshold: 0.4,
    candidates: [],
    inputTokens: 0,
  },
  chosen: [],
  abstained: false,
  abstentionReason: null,
  latencyMs: 8,
  cost: { embeddingInputTokens: 3, rerankInputTokens: 0 },
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

  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => {
          const rows = Promise.resolve(degradedRowsState.rows);
          return {
            orderBy: vi.fn().mockResolvedValue([]),
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
    set degradedSourceRows(rows: Record<string, unknown>[]) {
      degradedRowsState.rows = rows;
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
    });
    expect(recordTrace).toHaveBeenCalledWith({
      notebookId: 'notebook-1',
      kind: 'chat',
      chatMessageId: responseOptions.generateMessageId(),
      trace: expect.objectContaining({ query: 'Explain Plato' }),
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
});
