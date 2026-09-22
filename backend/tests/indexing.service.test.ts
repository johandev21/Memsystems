import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { createDatabaseConnection } from '../src/database/connection';
import {
  sourceChunks,
  sourceSegments,
  sourceVersions,
  sources,
} from '../src/database/schema';
import {
  CHUNKING_VERSION,
  ChunkingService,
} from '../src/modules/ai/chunking.service';
import {
  CONTEXTUAL_EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  type DocumentEmbeddingResult,
} from '../src/modules/ai/embedding.service';
import {
  INDEX_PROCESSING_VERSION,
  IndexingService,
} from '../src/modules/ai/indexing.service';
import { EXTRACTOR_VERSION, NORMALIZATION_VERSION } from '../src/modules/sources/document-normalizer.service';
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
    embedDocumentGroups: (groups: string[][]) => Promise<DocumentEmbeddingResult>;
  }>,
) {
  return {
    embedDocumentGroups: vi
      .fn()
      .mockImplementation(async (groups: string[][]) => ({
        model: CONTEXTUAL_EMBEDDING_MODEL,
        embeddings: groups.flat().map(() => makeVector(EMBEDDING_DIMENSIONS)),
      })),
    documentEmbeddingModel: () => CONTEXTUAL_EMBEDDING_MODEL,
    ...impl,
  } as any;
}

async function chunkRows(sourceId: string) {
  const rows = await db
    .select({
      content: sourceChunks.content,
      searchableText: sourceChunks.searchableText,
      contextHeader: sourceChunks.contextHeader,
      headingPath: sourceChunks.headingPath,
      sourceKind: sourceChunks.sourceKind,
      chunkingVersion: sourceChunks.chunkingVersion,
      searchVector: sourceChunks.searchVector,
    })
    .from(sourceChunks)
    .where(eq(sourceChunks.sourceId, sourceId))
    .orderBy(sourceChunks.chunkIndex);
  return rows;
}

/** Persists a version with two heading sections for segment-aware indexing. */
async function seedVersionedSource(
  notebookId: string,
  title: string,
  sections: { headingPath: string[]; content: string }[],
) {
  const source = await seedSource(notebookId, {
    kind: 'text',
    title,
    rawText: sections.map((section) => section.content).join('\n\n'),
    contentHash: `hash-${title}`,
  });
  const [version] = await db
    .insert(sourceVersions)
    .values({
      id: `version-${source.id}`,
      sourceId: source.id,
      contentHash: `hash-${title}`,
      extractorId: 'text',
      extractorVersion: EXTRACTOR_VERSION,
      normalizationVersion: NORMALIZATION_VERSION,
      status: 'ready',
    })
    .returning();
  await db.insert(sourceSegments).values(
    sections.map((section, index) => ({
      id: `segment-${source.id}-${index}`,
      sourceVersionId: version.id,
      ordinal: index,
      kind: 'text' as const,
      content: section.content,
      locator: {},
      metadata: { headingPath: section.headingPath },
    })),
  );
  await db
    .update(sources)
    .set({ currentVersionId: version.id })
    .where(eq(sources.id, source.id));
  return { source, version };
}

const { db } = createDatabaseConnection(process.env.DATABASE_URL);

function makeIndexing(embedding: any) {
  return new IndexingService(db as any, new ChunkingService(), embedding);
}

describe('IndexingService', () => {
  it('chunks, embeds and persists a source with heading metadata', async () => {
    const notebook = await seedNotebook();
    const { source, version } = await seedVersionedSource(notebook.id, 'Long Source', [
      {
        headingPath: ['Chapter 1', 'Foundations'],
        content:
          'Retrieval quality depends on document structure. Paragraph two repeats enough words to fill several chunks of the configured size.',
      },
      {
        headingPath: ['Chapter 2', 'Context'],
        content:
          'Contextual representations carry the section heading. Sentence two closes the thought.',
      },
    ]);
    const embedding = fakeEmbeddingService();
    const result = await makeIndexing(embedding).indexSource(source.id);

    expect(result.skipped).toBe(false);
    expect(result.chunksCount).toBeGreaterThan(0);
    expect(result.contentHash).toBe(`hash-Long Source`);
    expect(result.processingVersion).toBe(INDEX_PROCESSING_VERSION);
    expect(result.embeddingModel).toBe(CONTEXTUAL_EMBEDDING_MODEL);
    expect(result.sourceVersionId).toBe(version.id);

    // One call, one group: the source's ordered chunks are embedded together.
    expect(embedding.embedDocumentGroups).toHaveBeenCalledTimes(1);
    const groups = embedding.embedDocumentGroups.mock.calls[0][0] as string[][];
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(result.chunksCount);

    const rows = await chunkRows(source.id);
    expect(rows).toHaveLength(result.chunksCount);
    expect(rows[0].content).toContain('Source: "Long Source"');
    expect(rows[0].sourceKind).toBe('text');
    expect(rows[0].chunkingVersion).toBe(CHUNKING_VERSION);
    expect(rows[0].contextHeader).toContain('Source: "Long Source"');
    expect(rows[0].contextHeader).toContain('Kind: text');
    expect(rows[0].searchableText).toContain('Section: Chapter 1 > Foundations');
    expect(rows[0].content).not.toContain('Section:');
    expect(rows.every((row) => row.headingPath.length > 0)).toBe(true);
    // The lexical representation is stored and indexed alongside the body.
    expect(rows[0].searchVector).toContain("'retrieval'");

    // The embedded text is the searchable text the lexical leg indexes.
    const embedded = groups[0][0];
    expect(embedded).toBe(rows[0].searchableText);
  });

  it('falls back to the legacy embedding model through the configured path', async () => {
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'text',
      title: 'Long Source',
      rawText: LONG_TEXT,
      contentHash: 'hash-fallback',
    });
    const embedding = fakeEmbeddingService({
      embedDocumentGroups: vi.fn().mockImplementation(async (groups: string[][]) => ({
        model: EMBEDDING_MODEL,
        embeddings: groups.flat().map(() => makeVector(EMBEDDING_DIMENSIONS)),
      })),
    });

    const result = await makeIndexing(embedding).indexSource(source.id);
    expect(result.embeddingModel).toBe(EMBEDDING_MODEL);
    const rows = await chunkRows(source.id);
    expect(rows.length).toBe(result.chunksCount);
  });

  it('replaces the chunk set on reindex without duplicating it', async () => {
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'text',
      title: 'Idempotent',
      rawText: LONG_TEXT,
      contentHash: 'hash-idempotent',
    });
    const embedding = fakeEmbeddingService();
    const indexing = makeIndexing(embedding);

    const first = await indexing.indexSource(source.id);
    const firstRows = await chunkRows(source.id);
    const second = await indexing.indexSource(source.id);
    const secondRows = await chunkRows(source.id);

    expect(second.chunksCount).toBe(first.chunksCount);
    expect(secondRows).toEqual(firstRows);
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
      embedDocumentGroups: vi.fn().mockRejectedValue(new Error('provider down')),
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
      embedDocumentGroups: vi.fn().mockResolvedValue({
        model: CONTEXTUAL_EMBEDDING_MODEL,
        embeddings: [makeVector(EMBEDDING_DIMENSIONS)],
      }),
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
