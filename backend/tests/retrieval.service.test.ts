import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';
import { AiModule } from '../src/modules/ai/ai.module';
import { EmbeddingService } from '../src/modules/ai/embedding.service';
import { sourceChunks } from '../src/database/schema';
import { DRIZZLE, DatabaseModule, PG_POOL } from '../src/modules/database/database.module';
import {
  DEFAULT_RELEVANCE_FLOOR,
  RetrievalService,
  RETRIEVAL_RELEVANCE_CONFIG,
  loadRetrievalRelevanceConfig,
  type CitationLocator,
} from '../src/modules/ai/retrieval.service';
import { db } from './db';
import { seedNotebook, seedSource } from './fixtures';

function serviceWithRows(rows: Record<string, unknown>[], config?: { relevanceFloor: number }) {
  const execute = vi.fn().mockResolvedValue({ rows });
  const service = new RetrievalService(
    { execute } as never,
    { embedQuery: vi.fn().mockResolvedValue([0.1, 0.2]) } as never,
    config,
  );
  return { service, execute };
}

function chunkRow(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
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

    const result = await service.retrieve('notebook-1', 'derivative');

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

    const [chunk] = (await service.retrieve('notebook-1', 'legacy')).chunks;
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
        chunkIndex: 0,
        content: 'Substantive ready content',
        embedding,
      },
      {
        id: 'chunk-degraded-1',
        sourceId: degraded.id,
        notebookId: notebook.id,
        chunkIndex: 0,
        content: 'Chapter 1 Chapter 2 Chapter 3',
        embedding,
      },
    ]);

    const service = new RetrievalService(
      db as never,
      { embedQuery: vi.fn().mockResolvedValue(embedding) } as never,
    );

    const result = await service.retrieve(notebook.id, 'content');

    expect(result.chunks.map((chunk) => chunk.chunkId)).toEqual(['chunk-ready-1']);
  });
});

describe('RetrievalService relevance floor', () => {
  it('drops candidates below the floor while keeping an above-floor result', async () => {
    const { service } = serviceWithRows([
      chunkRow({ chunk_id: 'chunk-good', content: 'Relevant passage', score: 0.72 }),
      chunkRow({
        chunk_id: 'chunk-weak',
        content: 'Unrelated passage',
        score: 0.11,
        source_id: 'source-2',
        title: 'Other source',
        kind: 'url',
      }),
    ]);

    const result = await service.retrieve('notebook-1', 'derivative');

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

    const result = await service.retrieve('notebook-1', 'beyond good and evil summary');

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

    const result = await service.retrieve('notebook-1', 'anything');

    expect(result.abstained).toBe(true);
    expect(result.abstentionReason).toBe('no_indexed_chunks');
    expect(result.chunks).toEqual([]);
    expect(result.unhelpfulSources).toEqual([]);
  });

  it('honors an injected relevance floor over the default', async () => {
    const { service } = serviceWithRows(
      [
        chunkRow({ chunk_id: 'chunk-borderline', score: 0.4 }),
        chunkRow({ chunk_id: 'chunk-strong', score: 0.8 }),
      ],
      { relevanceFloor: 0.5 },
    );

    const result = await service.retrieve('notebook-1', 'derivative');

    expect(result.chunks.map((chunk) => chunk.chunkId)).toEqual(['chunk-strong']);
    expect(result.unhelpfulSources).toEqual([
      { id: 'source-1', title: 'Lecture notes', kind: 'file', url: null },
    ]);
  });
});

describe('loadRetrievalRelevanceConfig', () => {
  it('falls back to the documented default floor', () => {
    expect(loadRetrievalRelevanceConfig({})).toEqual({
      relevanceFloor: DEFAULT_RELEVANCE_FLOOR,
    });
  });

  it('reads the floor from the environment', () => {
    expect(loadRetrievalRelevanceConfig({ RETRIEVAL_RELEVANCE_FLOOR: '0.45' })).toEqual({
      relevanceFloor: 0.45,
    });
  });

  it('clamps the floor into the valid similarity range', () => {
    expect(loadRetrievalRelevanceConfig({ RETRIEVAL_RELEVANCE_FLOOR: '5' })).toEqual({
      relevanceFloor: 1,
    });
    expect(loadRetrievalRelevanceConfig({ RETRIEVAL_RELEVANCE_FLOOR: '-2' })).toEqual({
      relevanceFloor: 0,
    });
  });

  it('ignores values that are not numbers', () => {
    expect(loadRetrievalRelevanceConfig({ RETRIEVAL_RELEVANCE_FLOOR: 'high' })).toEqual({
      relevanceFloor: DEFAULT_RELEVANCE_FLOOR,
    });
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
    const borderline = [0.45, Math.sqrt(1 - 0.45 ** 2), ...Array.from({ length: 1022 }, () => 0)];
    await db.insert(sourceChunks).values([
      {
        id: 'chunk-strong',
        sourceId: source.id,
        notebookId: notebook.id,
        chunkIndex: 0,
        content: 'Strong match',
        embedding: strong,
      },
      {
        id: 'chunk-borderline',
        sourceId: source.id,
        notebookId: notebook.id,
        chunkIndex: 1,
        content: 'Borderline match',
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
        .useValue({ embedQuery: vi.fn().mockResolvedValue(strong) })
        .compile();

      const service = moduleRef.get(RetrievalService);
      const result = await service.retrieve(notebook.id, 'query');

      expect(result.chunks.map((chunk) => chunk.chunkId)).toEqual(['chunk-strong']);
      expect(result.unhelpfulSources).toEqual([
        { id: source.id, title: 'Ready source', kind: 'text', url: null },
      ]);
    } finally {
      delete process.env.RETRIEVAL_RELEVANCE_FLOOR;
    }
  });
});
