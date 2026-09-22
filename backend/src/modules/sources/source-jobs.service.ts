import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { appSettings, sources } from '../../database/schema';
import { NotFoundError } from '../../common/errors/domain-error';
import { IndexResult } from '../ai/indexing.service';
import { APP_SETTINGS_ID } from '../ai/user-settings.service';
import { DRIZZLE } from '../database/database.module';
import { Job } from '../jobs/job-handler.interface';
import { JobQueueService } from '../jobs/job-queue.service';
import { SourceIndexingJobPayload } from './source-indexing.handler';
import type {
  SourceReindexAllJobPayload,
  SourceReindexAllResult,
} from './source-reindex-all.handler';
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
    const result = await this.fanOutReindexes(notebookId);
    return result.sourcesQueued;
  }

  /**
   * Operator action: re-index every source in the app. Used after an
   * embedding-model switch or a representation version bump invalidates
   * stored vectors. The work fans out as one indexing job per Source through
   * the queue; the jobs' shouldSkip and atomic-replace checks make repeated
   * fan-outs idempotent. `sourcesQueued` counts the Sources the queued
   * fan-out will rebuild.
   */
  async reembedAll(): Promise<{ sourcesQueued: number; jobId: string }> {
    const targets = await this.listReindexTargets(null);
    const job = await this.enqueueReindexAll({ notebookId: null });
    return { sourcesQueued: targets.length, jobId: job.id };
  }

  /**
   * Ensures every Source is rebuilt with the running representation. The
   * bookmark in `app_settings` holds the last representation a completed
   * fan-out applied, so a version bump triggers exactly one fan-out; a
   * restart with the same representation does nothing. The bookmark is
   * written by the fan-out job when it succeeds, so a failed fan-out is
   * retried on the next startup instead of being forgotten. `fanOutQueued`
   * says whether this call queued the fan-out.
   */
  async ensureRepresentationCurrent(
    representation: string,
  ): Promise<{ fanOutQueued: boolean }> {
    const [row] = await this.db
      .select({ applied: appSettings.indexingRepresentation })
      .from(appSettings)
      .where(eq(appSettings.id, APP_SETTINGS_ID));
    if (row?.applied === representation) return { fanOutQueued: false };

    const targets = await this.listReindexTargets(null);
    if (targets.length === 0) return { fanOutQueued: false };

    await this.enqueueReindexAll({
      notebookId: null,
      representation,
    });
    return { fanOutQueued: true };
  }

  /** Records the representation a completed reindex-all applied. */
  async recordRepresentation(representation: string): Promise<void> {
    await this.db
      .insert(appSettings)
      .values({ id: APP_SETTINGS_ID, indexingRepresentation: representation })
      .onConflictDoUpdate({
        target: appSettings.id,
        set: { indexingRepresentation: representation, updatedAt: new Date() },
      });
  }

  /** Enqueues one indexing job per eligible Source. */
  async fanOutReindexes(
    notebookId: string | null,
  ): Promise<SourceReindexAllResult> {
    const rows = await this.listReindexTargets(notebookId);
    let sourcesQueued = 0;
    let skipped = 0;
    for (const row of rows) {
      // Degraded sources have no usable Evidence to re-index; retrying them
      // individually re-runs extraction instead.
      if (row.kind === 'file' && row.s3Key && !row.currentVersionId) {
        await this.enqueueProcessing(row.id);
      } else if (row.currentVersionId || row.rawText.trim().length > 0) {
        await this.enqueue(row.id);
      } else {
        // An unextracted source with no original artifact cannot be indexed.
        skipped++;
        continue;
      }
      sourcesQueued++;
    }
    return { sourcesQueued, skipped };
  }

  /**
   * The sources a reindex-all run can rebuild: everything that is not
   * degraded and has some representation (a version or raw text).
   */
  private async listReindexTargets(notebookId: string | null) {
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
      .where(notebookId ? eq(sources.notebookId, notebookId) : undefined);
    return rows.filter((row) => row.processingStatus !== 'degraded');
  }

  private async enqueueReindexAll(
    payload: SourceReindexAllJobPayload,
  ): Promise<Job<SourceReindexAllJobPayload, SourceReindexAllResult>> {
    return this.jobQueue.enqueue<
      SourceReindexAllJobPayload,
      SourceReindexAllResult
    >('source_reindex_all', payload, {
      groupKey: 'source_reindex_all',
      onConflict: 'cancel_existing',
    });
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
