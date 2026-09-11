import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { createDatabaseConnection } from '../src/database/connection';
import { sourceChunks } from '../src/database/schema';
import { ChunkingService } from '../src/modules/ai/chunking.service';
import { EMBEDDING_DIMENSIONS } from '../src/modules/ai/embedding.service';
import { IndexingService } from '../src/modules/ai/indexing.service';
import { seedNotebook, seedSource } from './fixtures';

const LONG_TEXT = Array.from(
  { length: 12 },
  (_, i) =>
    `Paragraph ${i}: This paragraph contains multiple sentences about retrieval quality and document structure. It repeats enough words to fill several chunks of the configured size. Sentence two adds more detail. Sentence three closes the thought.`,
).join('\n\n');

function makeVector(dimensions: number): number[] {
  return Array.from(
    { length: dimensions },
    (_, i) => ((i * 7) % 2 === 0 ? 1 : -1) * 0.001 + i / 1_000_000,
  );
}

function fakeEmbeddingService(
  impl?: Partial<{
    embedDocuments: (texts: string[]) => Promise<number[][]>;
  }>,
) {
  return {
    embedDocuments: vi
      .fn()
      .mockImplementation(async (texts: string[]) =>
        texts.map(() => makeVector(EMBEDDING_DIMENSIONS)),
      ),
    ...impl,
  } as any;
}

async function chunkRows(sourceId: string) {
  const rows = await db
    .select({ content: sourceChunks.content })
    .from(sourceChunks)
    .where(eq(sourceChunks.sourceId, sourceId))
    .orderBy(sourceChunks.chunkIndex);
  return rows;
}

const { db } = createDatabaseConnection(process.env.DATABASE_URL);

function makeIndexing(embedding: any) {
  return new IndexingService(db as any, new ChunkingService(), embedding);
}

describe('IndexingService', () => {
  it('chunks, embeds and persists a source', async () => {
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'text',
      title: 'Long Source',
      rawText: LONG_TEXT,
    });
    const embedding = fakeEmbeddingService();
    const result = await makeIndexing(embedding).indexSource(source.id);

    expect(result.skipped).toBe(false);
    expect(result.chunksCount).toBeGreaterThan(1);
    expect(result.contentHash).toBeNull();
    expect(embedding.embedDocuments).toHaveBeenCalledTimes(1);

    const rows = await chunkRows(source.id);
    expect(rows).toHaveLength(result.chunksCount);
    expect(rows[0].content).toContain('Source: "Long Source"');
  });

  it('keeps the previous chunk set when embedding fails', async () => {
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'text',
      title: 'Stable',
      rawText: LONG_TEXT,
    });

    await makeIndexing(fakeEmbeddingService()).indexSource(source.id);
    const before = await chunkRows(source.id);
    expect(before.length).toBeGreaterThan(0);

    const failing = fakeEmbeddingService({
      embedDocuments: vi.fn().mockRejectedValue(new Error('provider down')),
    });
    await expect(makeIndexing(failing).indexSource(source.id)).rejects.toThrow(
      'provider down',
    );

    const after = await chunkRows(source.id);
    expect(after).toEqual(before);
  });

  it('rejects an embedding count mismatch without touching existing chunks', async () => {
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'text',
      title: 'Mismatch',
      rawText: LONG_TEXT,
    });

    await makeIndexing(fakeEmbeddingService()).indexSource(source.id);
    const before = await chunkRows(source.id);

    const mismatch = fakeEmbeddingService({
      embedDocuments: vi.fn().mockResolvedValue([makeVector(EMBEDDING_DIMENSIONS)]),
    });
    await expect(makeIndexing(mismatch).indexSource(source.id)).rejects.toThrow(
      'Embedding count mismatch',
    );

    expect(await chunkRows(source.id)).toEqual(before);
  });

  it('skips unknown sources without writing chunks', async () => {
    const result = await makeIndexing(fakeEmbeddingService()).indexSource(
      'nope',
    );
    expect(result.skipped).toBe(true);
    expect(result.chunksCount).toBe(0);
  });

  it('skips sources with no extractable text', async () => {
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'text',
      title: 'Empty',
      rawText: '   ',
    });
    const result = await makeIndexing(fakeEmbeddingService()).indexSource(
      source.id,
    );
    expect(result.skipped).toBe(true);
  });
});
