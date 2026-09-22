import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';
import { AiModule } from '../src/modules/ai/ai.module';
import { MAX_RERANK_DOCUMENTS } from '../src/modules/ai/providers/voyage.client';
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EmbeddingService,
} from '../src/modules/ai/embedding.service';
import { sourceChunks } from '../src/database/schema';
import {
  DRIZZLE,
  DatabaseModule,
  PG_POOL,
} from '../src/modules/database/database.module';
import {
  DEFAULT_CANDIDATE_DEPTH,
  DEFAULT_FUSION_K,
  DEFAULT_HYBRID_CONFIG,
  DEFAULT_RERANK_CONFIG,
  DEFAULT_RERANK_MODEL,
  DEFAULT_RERANK_THRESHOLD,
  DEFAULT_RELEVANCE_FLOOR,
  DEFAULT_TOP_K,
  RetrievalService,
  RETRIEVAL_RERANK_CONFIG,
  RETRIEVAL_RELEVANCE_CONFIG,
  loadRetrievalHybridConfig,
  loadRetrievalRerankConfig,
  loadRetrievalRelevanceConfig,
  type CitationLocator,
  type RetrievalHybridConfig,
  type RetrievalRerankConfig,
} from '../src/modules/ai/retrieval.service';
import { db } from './db';
import { seedNotebook, seedSource } from './fixtures';

function serviceWithRows(
  rows: Record<string, unknown>[],
  config?: { relevanceFloor: number },
  rerank?: { config?: Partial<RetrievalRerankConfig>; reranker?: unknown },
  hybrid?: {
    config?: Partial<RetrievalHybridConfig>;
    /** Rows the lexical leg returns; defaults to the dense rows. */
    lexicalRows?: Record<string, unknown>[];
  },
) {
  // The first leg searched is always the dense leg, so the scripted rows
  // describe it; the lexical leg returns `lexicalRows` when one is given.
  const execute = vi
    .fn()
    .mockResolvedValueOnce({ rows })
    .mockResolvedValueOnce({ rows: hybrid?.lexicalRows ?? rows });
  const service = new RetrievalService(
    { execute } as never,
    fakeEmbeddingService(vi.fn().mockResolvedValue([0.1, 0.2])),
    config,
    rerank?.config ? { ...DEFAULT_RERANK_CONFIG, ...rerank.config } : undefined,
    rerank?.reranker as never,
    hybrid?.config ? { ...DEFAULT_HYBRID_CONFIG, ...hybrid.config } : undefined,
  );
  return { service, execute };
}

/** The fused score of a candidate both mocked legs rank at `rank`. */
function fusedFromBothLegs(rank: number): number {
  return 1 / (DEFAULT_FUSION_K + rank) + 1 / (DEFAULT_FUSION_K + rank);
}

/** A scripted reranker: `scores` are keyed by the document's request index. */
function scriptedReranker(
  scores: Record<number, number>,
  inputTokens = 42,
): { rerank: ReturnType<typeof vi.fn> } {
  return {
    rerank: vi.fn(async (request: { documents: string[] }) => ({
      candidates: request.documents.map((_document, index) => ({
        index,
        relevanceScore: scores[index] ?? 0,
      })),
      inputTokens,
    })),
  };
}

function chunkRow(overrides: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {
    chunk_id: 'chunk-1',
    chunk_index: 0,
    source_id: 'source-1',
    title: 'Lecture notes',
    url: null,
    kind: 'file',
    source_version_id: 'version-4',
    locator: null,
    content: 'The derivative measures instantaneous change.',
    score: 0.9,
    ...overrides,
  };
  // The reranker scores the contextual searchable text; the mock rows use
  // the body unless a test overrides the searchable text explicitly.
  return { ...row, searchable_text: overrides.searchable_text ?? row.content };
}

/** The embedding seam retrieval uses: query embedding plus its model name. */
function fakeEmbeddingService(embedQuery: (text: string) => Promise<number[]>) {
  return { embedQuery, queryEmbeddingModel: () => EMBEDDING_MODEL } as never;
}

describe('RetrievalService citation locations', () => {
  it('returns source version and locator metadata with each retrieved chunk', async () => {
    const { service } = serviceWithRows([
      chunkRow({
        chunk_index: 2,
        locator: { pageNumber: 7 } satisfies CitationLocator,
        content: 'The derivative measures instantaneous change.',
        score: 0.93,
      }),
    ]);

    const result = await service.retrieve({
      notebookId: 'notebook-1',
      query: 'derivative',
    });

    expect(result.chunks).toEqual([
      {
        chunkId: 'chunk-1',
        chunkIndex: 2,
        sourceId: 'source-1',
        title: 'Lecture notes',
        content: 'The derivative measures instantaneous change.',
        score: 0.93,
        url: null,
        kind: 'file',
        sourceVersionId: 'version-4',
        locator: { pageNumber: 7 },
      },
    ]);
    expect(result.abstained).toBe(false);
    expect(result.abstentionReason).toBeNull();
  });

  it('maps legacy chunks with missing location metadata to nulls', async () => {
    const { service } = serviceWithRows([
      chunkRow({
        chunk_id: 'chunk-legacy',
        source_id: 'source-legacy',
        title: 'Legacy source',
        kind: 'text',
        content: 'Legacy content',
        score: 0.4,
        source_version_id: null,
        locator: null,
      }),
    ]);

    const [chunk] = (
      await service.retrieve({ notebookId: 'notebook-1', query: 'legacy' })
    ).chunks;
    expect(chunk.sourceVersionId).toBeNull();
    expect(chunk.locator).toBeNull();
  });

  it('never returns chunks from a degraded source as Evidence', async () => {
    const notebook = await seedNotebook();
    const ready = await seedSource(notebook.id, {
      kind: 'text',
      title: 'Ready source',
      rawText: 'Substantive ready content',
      processingStatus: 'ready',
    });
    const degraded = await seedSource(notebook.id, {
      kind: 'url',
      title: 'Navigation-only source',
      rawText: 'Chapter 1 Chapter 2 Chapter 3',
      processingStatus: 'degraded',
    });

    const embedding = Array.from({ length: 1024 }, () => 0.01);
    await db.insert(sourceChunks).values([
      {
        id: 'chunk-ready-1',
        sourceId: ready.id,
        notebookId: notebook.id,
        sourceKind: 'text',
        chunkIndex: 0,
        content: 'Substantive ready content',
        searchableText: 'Substantive ready content',
        embedding,
      },
      {
        id: 'chunk-degraded-1',
        sourceId: degraded.id,
        notebookId: notebook.id,
        sourceKind: 'url',
        chunkIndex: 0,
        content: 'Chapter 1 Chapter 2 Chapter 3',
        searchableText: 'Chapter 1 Chapter 2 Chapter 3',
        embedding,
      },
    ]);

    const service = new RetrievalService(
      db,
      fakeEmbeddingService(vi.fn().mockResolvedValue(embedding)),
    );

    const result = await service.retrieve({
      notebookId: notebook.id,
      query: 'content',
    });

    expect(result.chunks.map((chunk) => chunk.chunkId)).toEqual([
      'chunk-ready-1',
    ]);
  });
});

describe('RetrievalService retrieval trace', () => {
  it('records the query, ranked candidates, fused order, chosen chunks, threshold, latency and cost', async () => {
    const { service } = serviceWithRows([
      chunkRow({ chunk_id: 'chunk-good', score: 0.72 }),
      chunkRow({
        chunk_id: 'chunk-weak',
        content: 'Unrelated passage',
        score: 0.11,
        source_id: 'source-2',
        title: 'Other source',
        kind: 'url',
      }),
    ]);

    const outcome = await service.retrieve({
      notebookId: 'notebook-1',
      query: 'derivative',
      topK: 5,
    });

    expect(outcome.trace).toMatchObject({
      version: 3,
      query: 'derivative',
      topK: 5,
      scope: { kind: 'notebook', sourceIds: null },
      relevanceFloor: DEFAULT_RELEVANCE_FLOOR,
      embedding: { model: EMBEDDING_MODEL, dimensions: EMBEDDING_DIMENSIONS },
      fusion: {
        k: DEFAULT_FUSION_K,
        weights: { dense: 1, lexical: 1 },
        depths: {
          dense: DEFAULT_CANDIDATE_DEPTH,
          lexical: DEFAULT_CANDIDATE_DEPTH,
        },
      },
      rerank: {
        model: DEFAULT_RERANK_MODEL,
        applied: false,
        skippedReason: 'unavailable',
        threshold: DEFAULT_RERANK_THRESHOLD,
        candidates: [],
        inputTokens: 0,
      },
      abstained: false,
      abstentionReason: null,
    });
    expect(outcome.trace.legs).toEqual([
      {
        kind: 'dense',
        candidates: [
          {
            chunkId: 'chunk-good',
            sourceId: 'source-1',
            chunkIndex: 0,
            score: 0.72,
            rank: 1,
          },
          {
            chunkId: 'chunk-weak',
            sourceId: 'source-2',
            chunkIndex: 0,
            score: 0.11,
            rank: 2,
          },
        ],
      },
      {
        kind: 'lexical',
        candidates: [
          {
            chunkId: 'chunk-good',
            sourceId: 'source-1',
            chunkIndex: 0,
            score: 0.72,
            rank: 1,
          },
          {
            chunkId: 'chunk-weak',
            sourceId: 'source-2',
            chunkIndex: 0,
            score: 0.11,
            rank: 2,
          },
        ],
      },
    ]);
    // Both legs rank the same candidates, so the RRF contributions add up.
    expect(outcome.trace.fusedOrder).toEqual([
      {
        chunkId: 'chunk-good',
        sourceId: 'source-1',
        chunkIndex: 0,
        score: fusedFromBothLegs(1),
        rank: 1,
      },
      {
        chunkId: 'chunk-weak',
        sourceId: 'source-2',
        chunkIndex: 0,
        score: fusedFromBothLegs(2),
        rank: 2,
      },
    ]);
    expect(outcome.trace.chosen.map((candidate) => candidate.chunkId)).toEqual([
      'chunk-good',
    ]);
    expect(outcome.trace.latencyMs).toBeGreaterThanOrEqual(0);
    expect(outcome.trace.cost).toEqual({
      embeddingInputTokens: Math.ceil('derivative'.length / 4),
      rerankInputTokens: 0,
    });
  });

  it('marks an abstention in the trace and keeps below-floor candidates out of chosen', async () => {
    const { service } = serviceWithRows([
      chunkRow({
        chunk_id: 'chunk-nav-1',
        content: 'Chapter 1',
        score: 0.15,
        source_id: 'source-a',
        title: 'Study guide',
        kind: 'url',
      }),
    ]);

    const outcome = await service.retrieve({
      notebookId: 'notebook-1',
      query: 'beyond good and evil summary',
    });

    expect(outcome.trace.abstained).toBe(true);
    expect(outcome.trace.abstentionReason).toBe('below_threshold');
    expect(outcome.trace.chosen).toEqual([]);
    expect(outcome.trace.fusedOrder).toHaveLength(1);
  });

  it('keeps the query embedding and provider secrets out of the trace', async () => {
    const { service } = serviceWithRows([chunkRow({ score: 0.9 })]);

    const outcome = await service.retrieve({
      notebookId: 'notebook-1',
      query: 'derivative',
    });

    expect(outcome.trace.embedding).toEqual({
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
    });
    const serialized = JSON.stringify(outcome.trace);
    expect(serialized).not.toMatch(/api[_-]?key|authorization|bearer|secret/i);
    expect(serialized).not.toContain('0.1,0.2');
  });
});

describe('RetrievalService reranking', () => {
  const rerankConfig: Partial<RetrievalRerankConfig> = {
    enabled: true,
    model: 'rerank-2.5',
    candidateDepth: 32,
    threshold: 0.5,
  };

  it('reorders Evidence by the reranker while keeping the retrieval score', async () => {
    const rows = [
      chunkRow({ chunk_id: 'chunk-a', content: 'Alpha passage', score: 0.9 }),
      chunkRow({
        chunk_id: 'chunk-b',
        content: 'Beta passage',
        score: 0.8,
        source_id: 'source-2',
      }),
      chunkRow({
        chunk_id: 'chunk-c',
        content: 'Gamma passage',
        score: 0.7,
        source_id: 'source-3',
      }),
    ];
    const reranker = {
      rerank: vi.fn(async () => ({
        candidates: [
          { index: 2, relevanceScore: 0.95 },
          { index: 0, relevanceScore: 0.8 },
          { index: 1, relevanceScore: 0.6 },
        ],
        inputTokens: 120,
      })),
    };
    const { service } = serviceWithRows(rows, undefined, {
      config: rerankConfig,
      reranker,
    });

    const outcome = await service.retrieve({
      notebookId: 'notebook-1',
      query: 'passage',
    });

    expect(reranker.rerank).toHaveBeenCalledWith({
      query: 'passage',
      documents: ['Alpha passage', 'Beta passage', 'Gamma passage'],
      model: 'rerank-2.5',
    });
    expect(outcome.chunks.map((chunk) => chunk.chunkId)).toEqual([
      'chunk-c',
      'chunk-a',
      'chunk-b',
    ]);
    // Evidence keeps the dense retrieval score; the reranker score is
    // trace-only and the fused score orders the reranked trace candidates.
    expect(outcome.chunks.map((chunk) => chunk.score)).toEqual([0.7, 0.9, 0.8]);
    expect(outcome.trace.rerank).toEqual({
      model: 'rerank-2.5',
      applied: true,
      skippedReason: null,
      threshold: 0.5,
      candidates: [
        {
          chunkId: 'chunk-c',
          sourceId: 'source-3',
          chunkIndex: 0,
          score: fusedFromBothLegs(3),
          rank: 1,
          rerankScore: 0.95,
        },
        {
          chunkId: 'chunk-a',
          sourceId: 'source-1',
          chunkIndex: 0,
          score: fusedFromBothLegs(1),
          rank: 2,
          rerankScore: 0.8,
        },
        {
          chunkId: 'chunk-b',
          sourceId: 'source-2',
          chunkIndex: 0,
          score: fusedFromBothLegs(2),
          rank: 3,
          rerankScore: 0.6,
        },
      ],
      inputTokens: 120,
    });
    expect(outcome.trace.cost.rerankInputTokens).toBe(120);
    expect(outcome.trace.chosen.map((candidate) => candidate.chunkId)).toEqual([
      'chunk-c',
      'chunk-a',
      'chunk-b',
    ]);
  });

  it('drops candidates below the rerank threshold instead of padding Evidence', async () => {
    const rows = [
      chunkRow({ chunk_id: 'chunk-strong', content: 'Strong', score: 0.9 }),
      chunkRow({
        chunk_id: 'chunk-weak',
        content: 'Weak',
        score: 0.8,
        source_id: 'source-2',
        title: 'Other source',
      }),
      chunkRow({
        chunk_id: 'chunk-noise',
        content: 'Noise',
        score: 0.7,
        source_id: 'source-3',
        title: 'Noisy source',
        kind: 'url',
      }),
    ];
    const reranker = scriptedReranker({ 0: 0.9, 1: 0.2, 2: 0.1 });
    const { service } = serviceWithRows(rows, undefined, {
      config: rerankConfig,
      reranker,
    });

    const outcome = await service.retrieve({
      notebookId: 'notebook-1',
      query: 'passage',
    });

    expect(outcome.abstained).toBe(false);
    expect(outcome.chunks.map((chunk) => chunk.chunkId)).toEqual([
      'chunk-strong',
    ]);
    expect(outcome.unhelpfulSources).toEqual([
      { id: 'source-2', title: 'Other source', kind: 'file', url: null },
      { id: 'source-3', title: 'Noisy source', kind: 'url', url: null },
    ]);
    expect(outcome.trace.rerank.candidates).toHaveLength(3);
    expect(outcome.trace.chosen.map((candidate) => candidate.chunkId)).toEqual([
      'chunk-strong',
    ]);
  });

  it('bounds the reranked Evidence set with the configured top-k', async () => {
    const rows = Array.from({ length: 4 }, (_value, index) =>
      chunkRow({
        chunk_id: `chunk-${index}`,
        content: `Passage ${index}`,
        score: 0.9 - index * 0.1,
        source_id: `source-${index}`,
      }),
    );
    const reranker = scriptedReranker({ 0: 0.9, 1: 0.8, 2: 0.7, 3: 0.6 });
    const { service } = serviceWithRows(rows, undefined, {
      config: rerankConfig,
      reranker,
    });

    const outcome = await service.retrieve({
      notebookId: 'notebook-1',
      query: 'passage',
      topK: 2,
    });

    expect(outcome.chunks.map((chunk) => chunk.chunkId)).toEqual([
      'chunk-0',
      'chunk-1',
    ]);
    expect(outcome.trace.topK).toBe(2);
    expect(outcome.trace.chosen).toHaveLength(2);
    expect(outcome.trace.rerank.candidates).toHaveLength(4);
  });

  it('bounds each selected source independently after reranking', async () => {
    const rows = [
      chunkRow({ chunk_id: 'a-1', source_id: 'source-a', content: 'A one' }),
      chunkRow({ chunk_id: 'a-2', source_id: 'source-a', content: 'A two' }),
      chunkRow({ chunk_id: 'a-3', source_id: 'source-a', content: 'A three' }),
      chunkRow({ chunk_id: 'b-1', source_id: 'source-b', content: 'B one' }),
    ];
    const reranker = scriptedReranker({ 0: 0.8, 1: 0.9, 2: 0.7, 3: 0.6 });
    const { service } = serviceWithRows(rows, undefined, {
      config: rerankConfig,
      reranker,
    });

    const outcome = await service.retrieve({
      notebookId: 'notebook-1',
      query: 'passage',
      sourceIds: ['source-a', 'source-b'],
      topK: 2,
    });

    // Reranked order is a-2, a-1, a-3, b-1; the per-source bound keeps the
    // best two from source-a plus source-b's best, so a-3 is dropped.
    expect(outcome.chunks.map((chunk) => chunk.chunkId)).toEqual([
      'a-2',
      'a-1',
      'b-1',
    ]);
  });

  it('removes near-duplicate candidates before reranking', async () => {
    const rows = [
      chunkRow({
        chunk_id: 'chunk-original',
        content: 'Mitochondria generate most of the cell energy.',
      }),
      chunkRow({
        chunk_id: 'chunk-duplicate',
        content: 'Mitochondria generate most of the cell energy',
        source_id: 'source-2',
      }),
      chunkRow({
        chunk_id: 'chunk-distinct',
        content: 'Osmosis moves water across a membrane.',
        source_id: 'source-3',
      }),
    ];
    const reranker = scriptedReranker({ 0: 0.9, 1: 0.8 });
    const { service } = serviceWithRows(rows, undefined, {
      config: rerankConfig,
      reranker,
    });

    const outcome = await service.retrieve({
      notebookId: 'notebook-1',
      query: 'mitochondria',
    });

    expect(reranker.rerank).toHaveBeenCalledWith(
      expect.objectContaining({
        documents: [
          'Mitochondria generate most of the cell energy.',
          'Osmosis moves water across a membrane.',
        ],
      }),
    );
    expect(outcome.trace.legs[0].candidates).toHaveLength(3);
    expect(
      outcome.trace.fusedOrder.map((candidate) => candidate.chunkId),
    ).toEqual(['chunk-original', 'chunk-distinct']);
    expect(outcome.chunks.map((chunk) => chunk.chunkId)).toEqual([
      'chunk-original',
      'chunk-distinct',
    ]);
  });

  it('falls back to the fused order when the reranker fails', async () => {
    const rows = [
      chunkRow({ chunk_id: 'chunk-a', content: 'Alpha', score: 0.9 }),
      chunkRow({
        chunk_id: 'chunk-b',
        content: 'Beta',
        score: 0.8,
        source_id: 'source-2',
      }),
    ];
    const reranker = {
      rerank: vi.fn(async () => {
        throw new Error('voyage is down');
      }),
    };
    const { service } = serviceWithRows(rows, undefined, {
      config: rerankConfig,
      reranker,
    });

    const outcome = await service.retrieve({
      notebookId: 'notebook-1',
      query: 'passage',
    });

    expect(outcome.chunks.map((chunk) => chunk.chunkId)).toEqual([
      'chunk-a',
      'chunk-b',
    ]);
    expect(outcome.abstained).toBe(false);
    expect(outcome.trace.rerank).toMatchObject({
      applied: false,
      skippedReason: 'failed',
      candidates: [],
      inputTokens: 0,
    });
    expect(
      outcome.trace.fusedOrder.map((candidate) => candidate.chunkId),
    ).toEqual(['chunk-a', 'chunk-b']);
  });

  it('treats an unconfigured reranker key as unavailable and still answers', async () => {
    const rows = [
      chunkRow({ chunk_id: 'chunk-a', content: 'Alpha', score: 0.9 }),
    ];
    const reranker = { rerank: vi.fn(async () => null) };
    const { service } = serviceWithRows(rows, undefined, {
      config: rerankConfig,
      reranker,
    });

    const outcome = await service.retrieve({
      notebookId: 'notebook-1',
      query: 'passage',
    });

    expect(outcome.chunks.map((chunk) => chunk.chunkId)).toEqual(['chunk-a']);
    expect(outcome.trace.rerank).toMatchObject({
      applied: false,
      skippedReason: 'unavailable',
    });
  });

  it('does not call the reranker when reranking is disabled', async () => {
    const rows = [
      chunkRow({ chunk_id: 'chunk-a', content: 'Alpha', score: 0.9 }),
    ];
    const reranker = scriptedReranker({ 0: 0.1 });
    const { service } = serviceWithRows(rows, undefined, {
      config: { ...rerankConfig, enabled: false },
      reranker,
    });

    const outcome = await service.retrieve({
      notebookId: 'notebook-1',
      query: 'passage',
    });

    expect(reranker.rerank).not.toHaveBeenCalled();
    expect(outcome.chunks.map((chunk) => chunk.chunkId)).toEqual(['chunk-a']);
    expect(outcome.trace.rerank).toMatchObject({
      applied: false,
      skippedReason: 'disabled',
    });
  });

  it('falls back when the reranker does not score every candidate', async () => {
    const rows = [
      chunkRow({ chunk_id: 'chunk-a', content: 'Alpha', score: 0.9 }),
      chunkRow({ chunk_id: 'chunk-b', content: 'Beta', score: 0.8 }),
    ];
    const reranker = {
      rerank: vi.fn(async () => ({
        candidates: [{ index: 0, relevanceScore: 0.9 }],
        inputTokens: 10,
      })),
    };
    const { service } = serviceWithRows(rows, undefined, {
      config: rerankConfig,
      reranker,
    });

    const outcome = await service.retrieve({
      notebookId: 'notebook-1',
      query: 'passage',
    });

    expect(outcome.trace.rerank).toMatchObject({
      applied: false,
      skippedReason: 'failed',
    });
    expect(outcome.chunks.map((chunk) => chunk.chunkId)).toEqual([
      'chunk-a',
      'chunk-b',
    ]);
  });

  it('skips reranking when the candidate set exceeds the provider document limit', async () => {
    const rows = Array.from(
      { length: MAX_RERANK_DOCUMENTS + 1 },
      (_value, index) =>
        chunkRow({
          chunk_id: `chunk-${index}`,
          content: `Passage ${index}`,
          score: 0.9 - index * 0.001,
          source_id: `source-${index}`,
        }),
    );
    const reranker = scriptedReranker({});
    const { service } = serviceWithRows(rows, undefined, {
      config: rerankConfig,
      reranker,
    });

    const outcome = await service.retrieve({
      notebookId: 'notebook-1',
      query: 'passage',
    });

    expect(reranker.rerank).not.toHaveBeenCalled();
    expect(outcome.trace.rerank).toMatchObject({
      applied: false,
      skippedReason: 'too_many_candidates',
    });
    expect(outcome.chunks).toHaveLength(8);
  });

  it('honors a per-call rerank threshold override for grounding', async () => {
    const rows = [
      chunkRow({ chunk_id: 'chunk-faint', content: 'Faint', score: 0.2 }),
    ];
    const reranker = scriptedReranker({ 0: 0.05 });
    const { service } = serviceWithRows(rows, undefined, {
      config: rerankConfig,
      reranker,
    });

    const outcome = await service.retrieve({
      notebookId: 'notebook-1',
      query: 'passage',
      rerankThreshold: 0,
    });

    expect(outcome.chunks.map((chunk) => chunk.chunkId)).toEqual([
      'chunk-faint',
    ]);
    expect(outcome.trace.rerank.threshold).toBe(0);
  });
});

describe('RetrievalService selected sources scope', () => {
  it('bounds each selected source independently and excludes unselected sources', async () => {
    const notebook = await seedNotebook();
    const sourceA = await seedSource(notebook.id, {
      kind: 'text',
      title: 'Source A',
      rawText: 'a',
      processingStatus: 'ready',
    });
    const sourceB = await seedSource(notebook.id, {
      kind: 'text',
      title: 'Source B',
      rawText: 'b',
      processingStatus: 'ready',
    });
    const sourceC = await seedSource(notebook.id, {
      kind: 'text',
      title: 'Source C',
      rawText: 'c',
      processingStatus: 'ready',
    });

    const strong = [1, ...Array.from({ length: 1023 }, () => 0)];
    const medium = [
      0.9,
      Math.sqrt(1 - 0.9 ** 2),
      ...Array.from({ length: 1022 }, () => 0),
    ];
    await db.insert(sourceChunks).values([
      {
        id: 'a-chunk-1',
        sourceId: sourceA.id,
        notebookId: notebook.id,
        sourceKind: 'text',
        chunkIndex: 0,
        content: 'A strong match',
        searchableText: 'A strong match',
        embedding: strong,
      },
      {
        id: 'a-chunk-2',
        sourceId: sourceA.id,
        notebookId: notebook.id,
        sourceKind: 'text',
        chunkIndex: 1,
        content: 'A medium match',
        searchableText: 'A medium match',
        embedding: medium,
      },
      {
        id: 'b-chunk-1',
        sourceId: sourceB.id,
        notebookId: notebook.id,
        sourceKind: 'text',
        chunkIndex: 0,
        content: 'B only match',
        searchableText: 'B only match',
        embedding: medium,
      },
      {
        id: 'c-chunk-1',
        sourceId: sourceC.id,
        notebookId: notebook.id,
        sourceKind: 'text',
        chunkIndex: 0,
        content: 'C strong match',
        searchableText: 'C strong match',
        embedding: strong,
      },
    ]);

    const service = new RetrievalService(
      db as never,
      fakeEmbeddingService(vi.fn().mockResolvedValue(strong)),
      { relevanceFloor: 0 },
    );

    const outcome = await service.retrieve({
      notebookId: notebook.id,
      query: 'match',
      sourceIds: [sourceA.id, sourceB.id],
      topK: 1,
    });

    expect(outcome.trace.scope).toEqual({
      kind: 'selected_sources',
      sourceIds: [sourceA.id, sourceB.id],
    });
    expect(outcome.chunks.map((chunk) => chunk.chunkId)).toEqual([
      'a-chunk-1',
      'b-chunk-1',
    ]);
  });

  it('returns an empty selected-sources outcome without embedding an empty selection', async () => {
    const embedQuery = vi.fn();
    const service = new RetrievalService(
      { execute: vi.fn() } as never,
      fakeEmbeddingService(embedQuery),
    );

    const outcome = await service.retrieve({
      notebookId: 'notebook-1',
      query: 'anything',
      sourceIds: [],
    });

    expect(outcome.abstained).toBe(true);
    expect(outcome.abstentionReason).toBe('no_indexed_chunks');
    expect(outcome.trace.legs).toEqual([]);
    expect(outcome.trace.scope).toEqual({
      kind: 'selected_sources',
      sourceIds: [],
    });
    expect(embedQuery).not.toHaveBeenCalled();
  });
});

describe('RetrievalService relevance floor', () => {
  it('drops candidates below the floor while keeping an above-floor result', async () => {
    const { service } = serviceWithRows([
      chunkRow({
        chunk_id: 'chunk-good',
        content: 'Relevant passage',
        score: 0.72,
      }),
      chunkRow({
        chunk_id: 'chunk-weak',
        content: 'Unrelated passage',
        score: 0.11,
        source_id: 'source-2',
        title: 'Other source',
        kind: 'url',
      }),
    ]);

    const result = await service.retrieve({
      notebookId: 'notebook-1',
      query: 'derivative',
    });

    expect(result.abstained).toBe(false);
    expect(result.abstentionReason).toBeNull();
    expect(result.chunks.map((chunk) => chunk.chunkId)).toEqual(['chunk-good']);
    expect(result.unhelpfulSources).toEqual([
      { id: 'source-2', title: 'Other source', kind: 'url', url: null },
    ]);
  });

  it('abstains with a below-threshold outcome when nothing clears the floor', async () => {
    const { service } = serviceWithRows([
      chunkRow({
        chunk_id: 'chunk-nav-1',
        content: 'Chapter 1',
        score: 0.15,
        source_id: 'source-a',
        title: 'Study guide',
        kind: 'url',
      }),
      chunkRow({
        chunk_id: 'chunk-nav-2',
        content: 'Chapter 2',
        score: 0.09,
        source_id: 'source-a',
      }),
      chunkRow({
        chunk_id: 'chunk-nav-3',
        content: 'Sign in to continue reading',
        score: 0.05,
        source_id: 'source-b',
        title: 'Paywalled article',
        kind: 'url',
      }),
    ]);

    const result = await service.retrieve({
      notebookId: 'notebook-1',
      query: 'beyond good and evil summary',
    });

    expect(result.abstained).toBe(true);
    expect(result.abstentionReason).toBe('below_threshold');
    expect(result.chunks).toEqual([]);
    expect(result.unhelpfulSources).toEqual([
      { id: 'source-a', title: 'Study guide', kind: 'url', url: null },
      { id: 'source-b', title: 'Paywalled article', kind: 'url', url: null },
    ]);
  });

  it('abstains with an explicit empty outcome when the notebook has no indexed chunks', async () => {
    const { service } = serviceWithRows([]);

    const result = await service.retrieve({
      notebookId: 'notebook-1',
      query: 'anything',
    });

    expect(result.abstained).toBe(true);
    expect(result.abstentionReason).toBe('no_indexed_chunks');
    expect(result.chunks).toEqual([]);
    expect(result.unhelpfulSources).toEqual([]);
  });

  it('honors an injected relevance floor over the default', async () => {
    const { service } = serviceWithRows(
      [
        chunkRow({
          chunk_id: 'chunk-borderline',
          content: 'Borderline passage',
          score: 0.4,
        }),
        chunkRow({
          chunk_id: 'chunk-strong',
          content: 'Strong passage',
          score: 0.8,
        }),
      ],
      { relevanceFloor: 0.5 },
    );

    const result = await service.retrieve({
      notebookId: 'notebook-1',
      query: 'derivative',
    });

    expect(result.chunks.map((chunk) => chunk.chunkId)).toEqual([
      'chunk-strong',
    ]);
    expect(result.unhelpfulSources).toEqual([
      { id: 'source-1', title: 'Lecture notes', kind: 'file', url: null },
    ]);
  });

  it('honors a per-call relevance floor override for grounding', async () => {
    const { service } = serviceWithRows([
      chunkRow({ chunk_id: 'chunk-faint', score: 0.05 }),
    ]);

    const result = await service.retrieve({
      notebookId: 'notebook-1',
      query: 'derivative',
      relevanceFloor: 0,
    });

    expect(result.chunks.map((chunk) => chunk.chunkId)).toEqual([
      'chunk-faint',
    ]);
    expect(result.trace.relevanceFloor).toBe(0);
  });
});

describe('loadRetrievalRelevanceConfig', () => {
  it('falls back to the documented default floor', () => {
    expect(loadRetrievalRelevanceConfig({})).toEqual({
      relevanceFloor: DEFAULT_RELEVANCE_FLOOR,
    });
  });

  it('reads the floor from the environment', () => {
    expect(
      loadRetrievalRelevanceConfig({ RETRIEVAL_RELEVANCE_FLOOR: '0.45' }),
    ).toEqual({
      relevanceFloor: 0.45,
    });
  });

  it('clamps the floor into the valid similarity range', () => {
    expect(
      loadRetrievalRelevanceConfig({ RETRIEVAL_RELEVANCE_FLOOR: '5' }),
    ).toEqual({
      relevanceFloor: 1,
    });
    expect(
      loadRetrievalRelevanceConfig({ RETRIEVAL_RELEVANCE_FLOOR: '-2' }),
    ).toEqual({
      relevanceFloor: 0,
    });
  });

  it('ignores values that are not numbers', () => {
    expect(
      loadRetrievalRelevanceConfig({ RETRIEVAL_RELEVANCE_FLOOR: 'high' }),
    ).toEqual({
      relevanceFloor: DEFAULT_RELEVANCE_FLOOR,
    });
  });
});

describe('loadRetrievalRerankConfig', () => {
  it('falls back to the documented defaults', () => {
    expect(loadRetrievalRerankConfig({})).toEqual({
      enabled: true,
      model: DEFAULT_RERANK_MODEL,
      candidateDepth: DEFAULT_CANDIDATE_DEPTH,
      threshold: DEFAULT_RERANK_THRESHOLD,
      topK: DEFAULT_TOP_K,
    });
  });

  it('reads the reranking configuration from the environment', () => {
    expect(
      loadRetrievalRerankConfig({
        RETRIEVAL_RERANK_ENABLED: 'false',
        RETRIEVAL_RERANK_MODEL: 'rerank-2.5-lite',
        RETRIEVAL_CANDIDATE_DEPTH: '12',
        RETRIEVAL_RERANK_THRESHOLD: '0.6',
        RETRIEVAL_TOP_K: '3',
      }),
    ).toEqual({
      enabled: false,
      model: 'rerank-2.5-lite',
      candidateDepth: 12,
      threshold: 0.6,
      topK: 3,
    });
  });

  it('clamps the threshold and candidate depth into their valid ranges', () => {
    expect(
      loadRetrievalRerankConfig({
        RETRIEVAL_RERANK_THRESHOLD: '5',
        RETRIEVAL_CANDIDATE_DEPTH: '99999',
      }),
    ).toMatchObject({ threshold: 1, candidateDepth: 1000 });
    expect(
      loadRetrievalRerankConfig({
        RETRIEVAL_RERANK_THRESHOLD: '-1',
        RETRIEVAL_CANDIDATE_DEPTH: '0',
      }),
    ).toMatchObject({ threshold: 0, candidateDepth: DEFAULT_CANDIDATE_DEPTH });
  });

  it('ignores values that are not usable', () => {
    expect(
      loadRetrievalRerankConfig({
        RETRIEVAL_RERANK_ENABLED: 'maybe',
        RETRIEVAL_RERANK_MODEL: '   ',
        RETRIEVAL_CANDIDATE_DEPTH: 'many',
        RETRIEVAL_RERANK_THRESHOLD: 'high',
        RETRIEVAL_TOP_K: 'none',
      }),
    ).toEqual(DEFAULT_RERANK_CONFIG);
  });
});

describe('AiModule relevance floor wiring', () => {
  it('reads the relevance floor from the environment through the config provider', async () => {
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'text',
      title: 'Ready source',
      rawText: 'Substantive ready content',
      processingStatus: 'ready',
    });

    // Unit vectors: score = 1 - cosine_distance = cosine similarity.
    // chunk-borderline scores 0.45 — above the 0.3 default, below the
    // RETRIEVAL_RELEVANCE_FLOOR=0.5 set for this test.
    const strong = [1, ...Array.from({ length: 1023 }, () => 0)];
    const borderline = [
      0.45,
      Math.sqrt(1 - 0.45 ** 2),
      ...Array.from({ length: 1022 }, () => 0),
    ];
    await db.insert(sourceChunks).values([
      {
        id: 'chunk-strong',
        sourceId: source.id,
        notebookId: notebook.id,
        sourceKind: 'text',
        chunkIndex: 0,
        content: 'Strong match',
        searchableText: 'Strong match',
        embedding: strong,
      },
      {
        id: 'chunk-borderline',
        sourceId: source.id,
        notebookId: notebook.id,
        sourceKind: 'text',
        chunkIndex: 1,
        content: 'Borderline match',
        searchableText: 'Borderline match',
        embedding: borderline,
      },
    ]);

    process.env.RETRIEVAL_RELEVANCE_FLOOR = '0.5';
    try {
      const moduleRef = await Test.createTestingModule({
        imports: [DatabaseModule, AiModule],
      })
        .overrideProvider(DRIZZLE)
        .useValue(db)
        .overrideProvider(PG_POOL)
        .useValue({})
        .overrideProvider(EmbeddingService)
        .useValue({
          embedQuery: vi.fn().mockResolvedValue(strong),
          queryEmbeddingModel: () => EMBEDDING_MODEL,
          getVoyageApiKey: vi.fn().mockResolvedValue(null),
        })
        .compile();

      const service = moduleRef.get(RetrievalService);
      const result = await service.retrieve({
        notebookId: notebook.id,
        query: 'query',
      });

      expect(result.chunks.map((chunk) => chunk.chunkId)).toEqual([
        'chunk-strong',
      ]);
      expect(result.unhelpfulSources).toEqual([
        { id: source.id, title: 'Ready source', kind: 'text', url: null },
      ]);
    } finally {
      delete process.env.RETRIEVAL_RELEVANCE_FLOOR;
    }
  });

  it('reads the reranking configuration from the environment through the config provider', async () => {
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'text',
      title: 'Ready source',
      rawText: 'Substantive ready content',
      processingStatus: 'ready',
    });
    const embedding = [1, ...Array.from({ length: 1023 }, () => 0)];
    await db.insert(sourceChunks).values([
      {
        id: 'chunk-one',
        sourceId: source.id,
        notebookId: notebook.id,
        sourceKind: 'text',
        chunkIndex: 0,
        content: 'First match',
        searchableText: 'First match',
        embedding,
      },
      {
        id: 'chunk-two',
        sourceId: source.id,
        notebookId: notebook.id,
        sourceKind: 'text',
        chunkIndex: 1,
        content: 'Second match',
        searchableText: 'Second match',
        embedding,
      },
    ]);

    process.env.RETRIEVAL_RERANK_ENABLED = 'false';
    process.env.RETRIEVAL_TOP_K = '1';
    try {
      const moduleRef = await Test.createTestingModule({
        imports: [DatabaseModule, AiModule],
      })
        .overrideProvider(DRIZZLE)
        .useValue(db)
        .overrideProvider(PG_POOL)
        .useValue({})
        .overrideProvider(EmbeddingService)
        .useValue({
          embedQuery: vi.fn().mockResolvedValue(embedding),
          queryEmbeddingModel: () => EMBEDDING_MODEL,
          getVoyageApiKey: vi.fn().mockResolvedValue(null),
        })
        .compile();

      const service = moduleRef.get(RetrievalService);
      const result = await service.retrieve({
        notebookId: notebook.id,
        query: 'query',
      });

      expect(result.chunks).toHaveLength(1);
      expect(result.trace.topK).toBe(1);
      expect(result.trace.rerank).toMatchObject({
        applied: false,
        skippedReason: 'disabled',
      });
    } finally {
      delete process.env.RETRIEVAL_RERANK_ENABLED;
      delete process.env.RETRIEVAL_TOP_K;
    }
  });
});

describe('RetrievalService hybrid retrieval', () => {
  const noRerank: Partial<RetrievalRerankConfig> = { enabled: false };

  it('fuses the dense and lexical legs by rank instead of by score', async () => {
    const rows = [
      chunkRow({ chunk_id: 'chunk-a', content: 'Alpha passage', score: 0.9 }),
      chunkRow({
        chunk_id: 'chunk-b',
        content: 'Beta passage',
        score: 0.8,
        source_id: 'source-2',
      }),
      chunkRow({
        chunk_id: 'chunk-c',
        content: 'Gamma passage',
        score: 0.7,
        source_id: 'source-3',
      }),
    ];
    const lexicalRows = [
      chunkRow({
        chunk_id: 'chunk-c',
        content: 'Gamma passage',
        score: 0.5,
        source_id: 'source-3',
      }),
      chunkRow({
        chunk_id: 'chunk-b',
        content: 'Beta passage',
        score: 0.4,
        source_id: 'source-2',
      }),
    ];
    const { service } = serviceWithRows(
      rows,
      { relevanceFloor: 0 },
      { config: noRerank },
      { lexicalRows },
    );

    const outcome = await service.retrieve({
      notebookId: 'notebook-1',
      query: 'passage',
    });

    // chunk-c is only third by dense score but first lexically, so RRF lifts
    // it above chunk-a, which only the dense leg ranked.
    expect(outcome.chunks.map((chunk) => chunk.chunkId)).toEqual([
      'chunk-c',
      'chunk-b',
      'chunk-a',
    ]);
    // Evidence keeps the dense retrieval score even though fusion ordered it.
    expect(outcome.chunks.map((chunk) => chunk.score)).toEqual([0.7, 0.8, 0.9]);
    expect(outcome.trace.legs.map((leg) => leg.kind)).toEqual([
      'dense',
      'lexical',
    ]);
    expect(
      outcome.trace.fusedOrder.map((candidate) => candidate.chunkId),
    ).toEqual(['chunk-c', 'chunk-b', 'chunk-a']);
    expect(outcome.trace.fusion).toEqual({
      k: DEFAULT_FUSION_K,
      weights: { dense: 1, lexical: 1 },
      depths: {
        dense: DEFAULT_CANDIDATE_DEPTH,
        lexical: DEFAULT_CANDIDATE_DEPTH,
      },
    });
  });

  it('retrieves a chunk from an exact identifier the dense leg misses', async () => {
    const denseRows = [
      chunkRow({
        chunk_id: 'chunk-cooking',
        content: 'A cooking passage about sourdough starters.',
        score: 0.9,
      }),
    ];
    const lexicalRows = [
      chunkRow({
        chunk_id: 'chunk-rfc',
        content: 'RFC 2616 defines the Accept header in section 14.1.',
        score: 0.42,
        source_id: 'source-2',
      }),
    ];
    const reranker = {
      rerank: vi.fn(async (request: { documents: string[] }) => ({
        candidates: request.documents.map((document, index) => ({
          index,
          relevanceScore: document.includes('RFC 2616') ? 0.9 : 0.1,
        })),
        inputTokens: 20,
      })),
    };
    const { service } = serviceWithRows(
      denseRows,
      { relevanceFloor: 0 },
      {
        config: {
          enabled: true,
          candidateDepth: 1,
          topK: 1,
          threshold: 0.5,
        },
        reranker,
      },
      {
        config: { denseCandidateDepth: 1, lexicalCandidateDepth: 1 },
        lexicalRows,
      },
    );

    const outcome = await service.retrieve({
      notebookId: 'notebook-1',
      query: 'What does RFC 2616 say about the Accept header?',
      topK: 1,
    });

    // The lexical leg surfaced the chunk the dense leg never returned; the
    // reranker then promoted it over the dense leg's only candidate.
    expect(reranker.rerank).toHaveBeenCalledWith(
      expect.objectContaining({
        documents: [
          'A cooking passage about sourdough starters.',
          'RFC 2616 defines the Accept header in section 14.1.',
        ],
      }),
    );
    expect(outcome.chunks.map((chunk) => chunk.chunkId)).toEqual(['chunk-rfc']);
    expect(outcome.trace.legs[1].candidates.map((c) => c.chunkId)).toEqual([
      'chunk-rfc',
    ]);
    expect(outcome.trace.rerank.candidates.map((c) => c.chunkId)).toEqual([
      'chunk-rfc',
      'chunk-cooking',
    ]);
  });

  it('abstains when the lexical leg is disabled and the dense leg misses the exact term', async () => {
    const denseRows = [
      chunkRow({
        chunk_id: 'chunk-cooking',
        content: 'A cooking passage about sourdough starters.',
        score: 0.9,
      }),
    ];
    const reranker = {
      rerank: vi.fn(async (request: { documents: string[] }) => ({
        candidates: request.documents.map((_document, index) => ({
          index,
          relevanceScore: 0.1,
        })),
        inputTokens: 20,
      })),
    };
    const { service } = serviceWithRows(
      denseRows,
      { relevanceFloor: 0 },
      {
        config: {
          enabled: true,
          candidateDepth: 1,
          topK: 1,
          threshold: 0.5,
        },
        reranker,
      },
      { config: { enabled: false } },
    );

    const outcome = await service.retrieve({
      notebookId: 'notebook-1',
      query: 'What does RFC 2616 say about the Accept header?',
      topK: 1,
    });

    expect(outcome.abstained).toBe(true);
    expect(outcome.abstentionReason).toBe('below_threshold');
    expect(outcome.trace.legs.map((leg) => leg.kind)).toEqual(['dense']);
    expect(outcome.trace.fusion.depths.lexical).toBe(0);
  });

  it('applies notebook, selected-source and degraded filters to both legs', async () => {
    const embedding = Array.from({ length: 1024 }, () => 0.01);
    const notebook = await seedNotebook();
    const otherNotebook = await seedNotebook({ title: 'Other notebook' });
    const sourceA = await seedSource(notebook.id, {
      kind: 'text',
      title: 'Source A',
      rawText: 'alpha zebra protocol',
      processingStatus: 'ready',
    });
    const sourceB = await seedSource(notebook.id, {
      kind: 'text',
      title: 'Source B',
      rawText: 'beta zebra manual',
      processingStatus: 'ready',
    });
    const degraded = await seedSource(notebook.id, {
      kind: 'url',
      title: 'Degraded source',
      rawText: 'gamma zebra navigation',
      processingStatus: 'degraded',
    });
    const otherSource = await seedSource(otherNotebook.id, {
      kind: 'text',
      title: 'Other notebook source',
      rawText: 'delta zebra guide',
      processingStatus: 'ready',
    });
    await db.insert(sourceChunks).values([
      {
        id: 'hybrid-a',
        sourceId: sourceA.id,
        notebookId: notebook.id,
        sourceKind: 'text',
        chunkIndex: 0,
        content: 'Alpha zebra protocol',
        searchableText: 'Alpha zebra protocol',
        embedding,
      },
      {
        id: 'hybrid-b',
        sourceId: sourceB.id,
        notebookId: notebook.id,
        sourceKind: 'text',
        chunkIndex: 0,
        content: 'Beta zebra manual',
        searchableText: 'Beta zebra manual',
        embedding,
      },
      {
        id: 'hybrid-degraded',
        sourceId: degraded.id,
        notebookId: notebook.id,
        sourceKind: 'url',
        chunkIndex: 0,
        content: 'Gamma zebra navigation',
        searchableText: 'Gamma zebra navigation',
        embedding,
      },
      {
        id: 'hybrid-other',
        sourceId: otherSource.id,
        notebookId: otherNotebook.id,
        sourceKind: 'text',
        chunkIndex: 0,
        content: 'Delta zebra guide',
        searchableText: 'Delta zebra guide',
        embedding,
      },
    ]);
    const service = new RetrievalService(
      db,
      fakeEmbeddingService(vi.fn().mockResolvedValue(embedding)),
      { relevanceFloor: 0 },
      { ...DEFAULT_RERANK_CONFIG, enabled: false },
    );

    const notebookWide = await service.retrieve({
      notebookId: notebook.id,
      query: 'zebra',
    });
    const legChunkIds = notebookWide.trace.legs.flatMap((leg) =>
      leg.candidates.map((candidate) => candidate.chunkId),
    );
    expect(new Set(legChunkIds)).toEqual(new Set(['hybrid-a', 'hybrid-b']));
    expect(notebookWide.chunks.map((chunk) => chunk.chunkId).sort()).toEqual([
      'hybrid-a',
      'hybrid-b',
    ]);

    const selected = await service.retrieve({
      notebookId: notebook.id,
      query: 'zebra',
      sourceIds: [sourceA.id],
    });
    for (const leg of selected.trace.legs) {
      expect(leg.candidates.map((candidate) => candidate.chunkId)).toEqual([
        'hybrid-a',
      ]);
    }
    expect(selected.chunks.map((chunk) => chunk.chunkId)).toEqual(['hybrid-a']);
  });

  it('gates a lexical-only candidate by its dense score when reranking is unavailable', async () => {
    const rows = [
      chunkRow({
        chunk_id: 'chunk-dense',
        content: 'Dense passage',
        score: 0.9,
      }),
    ];
    const lexicalRows = [
      chunkRow({
        chunk_id: 'chunk-lexical',
        content: 'RFC 2616 passage',
        score: 0.42,
        dense_score: 0.05,
        source_id: 'source-2',
        title: 'RFC notes',
      }),
    ];
    const { service } = serviceWithRows(
      rows,
      undefined,
      { config: noRerank },
      { lexicalRows },
    );

    const outcome = await service.retrieve({
      notebookId: 'notebook-1',
      query: 'RFC 2616',
    });

    // Without the cross-encoder, the dense cosine floor is the gate: a
    // lexical-only candidate that is semantically distant is dropped rather
    // than padding the answer.
    expect(outcome.chunks.map((chunk) => chunk.chunkId)).toEqual([
      'chunk-dense',
    ]);
    expect(outcome.unhelpfulSources).toEqual([
      { id: 'source-2', title: 'RFC notes', kind: 'file', url: null },
    ]);
  });

  it('runs only the dense leg when hybrid retrieval is disabled', async () => {
    const { service, execute } = serviceWithRows(
      [chunkRow({ chunk_id: 'chunk-a', score: 0.9 })],
      undefined,
      { config: noRerank },
      { config: { enabled: false } },
    );

    const outcome = await service.retrieve({
      notebookId: 'notebook-1',
      query: 'derivative',
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(outcome.trace.legs.map((leg) => leg.kind)).toEqual(['dense']);
    expect(outcome.trace.fusion.depths.lexical).toBe(0);
  });

  it('traces a zero-weight leg but leaves it out of the fusion', async () => {
    const rows = [
      chunkRow({
        chunk_id: 'chunk-dense',
        content: 'Dense passage',
        score: 0.9,
      }),
    ];
    const lexicalRows = [
      chunkRow({
        chunk_id: 'chunk-lexical',
        content: 'Lexical passage',
        score: 0.5,
        source_id: 'source-2',
      }),
    ];
    const { service } = serviceWithRows(
      rows,
      { relevanceFloor: 0 },
      { config: noRerank },
      { config: { lexicalWeight: 0 }, lexicalRows },
    );

    const outcome = await service.retrieve({
      notebookId: 'notebook-1',
      query: 'passage',
    });

    expect(outcome.trace.legs.map((leg) => leg.kind)).toEqual([
      'dense',
      'lexical',
    ]);
    expect(outcome.trace.fusedOrder.map((c) => c.chunkId)).toEqual([
      'chunk-dense',
    ]);
    expect(outcome.chunks.map((chunk) => chunk.chunkId)).toEqual([
      'chunk-dense',
    ]);
  });
});

describe('loadRetrievalHybridConfig', () => {
  it('falls back to the documented defaults', () => {
    expect(loadRetrievalHybridConfig({})).toEqual(DEFAULT_HYBRID_CONFIG);
  });

  it('reads the hybrid configuration from the environment', () => {
    expect(
      loadRetrievalHybridConfig({
        RETRIEVAL_HYBRID_ENABLED: 'false',
        RETRIEVAL_RRF_K: '12',
        RETRIEVAL_RRF_DENSE_WEIGHT: '0.25',
        RETRIEVAL_RRF_LEXICAL_WEIGHT: '0.75',
        RETRIEVAL_DENSE_CANDIDATE_DEPTH: '5',
        RETRIEVAL_LEXICAL_CANDIDATE_DEPTH: '9',
      }),
    ).toEqual({
      enabled: false,
      fusionK: 12,
      denseWeight: 0.25,
      lexicalWeight: 0.75,
      denseCandidateDepth: 5,
      lexicalCandidateDepth: 9,
    });
  });

  it('clamps the fusion constant and weights and ignores unusable values', () => {
    expect(
      loadRetrievalHybridConfig({
        RETRIEVAL_RRF_K: '0',
        RETRIEVAL_RRF_DENSE_WEIGHT: '5',
        RETRIEVAL_RRF_LEXICAL_WEIGHT: '-1',
        RETRIEVAL_LEXICAL_CANDIDATE_DEPTH: 'many',
      }),
    ).toEqual({
      ...DEFAULT_HYBRID_CONFIG,
      denseWeight: 1,
      lexicalWeight: 0,
    });
  });

  it('treats an empty depth override as unset, so it falls back to the shared depth', () => {
    // Docker Compose forwards the overrides as empty strings when they are
    // not configured, which must not override the shared candidate depth.
    expect(
      loadRetrievalHybridConfig({
        RETRIEVAL_DENSE_CANDIDATE_DEPTH: '',
        RETRIEVAL_LEXICAL_CANDIDATE_DEPTH: '',
      }),
    ).toEqual(DEFAULT_HYBRID_CONFIG);
  });

  it('clamps an over-limit depth override', () => {
    expect(
      loadRetrievalHybridConfig({
        RETRIEVAL_LEXICAL_CANDIDATE_DEPTH: '99999',
      }).lexicalCandidateDepth,
    ).toBe(MAX_RERANK_DOCUMENTS);
  });
});

describe('AiModule hybrid wiring', () => {
  it('reads the hybrid configuration from the environment through the config provider', async () => {
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'text',
      title: 'Ready source',
      rawText: 'Zebra crossing',
      processingStatus: 'ready',
    });
    const embedding = [1, ...Array.from({ length: 1023 }, () => 0)];
    await db.insert(sourceChunks).values([
      {
        id: 'chunk-hybrid-off',
        sourceId: source.id,
        notebookId: notebook.id,
        sourceKind: 'text',
        chunkIndex: 0,
        content: 'Zebra crossing',
        searchableText: 'Zebra crossing',
        embedding,
      },
    ]);

    process.env.RETRIEVAL_HYBRID_ENABLED = 'false';
    try {
      const moduleRef = await Test.createTestingModule({
        imports: [DatabaseModule, AiModule],
      })
        .overrideProvider(DRIZZLE)
        .useValue(db)
        .overrideProvider(PG_POOL)
        .useValue({})
        .overrideProvider(EmbeddingService)
        .useValue({
          embedQuery: vi.fn().mockResolvedValue(embedding),
          queryEmbeddingModel: () => EMBEDDING_MODEL,
          getVoyageApiKey: vi.fn().mockResolvedValue(null),
        })
        .compile();

      const service = moduleRef.get(RetrievalService);
      const result = await service.retrieve({
        notebookId: notebook.id,
        query: 'zebra',
      });

      expect(result.trace.legs.map((leg) => leg.kind)).toEqual(['dense']);
      expect(result.trace.fusion.depths.lexical).toBe(0);
    } finally {
      delete process.env.RETRIEVAL_HYBRID_ENABLED;
    }
  });
});
