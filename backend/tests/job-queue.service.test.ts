import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jobs } from '../src/database/schema';
import { Job, JobHandler } from '../src/modules/jobs/job-handler.interface';
import {
  JobQueueConfig,
  JobQueueService,
} from '../src/modules/jobs/job-queue.service';
import { db, resetDatabase } from './db';

const TEST_CONFIG: JobQueueConfig = {
  concurrency: 2,
  pollIntervalMs: 50,
  defaultMaxAttempts: 3,
  defaultBackoffBaseMs: 50,
};

describe('JobQueueService', () => {
  let queue: JobQueueService;

  beforeEach(async () => {
    await resetDatabase();
    queue = new JobQueueService(db as any, { ...TEST_CONFIG, autoStart: false });
  });

  it('enqueues a job with pending status and default attempt counters', async () => {
    const job = await queue.enqueue('test_task', { foo: 'bar' });

    expect(job.id).toBeDefined();
    expect(job.type).toBe('test_task');
    expect(job.status).toBe('pending');
    expect(job.payload).toEqual({ foo: 'bar' });
    expect(job.attemptCount).toBe(0);
    expect(job.maxAttempts).toBe(3);

    const [stored] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(stored).toBeDefined();
    expect(stored.status).toBe('pending');
  });

  it('executes a registered handler and records the result on success', async () => {
    const handler: JobHandler<{ value: number }, { doubled: number }> = {
      type: 'double_task',
      process: vi.fn().mockImplementation(async (job: Job<{ value: number }>) => {
        return { doubled: job.payload.value * 2 };
      }),
    };

    queue.registerHandler(handler);

    const job = await queue.enqueue('double_task', { value: 21 });
    await queue.drain();

    expect(handler.process).toHaveBeenCalledTimes(1);

    const [stored] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(stored.status).toBe('ready');
    expect(stored.result).toEqual({ doubled: 42 });
    expect(stored.completedAt).toBeDefined();
    expect(stored.lastError).toBeNull();
  });

  it('handles idempotency fast-path via shouldSkip hook', async () => {
    const handler: JobHandler<{ key: string }, { cached: boolean }> = {
      type: 'cache_task',
      shouldSkip: vi.fn().mockResolvedValue({ cached: true }),
      process: vi.fn().mockResolvedValue({ cached: false }),
    };

    queue.registerHandler(handler);

    const job = await queue.enqueue('cache_task', { key: 'existing' });
    await queue.drain();

    expect(handler.shouldSkip).toHaveBeenCalledTimes(1);
    expect(handler.process).not.toHaveBeenCalled();

    const [stored] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(stored.status).toBe('ready');
    expect(stored.result).toEqual({ cached: true });
  });

  it('retries with exponential backoff on transient failure', async () => {
    let attempts = 0;
    const handler: JobHandler<{ data: string }, { success: boolean }> = {
      type: 'retry_task',
      backoffBaseMs: 100,
      maxAttempts: 3,
      process: vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts === 1) {
          throw new Error('transient network failure');
        }
        return { success: true };
      }),
    };

    queue.registerHandler(handler);

    const job = await queue.enqueue('retry_task', { data: 'test' });

    // First attempt fails -> becomes pending with nextAttemptAt scheduled
    await queue.drain();

    const [afterFirst] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(afterFirst.status).toBe('pending');
    expect(afterFirst.attemptCount).toBe(1);
    expect(afterFirst.lastError).toContain('transient network failure');
    expect(afterFirst.nextAttemptAt).toBeDefined();

    // Set nextAttemptAt to past to simulate backoff elapsing
    await db
      .update(jobs)
      .set({ nextAttemptAt: new Date(Date.now() - 1000) })
      .where(eq(jobs.id, job.id));

    // Second attempt succeeds
    await queue.drain();

    const [afterSecond] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(afterSecond.status).toBe('ready');
    expect(afterSecond.attemptCount).toBe(2);
    expect(afterSecond.result).toEqual({ success: true });
    expect(afterSecond.lastError).toBeNull();
  });

  it('marks job failed when maximum attempts are exceeded', async () => {
    const handler: JobHandler<{ data: string }, void> = {
      type: 'failing_task',
      maxAttempts: 2,
      process: vi.fn().mockRejectedValue(new Error('permanent error')),
    };

    queue.registerHandler(handler);

    const job = await queue.enqueue('failing_task', { data: 'test' }, { maxAttempts: 2 });

    // Attempt 1
    await queue.drain();
    let [stored] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(stored.status).toBe('pending');
    expect(stored.attemptCount).toBe(1);

    // Make due and attempt 2 (terminal)
    await db
      .update(jobs)
      .set({ nextAttemptAt: new Date(Date.now() - 1000) })
      .where(eq(jobs.id, job.id));

    await queue.drain();
    [stored] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(stored.status).toBe('failed');
    expect(stored.attemptCount).toBe(2);
    expect(stored.lastError).toContain('permanent error');
    expect(stored.completedAt).toBeDefined();
  });

  it('cancels active existing jobs when enqueuing with onConflict: cancel_existing', async () => {
    const job1 = await queue.enqueue(
      'grouped_task',
      { step: 1 },
      { groupKey: 'group:123', onConflict: 'cancel_existing' },
    );

    const job2 = await queue.enqueue(
      'grouped_task',
      { step: 2 },
      { groupKey: 'group:123', onConflict: 'cancel_existing' },
    );

    const [stored1] = await db.select().from(jobs).where(eq(jobs.id, job1.id));
    const [stored2] = await db.select().from(jobs).where(eq(jobs.id, job2.id));

    expect(stored1.status).toBe('cancelled');
    expect(stored2.status).toBe('pending');
  });

  it('deletes prior jobs when enqueuing with onConflict: replace', async () => {
    const job1 = await queue.enqueue(
      'search_task',
      { query: 'alpha' },
      { groupKey: 'search:nb-1', onConflict: 'replace' },
    );

    const job2 = await queue.enqueue(
      'search_task',
      { query: 'beta' },
      { groupKey: 'search:nb-1', onConflict: 'replace' },
    );

    const stored1 = await db.select().from(jobs).where(eq(jobs.id, job1.id));
    const [stored2] = await db.select().from(jobs).where(eq(jobs.id, job2.id));

    expect(stored1).toHaveLength(0);
    expect(stored2).toBeDefined();
    expect(stored2.payload).toEqual({ query: 'beta' });
  });

  it('retries latest job by groupKey', async () => {
    await queue.enqueue('t1', { v: 1 }, { groupKey: 'g:1' });
    const job2 = await queue.enqueue('t1', { v: 2 }, { groupKey: 'g:1' });

    const latest = await queue.getLatestByGroup('g:1');
    expect(latest).toBeDefined();
    expect(latest?.id).toBe(job2.id);
  });

  it('cancels active jobs by groupKey', async () => {
    const job = await queue.enqueue('t1', { v: 1 }, { groupKey: 'g:cancel' });
    await queue.cancelByGroup('g:cancel');

    const [stored] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(stored.status).toBe('cancelled');
  });

  it('bounds parallel job execution to handler concurrency', async () => {
    let activeWorkers = 0;
    let maxObservedWorkers = 0;

    const handler: JobHandler<{ index: number }, void> = {
      type: 'parallel_task',
      concurrency: 2,
      process: vi.fn().mockImplementation(async () => {
        activeWorkers++;
        maxObservedWorkers = Math.max(maxObservedWorkers, activeWorkers);
        await new Promise((resolve) => setTimeout(resolve, 50));
        activeWorkers--;
      }),
    };

    queue.registerHandler(handler);

    for (let i = 0; i < 5; i++) {
      await queue.enqueue('parallel_task', { index: i });
    }

    await queue.drain();

    expect(maxObservedWorkers).toBeLessThanOrEqual(2);
    expect(handler.process).toHaveBeenCalledTimes(5);
  });

  it('cleans up resources on module destroy', async () => {
    const runningQueue = new JobQueueService(db as any, {
      ...TEST_CONFIG,
      autoStart: true,
    });
    runningQueue.onModuleInit();

    expect(() => runningQueue.onModuleDestroy()).not.toThrow();
  });
});
