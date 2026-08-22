import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { jobs } from '../../database/schema';
import { DRIZZLE } from '../database/database.module';
import {
  EnqueueOptions,
  Job,
  JobHandler,
  JobRow,
} from './job-handler.interface';

export const JOB_QUEUE_CONFIG = 'JOB_QUEUE_CONFIG';

export interface JobQueueConfig {
  concurrency: number;
  pollIntervalMs: number;
  defaultMaxAttempts: number;
  defaultBackoffBaseMs: number;
  autoStart?: boolean;
}

export const DEFAULT_JOB_QUEUE_CONFIG: JobQueueConfig = {
  concurrency: 4,
  pollIntervalMs: 3_000,
  defaultMaxAttempts: 3,
  defaultBackoffBaseMs: 5_000,
  autoStart: true,
};

function parseIntEnv(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadJobQueueConfig(
  env: NodeJS.ProcessEnv = process.env,
): JobQueueConfig {
  return {
    concurrency: parseIntEnv(
      env.JOB_QUEUE_CONCURRENCY,
      DEFAULT_JOB_QUEUE_CONFIG.concurrency,
    ),
    pollIntervalMs: parseIntEnv(
      env.JOB_QUEUE_POLL_INTERVAL_MS,
      DEFAULT_JOB_QUEUE_CONFIG.pollIntervalMs,
    ),
    defaultMaxAttempts: parseIntEnv(
      env.JOB_QUEUE_MAX_ATTEMPTS,
      DEFAULT_JOB_QUEUE_CONFIG.defaultMaxAttempts,
    ),
    defaultBackoffBaseMs: parseIntEnv(
      env.JOB_QUEUE_BACKOFF_BASE_MS,
      DEFAULT_JOB_QUEUE_CONFIG.defaultBackoffBaseMs,
    ),
    autoStart: true,
  };
}

const ACTIVE_STATUSES = ['pending', 'processing'] as const;

@Injectable()
export class JobQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobQueueService.name);
  private readonly config: JobQueueConfig;
  private readonly handlers = new Map<string, JobHandler<unknown, unknown>>();
  private readonly activePerHandler = new Map<string, number>();
  private pollTimer: NodeJS.Timeout | null = null;
  private draining = false;
  private drainPromise: Promise<void> | null = null;
  private isDestroyed = false;

  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
    @Optional() @Inject(JOB_QUEUE_CONFIG) config?: JobQueueConfig,
  ) {
    this.config = config ?? loadJobQueueConfig();
  }

  onModuleInit(): void {
    if (this.config.autoStart !== false) {
      this.pollTimer = setInterval(
        () => void this.drain(),
        this.config.pollIntervalMs,
      );
      this.pollTimer.unref?.();
    }
  }

  onModuleDestroy(): void {
    this.isDestroyed = true;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  registerHandler<TPayload, TResult>(
    handler: JobHandler<TPayload, TResult>,
  ): void {
    if (this.handlers.has(handler.type)) {
      this.logger.warn(
        `Overriding existing handler for job type '${handler.type}'`,
      );
    }
    this.handlers.set(handler.type, handler);
  }

  async enqueue<TPayload, TResult = unknown>(
    type: string,
    payload: TPayload,
    options?: EnqueueOptions,
  ): Promise<Job<TPayload, TResult>> {
    const handler = this.handlers.get(type);
    const maxAttempts =
      options?.maxAttempts ??
      handler?.maxAttempts ??
      this.config.defaultMaxAttempts;
    const backoffBaseMs =
      options?.backoffBaseMs ??
      handler?.backoffBaseMs ??
      this.config.defaultBackoffBaseMs;
    const groupKey = options?.groupKey ?? null;

    if (groupKey && options?.onConflict === 'cancel_existing') {
      await this.cancelByGroup(groupKey);
    } else if (groupKey && options?.onConflict === 'replace') {
      await this.deleteByGroup(groupKey);
    }

    const [row] = await this.db
      .insert(jobs)
      .values({
        type,
        groupKey,
        payload: payload as any,
        status: 'pending',
        maxAttempts,
        backoffBaseMs,
      })
      .returning();

    if (this.config.autoStart !== false) {
      void this.drain();
    }

    return this.mapJob<TPayload, TResult>(row);
  }

  async getJob<TPayload = unknown, TResult = unknown>(
    id: string,
  ): Promise<Job<TPayload, TResult> | null> {
    const [row] = await this.db.select().from(jobs).where(eq(jobs.id, id));
    return row ? this.mapJob<TPayload, TResult>(row) : null;
  }

  async getLatestByGroup<TPayload = unknown, TResult = unknown>(
    groupKey: string,
  ): Promise<Job<TPayload, TResult> | null> {
    const [row] = await this.db
      .select()
      .from(jobs)
      .where(eq(jobs.groupKey, groupKey))
      .orderBy(desc(jobs.createdAt))
      .limit(1);
    return row ? this.mapJob<TPayload, TResult>(row) : null;
  }

  async cancelByGroup(groupKey: string): Promise<void> {
    await this.db
      .update(jobs)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(jobs.groupKey, groupKey),
          inArray(jobs.status, [...ACTIVE_STATUSES]),
        ),
      );
  }

  async deleteByGroup(groupKey: string): Promise<void> {
    await this.db.delete(jobs).where(eq(jobs.groupKey, groupKey));
  }

  drain(): Promise<void> {
    if (this.draining) {
      return this.drainPromise ?? Promise.resolve();
    }
    this.draining = true;
    this.drainPromise = (async () => {
      try {
        for (;;) {
          if (this.isDestroyed) break;
          const availableSlots = this.calculateAvailableSlots();
          if (availableSlots <= 0 || this.handlers.size === 0) break;

          const claimed = await this.claimNext(availableSlots);
          if (claimed.length === 0) break;

          await Promise.all(claimed.map((jobRow) => this.execute(jobRow)));
        }
      } finally {
        this.draining = false;
        this.drainPromise = null;
      }
    })();
    return this.drainPromise;
  }

  private calculateAvailableSlots(): number {
    let totalActive = 0;
    for (const count of this.activePerHandler.values()) {
      totalActive += count;
    }
    return Math.max(0, this.config.concurrency - totalActive);
  }

  private async claimNext(limit: number): Promise<JobRow[]> {
    const registeredTypes = Array.from(this.handlers.keys());
    if (registeredTypes.length === 0) return [];

    return this.db.transaction(async (tx) => {
      const candidates = await tx
        .select({ id: jobs.id })
        .from(jobs)
        .where(
          and(
            eq(jobs.status, 'pending'),
            inArray(jobs.type, registeredTypes),
            or(isNull(jobs.nextAttemptAt), lte(jobs.nextAttemptAt, new Date())),
          ),
        )
        .orderBy(asc(jobs.createdAt))
        .limit(limit)
        .for('update', { skipLocked: true });

      if (candidates.length === 0) return [];

      return tx
        .update(jobs)
        .set({
          status: 'processing',
          startedAt: new Date(),
          nextAttemptAt: null,
          attemptCount: sql`${jobs.attemptCount} + 1`,
        })
        .where(
          inArray(
            jobs.id,
            candidates.map((c) => c.id),
          ),
        )
        .returning();
    });
  }

  private async execute(jobRow: JobRow): Promise<void> {
    const handler = this.handlers.get(jobRow.type);
    if (!handler) {
      this.logger.error(`No handler registered for job type '${jobRow.type}'`);
      await this.db
        .update(jobs)
        .set({
          status: 'failed',
          lastError: `No handler registered for job type '${jobRow.type}'`,
          completedAt: new Date(),
        })
        .where(eq(jobs.id, jobRow.id));
      return;
    }

    const currentActive = this.activePerHandler.get(jobRow.type) ?? 0;
    this.activePerHandler.set(jobRow.type, currentActive + 1);

    const job = this.mapJob(jobRow);

    try {
      if (handler.shouldSkip) {
        const skipResult: unknown = await handler.shouldSkip(job);
        if (skipResult !== null && skipResult !== undefined) {
          await this.db
            .update(jobs)
            .set({
              status: 'ready',
              result: skipResult,
              lastError: null,
              completedAt: new Date(),
            })
            .where(eq(jobs.id, jobRow.id));
          return;
        }
      }

      const result: unknown = await handler.process(job);
      await this.db
        .update(jobs)
        .set({
          status: 'ready',
          result: result ?? null,
          lastError: null,
          completedAt: new Date(),
        })
        .where(eq(jobs.id, jobRow.id));
    } catch (err) {
      await this.handleFailure(jobRow, err);
    } finally {
      const remaining = (this.activePerHandler.get(jobRow.type) ?? 1) - 1;
      this.activePerHandler.set(jobRow.type, Math.max(0, remaining));
    }
  }

  private async handleFailure(jobRow: JobRow, err: unknown): Promise<void> {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(
      `Job '${jobRow.id}' (${jobRow.type}) failed on attempt ${jobRow.attemptCount}`,
      {
        jobId: jobRow.id,
        type: jobRow.type,
        attempt: jobRow.attemptCount,
        error: message,
      },
    );

    if (jobRow.attemptCount >= jobRow.maxAttempts) {
      await this.db
        .update(jobs)
        .set({
          status: 'failed',
          lastError: message,
          completedAt: new Date(),
        })
        .where(eq(jobs.id, jobRow.id));
      return;
    }

    const backoffMs = jobRow.backoffBaseMs * 2 ** (jobRow.attemptCount - 1);
    await this.db
      .update(jobs)
      .set({
        status: 'pending',
        lastError: message,
        nextAttemptAt: new Date(Date.now() + backoffMs),
      })
      .where(eq(jobs.id, jobRow.id));
  }

  private mapJob<TPayload, TResult>(row: JobRow): Job<TPayload, TResult> {
    return {
      id: row.id,
      type: row.type,
      groupKey: row.groupKey,
      payload: row.payload as TPayload,
      status: row.status,
      result: row.result as TResult | null,
      lastError: row.lastError,
      attemptCount: row.attemptCount,
      maxAttempts: row.maxAttempts,
      backoffBaseMs: row.backoffBaseMs,
      nextAttemptAt: row.nextAttemptAt,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
