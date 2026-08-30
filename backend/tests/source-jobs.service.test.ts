import { and, desc, eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { createDatabaseConnection } from '../src/database/connection';
import { jobs, sourceChunks, sources } from '../src/database/schema';
import { ChunkingService } from '../src/modules/ai/chunking.service';
import { IndexingService } from '../src/modules/ai/indexing.service';
import {
  JobQueueConfig,
  JobQueueService,
} from '../src/modules/jobs/job-queue.service';
import { SourceIndexingHandler } from '../src/modules/sources/source-indexing.handler';
import { SourceJobsService } from '../src/modules/sources/source-jobs.service';
import { seedNotebook, seedSource, seedUser } from './fixtures';

const LONG_TEXT = Array.from(
  { length: 12 },
  (_, i) =>
    `Paragraph ${i}: This paragraph contains multiple sentences about durable indexing and recoverable processing. Sentence two adds more detail. Sentence three closes the thought.`,
).join('\n\n');

function makeVector(dimensions: number): number[] {
  return Array.from(
    { length: dimensions },
    (_, i) => ((i * 5) % 2 === 0 ? 1 : -1) * 0.002 + i / 2_000_000,
  );
}

function fakeEmbeddingService() {
  return {
    generateEmbeddings: vi
      .fn()
      .mockImplementation(async (texts: string[]) =>
        texts.map(() => makeVector(1536)),
      ),
  } as any;
}

const { db } = createDatabaseConnection(process.env.DATABASE_URL);

function makeJobsService(
  embedding: any,
  overrides: Partial<JobQueueConfig> = {},
) {
  const indexing = new IndexingService(
    db as any,
    new ChunkingService(),
    embedding,
  );
  const queue = new JobQueueService(db as any, {
    concurrency: 2,
    pollIntervalMs: 60_000,
    defaultBackoffBaseMs: 1_000,
    defaultMaxAttempts: 3,
    autoStart: false,
    ...overrides,
  });
  const handler = new SourceIndexingHandler(db as any, indexing);
  queue.registerHandler(handler);
  const jobsService = new SourceJobsService(db as any, queue);
  return { jobs: jobsService, indexing, queue, handler };
}

async function waitForStatus(
  sourceId: string,
  expected: string[],
  timeoutMs = 8_000,
): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const [row] = await db
      .select({ status: jobs.status })
      .from(jobs)
      .where(
        and(
          eq(jobs.type, 'source_indexing'),
          eq(jobs.groupKey, `source:${sourceId}`),
        ),
      )
      .orderBy(desc(jobs.createdAt))
      .limit(1);
    if (row && expected.includes(row.status)) return row.status;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`Timeout waiting for status in ${expected.join(',')}`);
}

describe('SourceJobsService', () => {
  it('processes an enqueued job end-to-end and stores chunk count', async () => {
    const embedding = fakeEmbeddingService();
    const { jobs: service, queue } = makeJobsService(embedding);

    const user = await seedUser();
    const notebook = await seedNotebook(user.id);
    const source = await seedSource(notebook.id, {
      title: 'Durable Indexing',
      rawText: LONG_TEXT,
      kind: 'text',
      contentHash: 'hash-abc-123',
    });

    const job = await service.enqueue(source.id);
    expect(job.status).toBe('pending');

    await queue.drain();

    const status = await waitForStatus(source.id, ['ready', 'failed']);
    expect(status).toBe('ready');

    const latest = await service.latestForSource(source.id);
    expect(latest?.status).toBe('ready');
    expect(latest?.chunksCount).toBeGreaterThan(0);
    expect(latest?.completedAt).toBeDefined();

    const chunks = await db
      .select()
      .from(sourceChunks)
      .where(eq(sourceChunks.sourceId, source.id));
    expect(chunks.length).toBe(latest?.chunksCount);
  });

  it('retries with backoff and fails after the attempt limit', async () => {
    const embedding = {
      generateEmbeddings: vi.fn().mockRejectedValue(new Error('provider down')),
    } as any;
    const { jobs: service, queue } = makeJobsService(embedding, {
      defaultBackoffBaseMs: 50,
      defaultMaxAttempts: 3,
    });

    const user = await seedUser();
    const notebook = await seedNotebook(user.id);
    const source = await seedSource(notebook.id, {
      title: 'Failing Source',
      rawText: 'short text',
      kind: 'text',
    });

    await service.enqueue(source.id);

    // Attempt 1
    await queue.drain();

    // Fast-forward backoffs to complete all 3 attempts
    for (let i = 0; i < 3; i++) {
      await db
        .update(jobs)
        .set({ nextAttemptAt: new Date(Date.now() - 1000) })
        .where(
          and(
            eq(jobs.type, 'source_indexing'),
            eq(jobs.groupKey, `source:${source.id}`),
          ),
        );
      await queue.drain();
    }

    const latest = await service.latestForSource(source.id);
    expect(latest?.status).toBe('failed');
    expect(latest?.lastError).toContain('provider down');
  });

  it('skips re-embedding unchanged content', async () => {
    const embedding = fakeEmbeddingService();
    const { jobs: service, queue } = makeJobsService(embedding);

    const user = await seedUser();
    const notebook = await seedNotebook(user.id);
    const source = await seedSource(notebook.id, {
      title: 'Stable Source',
      rawText: LONG_TEXT,
      kind: 'text',
      contentHash: 'stable-hash-1',
    });

    // Run 1: initial embed
    await service.enqueue(source.id);
    await queue.drain();

    const firstRunCalls = embedding.generateEmbeddings.mock.calls.length;
    expect(firstRunCalls).toBeGreaterThan(0);

    // Run 2: reindex same content -> skips re-embedding
    await service.enqueue(source.id);
    await queue.drain();

    expect(embedding.generateEmbeddings.mock.calls.length).toBe(firstRunCalls);
    const latest = await service.latestForSource(source.id);
    expect(latest?.status).toBe('ready');
  });

  it('re-embeds when content changes', async () => {
    const embedding = fakeEmbeddingService();
    const { jobs: service, queue } = makeJobsService(embedding);

    const user = await seedUser();
    const notebook = await seedNotebook(user.id);
    const source = await seedSource(notebook.id, {
      title: 'Changing Source',
      rawText: LONG_TEXT,
      kind: 'text',
      contentHash: 'hash-v1',
    });

    await service.enqueue(source.id);
    await queue.drain();
    const callsAfterV1 = embedding.generateEmbeddings.mock.calls.length;

    // Mutate the source content hash in the db
    await db
      .update(sources)
      .set({ contentHash: 'hash-v2' })
      .where(eq(sources.id, source.id));

    await service.enqueue(source.id);
    await queue.drain();

    expect(embedding.generateEmbeddings.mock.calls.length).toBeGreaterThan(
      callsAfterV1,
    );
  });

  it('cancels active jobs when a newer job is enqueued', async () => {
    const embedding = fakeEmbeddingService();
    const { jobs: service } = makeJobsService(embedding);

    const user = await seedUser();
    const notebook = await seedNotebook(user.id);
    const source = await seedSource(notebook.id, {
      title: 'Superseded Source',
      rawText: 'Initial text',
      kind: 'text',
    });

    const job1 = await service.enqueue(source.id);
    const job2 = await service.enqueue(source.id);

    const [stored1] = await db
      .select({ status: jobs.status })
      .from(jobs)
      .where(eq(jobs.id, job1.id));
    const [stored2] = await db
      .select({ status: jobs.status })
      .from(jobs)
      .where(eq(jobs.id, job2.id));

    expect(stored1.status).toBe('cancelled');
    expect(stored2.status).toBe('pending');
  });

  it('cancels active jobs for a deleted source', async () => {
    const embedding = fakeEmbeddingService();
    const { jobs: service } = makeJobsService(embedding);

    const user = await seedUser();
    const notebook = await seedNotebook(user.id);
    const source = await seedSource(notebook.id, {
      title: 'Doomed Source',
      rawText: 'About to be deleted',
      kind: 'text',
    });

    const job = await service.enqueue(source.id);
    await service.cancelForSource(source.id);

    const [stored] = await db
      .select({ status: jobs.status })
      .from(jobs)
      .where(eq(jobs.id, job.id));
    expect(stored.status).toBe('cancelled');
  });

  it('enqueues one job per source when reindexing a notebook', async () => {
    const embedding = fakeEmbeddingService();
    const { jobs: service } = makeJobsService(embedding);

    const user = await seedUser();
    const notebook = await seedNotebook(user.id);
    await seedSource(notebook.id, { title: 'A', rawText: 'A', kind: 'text' });
    await seedSource(notebook.id, { title: 'B', rawText: 'B', kind: 'text' });
    await seedSource(notebook.id, { title: 'C', rawText: 'C', kind: 'text' });

    const count = await service.reindexNotebook(notebook.id);
    expect(count).toBe(3);

    const rows = await db
      .select()
      .from(jobs)
      .where(eq(jobs.type, 'source_indexing'));
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });
});
