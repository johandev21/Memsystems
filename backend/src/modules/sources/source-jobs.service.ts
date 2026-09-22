import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { sources } from '../../database/schema';
import { NotFoundError } from '../../common/errors/domain-error';
import { IndexResult } from '../ai/indexing.service';
import { DRIZZLE } from '../database/database.module';
import { Job } from '../jobs/job-handler.interface';
import { JobQueueService } from '../jobs/job-queue.service';
import { SourceIndexingJobPayload } from './source-indexing.handler';
import { SourceProcessingJobPayload } from './source-processing.handler';

export interface FormattedSourceJob {
  id: string;
  sourceId: string;
  notebookId: string;
  status: string;
  chunksCount: number | null;
  contentHash: string | null;
  processingVersion: number | null;
  embeddingModel: string | null;
  embeddingDimensions: number | null;
  lastError: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}

export function formatSourceJob(
  job: Job<SourceIndexingJobPayload, IndexResult>,
): FormattedSourceJob {
  return {
    id: job.id,
    sourceId: job.payload.sourceId,
    notebookId: job.payload.notebookId,
    status: job.status,
    chunksCount: job.result?.chunksCount ?? null,
    contentHash: job.result?.contentHash ?? job.payload.contentHash ?? null,
    processingVersion: job.result?.processingVersion ?? null,
    embeddingModel: job.result?.embeddingModel ?? null,
    embeddingDimensions: job.result?.embeddingDimensions ?? null,
    lastError: job.lastError,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  };
}

@Injectable()
export class SourceJobsService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly jobQueue: JobQueueService,
  ) {}

  async enqueue(sourceId: string): Promise<FormattedSourceJob> {
    const [source] = await this.db
      .select()
      .from(sources)
      .where(eq(sources.id, sourceId));

    if (!source)
      throw new NotFoundError('Source', {
        messageKey: 'errors.sources.source.notFound',
      });

    if (source.processingStatus === 'degraded') {
      // Degraded content is never indexed as Evidence. Re-run extraction so
      // the quality gate can re-evaluate it instead.
      return this.enqueueProcessing(sourceId);
    }

    if (this.needsProcessing(source)) {
      return this.enqueueProcessing(sourceId);
    }

    const job = await this.jobQueue.enqueue<
      SourceIndexingJobPayload,
      IndexResult
    >(
      'source_indexing',
      {
        sourceId,
        notebookId: source.notebookId,
        contentHash: source.contentHash ?? null,
        sourceVersionId: source.currentVersionId ?? null,
      },
      {
        groupKey: `source:${sourceId}`,
        onConflict: 'cancel_existing',
      },
    );

    return formatSourceJob(job);
  }

  /** Enqueues extraction from an immutable original artifact. */
  async enqueueProcessing(sourceId: string): Promise<FormattedSourceJob> {
    const [source] = await this.db
      .select()
      .from(sources)
      .where(eq(sources.id, sourceId));
    if (!source)
      throw new NotFoundError('Source', {
        messageKey: 'errors.sources.source.notFound',
      });

    const job = await this.jobQueue.enqueue<
      SourceProcessingJobPayload,
      unknown
    >(
      'source_processing',
      { sourceId, notebookId: source.notebookId },
      {
        groupKey: `source:${sourceId}:processing`,
        onConflict: 'cancel_existing',
      },
    );
    return formatSourceJob(
      job as unknown as Job<SourceIndexingJobPayload, IndexResult>,
    );
  }

  async reindexNotebook(notebookId: string): Promise<number> {
    const rows = await this.db
      .select({
        id: sources.id,
        kind: sources.kind,
        s3Key: sources.s3Key,
        rawText: sources.rawText,
        currentVersionId: sources.currentVersionId,
        processingStatus: sources.processingStatus,
      })
      .from(sources)
      .where(eq(sources.notebookId, notebookId));
    return this.enqueueReindexes(rows);
  }

  /**
   * Operator action: re-index every source in the app. Used after an
   * embedding-model switch invalidates stored vectors (the jobs' shouldSkip
   * model check makes re-enqueued work idempotent either way).
   */
  async reembedAll(): Promise<number> {
    const rows = await this.db
      .select({
        id: sources.id,
        kind: sources.kind,
        s3Key: sources.s3Key,
        rawText: sources.rawText,
        currentVersionId: sources.currentVersionId,
        processingStatus: sources.processingStatus,
      })
      .from(sources);
    return this.enqueueReindexes(rows);
  }

  private async enqueueReindexes(
    rows: {
      id: string;
      kind: string;
      s3Key: string | null;
      rawText: string;
      currentVersionId: string | null;
      processingStatus: string;
    }[],
  ): Promise<number> {
    let enqueued = 0;
    for (const row of rows) {
      // Degraded sources have no usable Evidence to re-index; retrying them
      // individually re-runs extraction instead.
      if (row.processingStatus === 'degraded') continue;
      if (row.kind === 'file' && row.s3Key && !row.currentVersionId) {
        await this.enqueueProcessing(row.id);
      } else if (row.currentVersionId || row.rawText.trim().length > 0) {
        await this.enqueue(row.id);
      } else {
        // An unextracted source with no original artifact cannot be indexed.
        continue;
      }
      enqueued++;
    }
    return enqueued;
  }

  private needsProcessing(source: {
    kind: string;
    s3Key: string | null;
    rawText: string;
    currentVersionId: string | null;
  }): boolean {
    return (
      source.kind === 'file' &&
      Boolean(source.s3Key) &&
      !source.currentVersionId
    );
  }

  async cancelForSource(sourceId: string): Promise<void> {
    await this.jobQueue.cancelByGroup(`source:${sourceId}`);
    await this.jobQueue.cancelByGroup(`source:${sourceId}:processing`);
  }

  async latestForSource(sourceId: string): Promise<FormattedSourceJob | null> {
    const job = await this.jobQueue.getLatestByGroup<
      SourceIndexingJobPayload,
      IndexResult
    >(`source:${sourceId}`);
    return job ? formatSourceJob(job) : null;
  }

  async drain(): Promise<void> {
    await this.jobQueue.drain();
  }
}
