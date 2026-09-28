import { Test } from '@nestjs/testing';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { AiService } from '../src/modules/ai/ai.service';
import { ConnectionService } from '../src/modules/ai/connection.service';
import { RetrievalService } from '../src/modules/ai/retrieval.service';
import { RetrievalTraceService } from '../src/modules/ai/retrieval-trace.service';
import {
  generationRequests,
  notebookChatMessages,
  notebooks,
  retrievalTraces,
} from '../src/database/schema';
import { ChatService } from '../src/modules/chat/chat.service';
import { DRIZZLE } from '../src/modules/database/database.module';
import { NotebooksService } from '../src/modules/notebooks/notebooks.service';
import { GenerationService } from '../src/modules/study-materials/generation.service';
import { GenerationRequestManager } from '../src/modules/study-materials/generation-request-manager';
import { StorageService } from '../src/modules/storage/storage.service';
import { db } from './db';
import { seedNotebook } from './fixtures';

const mocks = vi.hoisted(() => ({
  streamText: vi.fn(),
}));

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return { ...actual, streamText: mocks.streamText };
});

function baseTrace(query = 'Explain Plato') {
  return {
    version: 5 as const,
    query,
    topK: 8,
    scope: { kind: 'notebook' as const, sourceIds: null },
    relevanceFloor: 0.3,
    embedding: { model: 'voyage-4', dimensions: 1024 },
    rewrite: null,
    legs: [],
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
}

function notebooksService() {
  const mockConfig = {
    get: (key: string) =>
      key === 'DEV_STORAGE_TOKEN_SECRET' ? 'dev-storage-secret-test' : undefined,
  } as any;
  return new NotebooksService(db as any, new StorageService(mockConfig));
}

describe('Grounding Mode persistence contract (#98)', () => {
  it('notebooks default to strict and are readable/updatable via the service', async () => {
    const service = notebooksService();

    const created = await service.create({ title: 'Grounding notebook' });
    expect(created.groundingMode).toBe('strict');

    const fetched = await service.get(created.id);
    expect(fetched.groundingMode).toBe('strict');
    expect(await service.getGroundingMode(created.id)).toBe('strict');

    const updated = await service.update(created.id, {
      groundingMode: 'moderate',
    });
    expect(updated.groundingMode).toBe('moderate');
    expect(await service.getGroundingMode(created.id)).toBe('moderate');

    const freed = await service.update(created.id, { groundingMode: 'free' });
    expect(freed.groundingMode).toBe('free');

    const [row] = await db
      .select({ groundingMode: notebooks.groundingMode })
      .from(notebooks)
      .where(eq(notebooks.id, created.id));
    expect(row.groundingMode).toBe('free');
  });

  it('creation accepts an explicit mode', async () => {
    const service = notebooksService();
    const created = await service.create({
      title: 'Explicit mode',
      groundingMode: 'free',
    });
    expect(created.groundingMode).toBe('free');
  });

  it('retrieval traces persist the mode they answered with', async () => {
    const notebook = await seedNotebook();
    const service = new RetrievalTraceService(db as never);

    await service.record({
      notebookId: notebook.id,
      kind: 'chat',
      chatMessageId: 'assistant-1',
      groundingMode: 'moderate',
      trace: baseTrace(),
    });

    const rows = await db.select().from(retrievalTraces);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      groundingMode: 'moderate',
      chatMessageId: 'assistant-1',
    });
  });

  it('generation requests persist the mode they answered with', async () => {
    const notebook = await seedNotebook();
    const manager = new GenerationRequestManager(db as never);

    const defaultId = await manager.create(notebook.id, {
      kind: 'quiz',
      brief: 'Cell biology',
      sourceIds: [],
    });
    const overrideId = await manager.create(notebook.id, {
      kind: 'quiz',
      brief: 'Cell biology',
      sourceIds: [],
      groundingMode: 'free',
    });

    const rows = await db.select().from(generationRequests);
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get(defaultId)).toMatchObject({ groundingMode: 'strict' });
    expect(byId.get(overrideId)).toMatchObject({ groundingMode: 'free' });
  });
});

async function chatHarness(notebookMode: string) {
  const inserted: Record<string, any>[] = [];
  const dbMock = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn().mockResolvedValue([]),
          then: Promise.resolve([]).then.bind(Promise.resolve([])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, any>) => {
        inserted.push(values);
        return {
          returning: vi.fn().mockResolvedValue([
            {
              id: values.id || 'user-1',
              role: values.role || 'user',
              content: values.content || 'Explain Plato',
              parts: values.parts || null,
              createdAt: new Date(),
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
    createModel: vi.fn(() => ({})),
  };
  mocks.streamText.mockReturnValue({
    toUIMessageStreamResponse: vi.fn(() => new Response()),
  });
  const retrieve = vi.fn().mockResolvedValue({
    chunks: [],
    abstained: false,
    abstentionReason: null,
    unhelpfulSources: [],
    trace: baseTrace(),
  });
  const recordTrace = vi.fn().mockResolvedValue(undefined);

  const module = await Test.createTestingModule({
    providers: [
      ChatService,
      { provide: DRIZZLE, useValue: dbMock },
      {
        provide: NotebooksService,
        useValue: {
          assertNotebookOwner: vi.fn().mockResolvedValue(undefined),
          getGroundingMode: vi.fn().mockResolvedValue(notebookMode),
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
      { provide: RetrievalService, useValue: { retrieve } },
      {
        provide: RetrievalTraceService,
        useValue: { record: recordTrace, clearChatTraces: vi.fn() },
      },
    ],
  }).compile();

  return {
    service: module.get(ChatService),
    inserted,
    retrieve,
    recordTrace,
  };
}

describe('Chat grounding mode override', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to the notebook mode when no override is sent', async () => {
    const harness = await chatHarness('moderate');
    await harness.service.sendMessage('notebook-1', {
      content: 'Explain Plato',
      model: 'openai/gpt-5.6-sol',
    });

    expect(harness.recordTrace).toHaveBeenCalledWith(
      expect.objectContaining({ groundingMode: 'moderate' }),
    );

    const streamOptions = mocks.streamText.mock.calls[0][0] as {
      onEnd: (e: { text: string; finishReason?: string }) => Promise<void>;
    };
    await streamOptions.onEnd({ text: 'Plato believed...', finishReason: 'stop' });
    const assistant = harness.inserted.find((v) => v.role === 'assistant');
    expect(assistant).toMatchObject({
      groundingMode: 'moderate',
      metadata: expect.objectContaining({ groundingMode: 'moderate' }),
    });
  });

  it('prefers the per-request override over the notebook value', async () => {
    const harness = await chatHarness('strict');
    await harness.service.sendMessage('notebook-1', {
      content: 'Explain Plato',
      model: 'openai/gpt-5.6-sol',
      groundingMode: 'free',
    });

    expect(harness.recordTrace).toHaveBeenCalledWith(
      expect.objectContaining({ groundingMode: 'free' }),
    );
    const streamOptions = mocks.streamText.mock.calls[0][0] as {
      onEnd: (e: { text: string; finishReason?: string }) => Promise<void>;
    };
    await streamOptions.onEnd({ text: 'Plato believed...', finishReason: 'stop' });
    const assistant = harness.inserted.find((v) => v.role === 'assistant');
    expect(assistant).toMatchObject({ groundingMode: 'free' });
  });

  it('chat list exposes the persisted mode per message', async () => {
    const notebook = await seedNotebook();
    const [row] = await db
      .insert(notebookChatMessages)
      .values({
        notebookId: notebook.id,
        role: 'assistant',
        content: 'Plato believed...',
        groundingMode: 'free',
        metadata: { modelId: 'openai/gpt-5.6-sol', groundingMode: 'free' },
        citedSourceIds: [],
      })
      .returning();

    expect(row.groundingMode).toBe('free');

    const service = new ChatService(
      db as never,
      notebooksService() as never,
      {} as never,
      {} as never,
      {} as never,
      new RetrievalTraceService(db as never),
    );
    const messages = await service.listMessages(notebook.id);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ groundingMode: 'free' });
  });
});

describe('Generation grounding mode override', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function generationSetup(notebookMode: string) {
    const notebooksServiceMock = {
      assertNotebookOwner: vi.fn(async () => undefined),
      getGroundingMode: vi.fn(async () => notebookMode),
    };
    const connectionService = { requireConnected: vi.fn(async () => undefined) };
    const requestManager = {
      get: vi.fn(async () => undefined),
      create: vi.fn(async () => 'request-1'),
      cancel: vi.fn(async () => undefined),
    };
    const streamHandler = {
      createStream: vi.fn(() => ({ stream: new ReadableStream() })),
    };
    const ground: ReturnType<typeof vi.fn> = vi.fn(async () => ({
      sources: [],
      evidence: [],
      unavailableSources: [],
      degradedSources: [],
      traces: [],
    }));
    const recordTrace = vi.fn(async () => undefined);
    const provider = {
      listModels: () => [
        {
          id: 'openai/gpt-5.6-sol',
          displayName: 'GPT',
          capabilities: { structuredOutput: true },
        },
      ],
      createModel: vi.fn(() => ({})),
    };
    const aiService = {
      getProviderForModel: vi.fn(async () => provider),
      requireStructuredOutput: vi.fn(),
    };
    const service = new GenerationService(
      notebooksServiceMock as never,
      connectionService as never,
      requestManager as never,
      streamHandler as never,
      { ground } as never,
      { record: recordTrace } as never,
      aiService as never,
    );
    return { service, requestManager, recordTrace, ground };
  }

  it('falls back to the notebook mode and persists it on the request', async () => {
    const { service, requestManager } = generationSetup('moderate');
    await service.generate('notebook-1', {
      kind: 'study_guide',
      brief: 'Cell biology',
      sourceIds: [],
    });
    expect(requestManager.create).toHaveBeenCalledWith(
      'notebook-1',
      expect.objectContaining({ groundingMode: 'moderate' }),
    );
  });

  it('prefers the per-request override', async () => {
    const { service, requestManager } = generationSetup('strict');
    await service.generate('notebook-1', {
      kind: 'study_guide',
      brief: 'Cell biology',
      sourceIds: [],
      groundingMode: 'free',
    });
    expect(requestManager.create).toHaveBeenCalledWith(
      'notebook-1',
      expect.objectContaining({ groundingMode: 'free' }),
    );
  });

  it('records generation traces with the resolved mode', async () => {
    const { service, recordTrace, ground } = generationSetup('strict');
    ground.mockResolvedValue({
      sources: [],
      evidence: [],
      unavailableSources: [{ id: 's1', title: 'S1', kind: 'text' }],
      degradedSources: [],
      traces: [baseTrace('Cell biology')],
    });
    await expect(
      service.generate('notebook-1', {
        kind: 'quiz',
        brief: 'Cell biology',
        sourceIds: ['s1'],
        groundingMode: 'moderate',
      }),
    ).rejects.toMatchObject({ code: 'bad_request' });
    expect(recordTrace).toHaveBeenCalledWith(
      expect.objectContaining({ groundingMode: 'moderate' }),
    );
  });
});
