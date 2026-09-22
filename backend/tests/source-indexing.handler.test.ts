import { describe, expect, it } from 'vitest';
import { createDatabaseConnection } from '../src/database/connection';
import { jobs } from '../src/database/schema';
import { CHUNKING_VERSION } from '../src/modules/ai/chunking.service';
import {
  CONTEXTUAL_EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
} from '../src/modules/ai/embedding.service';
import { INDEX_PROCESSING_VERSION } from '../src/modules/ai/indexing.service';
import { Job } from '../src/modules/jobs/job-handler.interface';
import {
  SourceIndexingHandler,
  SourceIndexingJobPayload,
} from '../src/modules/sources/source-indexing.handler';
import { seedNotebook, seedSource } from './fixtures';

const { db } = createDatabaseConnection(process.env.DATABASE_URL);

const embedding = {
  documentEmbeddingModel: () => CONTEXTUAL_EMBEDDING_MODEL,
} as never;

function handler(): SourceIndexingHandler {
  return new SourceIndexingHandler(db as never, {} as never, embedding);
}

/** The representation a completed indexing run records in `job.result`. */
function currentResult(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    chunksCount: 1,
    skipped: false,
    cancelled: false,
    contentHash: 'hash-1',
    processingVersion: INDEX_PROCESSING_VERSION,
    chunkingVersion: CHUNKING_VERSION,
    embeddingModel: CONTEXTUAL_EMBEDDING_MODEL,
    embeddingDimensions: EMBEDDING_DIMENSIONS,
    sourceVersionId: null,
    ...overrides,
  };
}

async function seedPriorJob(
  sourceId: string,
  result: Record<string, unknown>,
): Promise<void> {
  await db.insert(jobs).values({
    id: `prior-${sourceId}`,
    type: 'source_indexing',
    groupKey: `source:${sourceId}`,
    payload: { sourceId, notebookId: 'notebook-1', contentHash: 'hash-1' },
    status: 'ready',
    result,
    completedAt: new Date(),
  });
}

function jobFor(source: {
  id: string;
  notebookId: string;
}): Job<SourceIndexingJobPayload, never> {
  return {
    id: 'job-new',
    type: 'source_indexing',
    groupKey: `source:${source.id}`,
    payload: {
      sourceId: source.id,
      notebookId: source.notebookId,
      contentHash: 'hash-1',
      sourceVersionId: null,
    },
    status: 'pending',
    result: null,
    lastError: null,
    attemptCount: 0,
    maxAttempts: 3,
    backoffBaseMs: 5_000,
    nextAttemptAt: null,
    startedAt: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

async function seedSourceWithHash() {
  const notebook = await seedNotebook();
  return seedSource(notebook.id, {
    kind: 'text',
    title: 'Indexed source',
    rawText: 'Substantive indexed content.',
    processingStatus: 'ready',
    contentHash: 'hash-1',
  });
}

describe('SourceIndexingHandler shouldSkip', () => {
  it('skips an unchanged source whose prior result matches the representation', async () => {
    const source = await seedSourceWithHash();
    await seedPriorJob(source.id, currentResult());

    const result = await handler().shouldSkip(jobFor(source));

    expect(result).toMatchObject({ contentHash: 'hash-1' });
  });

  it('reindexes when the prior result predates the chunking version', async () => {
    const source = await seedSourceWithHash();
    await seedPriorJob(
      source.id,
      currentResult({ chunkingVersion: CHUNKING_VERSION - 1 }),
    );

    await expect(handler().shouldSkip(jobFor(source))).resolves.toBeNull();
  });

  it('reindexes when the prior result has no chunking version at all', async () => {
    const source = await seedSourceWithHash();
    const legacy = currentResult();
    delete legacy.chunkingVersion;
    await seedPriorJob(source.id, legacy);

    await expect(handler().shouldSkip(jobFor(source))).resolves.toBeNull();
  });

  it('reindexes when the prior result used a different embedding model', async () => {
    const source = await seedSourceWithHash();
    await seedPriorJob(
      source.id,
      currentResult({ embeddingModel: 'voyage-4' }),
    );

    await expect(handler().shouldSkip(jobFor(source))).resolves.toBeNull();
  });
});
