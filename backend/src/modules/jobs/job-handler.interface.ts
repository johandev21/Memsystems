import { jobs } from '../../database/schema';

export type JobRow = typeof jobs.$inferSelect;
export type JobStatus = JobRow['status'];

export interface Job<TPayload = unknown, TResult = unknown> {
  id: string;
  type: string;
  groupKey: string | null;
  payload: TPayload;
  status: JobStatus;
  result: TResult | null;
  lastError: string | null;
  attemptCount: number;
  maxAttempts: number;
  backoffBaseMs: number;
  nextAttemptAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type OnConflictPolicy = 'cancel_existing' | 'replace' | 'enqueue_always';

export interface EnqueueOptions {
  groupKey?: string;
  onConflict?: OnConflictPolicy;
  maxAttempts?: number;
  backoffBaseMs?: number;
}

export interface JobHandler<TPayload = unknown, TResult = unknown> {
  readonly type: string;
  readonly concurrency?: number;
  readonly maxAttempts?: number;
  readonly backoffBaseMs?: number;
  process(job: Job<TPayload, TResult>): Promise<TResult>;
  shouldSkip?(job: Job<TPayload, TResult>): Promise<TResult | null>;
}
