import { describe, expect, it } from 'vitest';
import { retrievalTraces } from '../src/database/schema';
import { RetrievalTraceService } from '../src/modules/ai/retrieval-trace.service';
import type { RetrievalTrace } from '../src/modules/ai/retrieval-trace';
import { db } from './db';
import { seedNotebook } from './fixtures';

function trace(overrides: Partial<RetrievalTrace> = {}): RetrievalTrace {
  return {
    version: 4,
    query: 'Explain osmosis',
    topK: 8,
    scope: { kind: 'notebook', sourceIds: null },
    relevanceFloor: 0.3,
    embedding: { model: 'voyage-4', dimensions: 1024 },
    rewrite: {
      enabled: true,
      original: 'Explain osmosis',
      query: 'Explain osmosis',
      variants: [],
      hypotheticalAnswer: false,
      trigger: null,
      strategy: null,
      reason: 'search_ready',
      model: 'openai/gpt-4o-mini',
    },
    legs: [
      {
        kind: 'dense',
        variant: 0,
        candidates: [
          {
            chunkId: 'chunk-1',
            sourceId: 'source-1',
            chunkIndex: 0,
            score: 0.72,
            rank: 1,
          },
        ],
      },
      {
        kind: 'lexical',
        variant: 0,
        candidates: [
          {
            chunkId: 'chunk-1',
            sourceId: 'source-1',
            chunkIndex: 0,
            score: 0.31,
            rank: 1,
          },
        ],
      },
    ],
    fusion: {
      k: 60,
      weights: { dense: 1, lexical: 1 },
      depths: { dense: 32, lexical: 32 },
      variants: 1,
    },
    fusedOrder: [
      {
        chunkId: 'chunk-1',
        sourceId: 'source-1',
        chunkIndex: 0,
        score: 0.0325,
        rank: 1,
      },
    ],
    rerank: {
      model: 'rerank-2.5',
      applied: true,
      skippedReason: null,
      threshold: 0.4,
      candidates: [
        {
          chunkId: 'chunk-1',
          sourceId: 'source-1',
          chunkIndex: 0,
          score: 0.72,
          rank: 1,
          rerankScore: 0.91,
        },
      ],
      inputTokens: 64,
    },
    chosen: [
      {
        chunkId: 'chunk-1',
        sourceId: 'source-1',
        chunkIndex: 0,
        score: 0.0325,
        rank: 1,
      },
    ],
    abstained: false,
    abstentionReason: null,
    latencyMs: 42,
    cost: {
      embeddingInputTokens: 5,
      rerankInputTokens: 64,
      rewriteInputTokens: 0,
      rewriteOutputTokens: 0,
    },
    ...overrides,
  };
}

describe('RetrievalTraceService', () => {
  it('persists a chat trace with its correlation id, latency and token cost', async () => {
    const notebook = await seedNotebook();
    const service = new RetrievalTraceService(db as never);

    await service.record({
      notebookId: notebook.id,
      kind: 'chat',
      chatMessageId: 'assistant-message-1',
      trace: trace(),
    });

    const rows = await db.select().from(retrievalTraces);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      notebookId: notebook.id,
      kind: 'chat',
      chatMessageId: 'assistant-message-1',
      generationRequestId: null,
      query: 'Explain osmosis',
      latencyMs: 42,
      embeddingInputTokens: 5,
    });
    expect(rows[0].trace).toEqual(trace());
  });

  it('persists a generation trace against its request id without provider secrets', async () => {
    const notebook = await seedNotebook();
    const service = new RetrievalTraceService(db as never);

    await service.record({
      notebookId: notebook.id,
      kind: 'generation',
      generationRequestId: 'request-1',
      trace: trace({
        query: 'Cell biology',
        scope: { kind: 'selected_sources', sourceIds: ['source-1'] },
        relevanceFloor: 0,
      }),
    });

    const [row] = await db.select().from(retrievalTraces);
    expect(row).toMatchObject({
      kind: 'generation',
      chatMessageId: null,
      generationRequestId: 'request-1',
    });
    const serialized = JSON.stringify(row.trace);
    expect(serialized).not.toMatch(/api[_-]?key|authorization|bearer|secret/i);
    expect(serialized).not.toContain('"embedding":[');
  });

  it('clears chat traces but keeps generation traces when the chat history is cleared', async () => {
    const notebook = await seedNotebook();
    const service = new RetrievalTraceService(db as never);

    await service.record({
      notebookId: notebook.id,
      kind: 'chat',
      chatMessageId: 'assistant-message-1',
      trace: trace(),
    });
    await service.record({
      notebookId: notebook.id,
      kind: 'generation',
      generationRequestId: 'request-1',
      trace: trace({ query: 'Cell biology' }),
    });

    await service.clearChatTraces(notebook.id);

    const rows = await db.select().from(retrievalTraces);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('generation');
  });
});
