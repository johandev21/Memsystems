import { describe, expect, it, vi } from 'vitest';
import { JobQueueService } from '../src/modules/jobs/job-queue.service';
import { NotebooksService } from '../src/modules/notebooks/notebooks.service';
import { StorageService } from '../src/modules/storage/storage.service';
import { WebSearchHandler } from '../src/modules/sources/web-search.handler';
import { WebSearchJobsService } from '../src/modules/sources/web-search-jobs.service';
import { seedNotebook } from './fixtures';
import { db } from './db';

function createJobsService(searchImpl: () => Promise<unknown>) {
  const mockConfigService = {
    get: (key: string) => {
      if (key === 'DEV_STORAGE_TOKEN_SECRET') return 'dev-storage-secret-test';
      return undefined;
    },
  } as any;
  const notebooksService = new NotebooksService(
    db as any,
    new StorageService(mockConfigService),
  );
  const webSearchService = {
    search: vi.fn(searchImpl),
  } as any;
  const queue = new JobQueueService(db as any, {
    concurrency: 2,
    pollIntervalMs: 60_000,
    defaultBackoffBaseMs: 1_000,
    defaultMaxAttempts: 1,
    autoStart: false,
  });
  const handler = new WebSearchHandler(webSearchService);
  queue.registerHandler(handler);
  const service = new WebSearchJobsService(notebooksService, queue);
  return { db, service, webSearchService, queue, handler };
}

const SEARCH_RESULT = {
  query: 'philosophy',
  modelId: 'openai/gpt-5.6-sol',
  summary: 'A summary of philosophy sources.',
  sources: [
    {
      title: 'Stanford Encyclopedia',
      url: 'https://plato.stanford.edu',
      description: 'Deep dive',
    },
  ],
};

describe('WebSearchJobsService', () => {
  it('enqueue creates a pending job and processing marks it ready with candidates', async () => {
    const { service, queue } = createJobsService(async () => SEARCH_RESULT);
    const notebook = await seedNotebook();

    const job = await service.enqueue(notebook.id, {
      query: 'philosophy',
      modelId: 'openai/gpt-5.6-sol',
    });
    expect(job.status).toBe('pending');

    await queue.drain();

    const latest = await service.latest(notebook.id);
    expect(latest?.status).toBe('ready');
    expect(latest?.summary).toBe('A summary of philosophy sources.');
    expect(latest?.candidates).toEqual([
      {
        title: 'Stanford Encyclopedia',
        url: 'https://plato.stanford.edu',
        description: 'Deep dive',
      },
    ]);
    expect(latest?.completedAt).toBeDefined();
  });

  it('enqueue replaces the previous job so only the latest remains', async () => {
    const { service } = createJobsService(async () => SEARCH_RESULT);
    const notebook = await seedNotebook();

    const job1 = await service.enqueue(notebook.id, {
      query: 'first query',
      modelId: 'openai/gpt-5.6-sol',
    });

    const job2 = await service.enqueue(notebook.id, {
      query: 'second query',
      modelId: 'openai/gpt-5.6-sol',
    });

    expect(job1.id).not.toBe(job2.id);
    const latest = await service.latest(notebook.id);
    expect(latest?.id).toBe(job2.id);
    expect(latest?.query).toBe('second query');
  });

  it('a failing search marks the job failed with the error message', async () => {
    const { service, queue } = createJobsService(async () => {
      throw new Error('provider unavailable');
    });
    const notebook = await seedNotebook();

    await service.enqueue(notebook.id, {
      query: 'failing query',
      modelId: 'openai/gpt-5.6-sol',
    });

    await queue.drain();

    const latest = await service.latest(notebook.id);
    expect(latest?.status).toBe('failed');
    expect(latest?.lastError).toContain('provider unavailable');
  });

  it('dismiss deletes the latest job', async () => {
    const { service } = createJobsService(async () => SEARCH_RESULT);
    const notebook = await seedNotebook();

    await service.enqueue(notebook.id, {
      query: 'dismiss query',
      modelId: 'openai/gpt-5.6-sol',
    });

    await service.dismiss(notebook.id);
    const latest = await service.latest(notebook.id);
    expect(latest).toBeNull();
  });

  it('latest returns null for a notebook with no jobs', async () => {
    const { service } = createJobsService(async () => SEARCH_RESULT);
    const notebook = await seedNotebook();

    const latest = await service.latest(notebook.id);
    expect(latest).toBeNull();
  });
});
