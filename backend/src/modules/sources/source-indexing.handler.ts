import { Inject, Injectable, Optional } from '@nestjs/common';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { jobs, sources } from '../../database/schema';
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from '../ai/embedding.service';
import {
  INDEX_PROCESSING_VERSION,
  IndexingService,
  IndexResult,
} from '../ai/indexing.service';
import { DomainError } from '../../common/errors/domain-error';
import { DRIZZLE } from '../database/database.module';
import { Job, JobHandler } from '../jobs/job-handler.interface';
import { SourceVersionService } from './source-version.service';

export interface SourceIndexingJobPayload {
  sourceId: string;
  notebookId: string;
  contentHash?: string | null;
  sourceVersionId?: string | null;
}

@Injectable()
export class SourceIndexingHandler implements JobHandler<
  SourceIndexingJobPayload,
  IndexResult
> {
  readonly type = 'source_indexing';
  readonly concurrency = 2;
  readonly maxAttempts = 3;
  readonly backoffBaseMs = 5_000;

  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly indexingService: IndexingService,
    @Optional() private readonly versions?: SourceVersionService,
  ) {}

  async shouldSkip(
    job: Job<SourceIndexingJobPayload, IndexResult>,
  ): Promise<IndexResult | null> {
    if (
      !job.payload.contentHash ||
      !(await this.isCurrentVersion(
        job.payload.sourceId,
        job.payload.sourceVersionId,
      ))
    ) {
      return null;
    }

    const [priorJob] = await this.db
      .select({ result: jobs.result })
      .from(jobs)
      .where(
        and(
          eq(jobs.type, this.type),
          eq(jobs.groupKey, `source:${job.payload.sourceId}`),
          eq(jobs.status, 'ready'),
          isNotNull(jobs.completedAt),
        ),
      )
      .orderBy(desc(jobs.completedAt))
      .limit(1);

    if (!priorJob || !priorJob.result) return null;

    const priorResult = priorJob.result as IndexResult;
    if (
      priorResult.contentHash === job.payload.contentHash &&
      (!job.payload.sourceVersionId ||
        priorResult.sourceVersionId === job.payload.sourceVersionId) &&
      priorResult.processingVersion === INDEX_PROCESSING_VERSION &&
      priorResult.embeddingModel === EMBEDDING_MODEL &&
      priorResult.embeddingDimensions === EMBEDDING_DIMENSIONS
    ) {
      if (this.versions) {
        await this.markReadyIfActive(
          job.id,
          job.payload.sourceId,
          job.payload.sourceVersionId ?? null,
        );
      }
      return priorResult;
    }

    return null;
  }

  async process(
    job: Job<SourceIndexingJobPayload, IndexResult>,
  ): Promise<IndexResult> {
    try {
      if (
        !(await this.isActive(job.id)) ||
        !(await this.isCurrentVersion(
          job.payload.sourceId,
          job.payload.sourceVersionId,
        ))
      ) {
        throw new Error('Source indexing job was cancelled or superseded');
      }
      const result = await this.indexingService.indexSource(
        job.payload.sourceId,
        job.payload.sourceVersionId ?? undefined,
        job.id,
      );
      if (this.versions && !result.cancelled) {
        await this.markReadyIfActive(
          job.id,
          job.payload.sourceId,
          job.payload.sourceVersionId ?? null,
        );
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const messageKey =
        error instanceof DomainError && error.messageKey
          ? error.messageKey
          : undefined;
      if (
        this.versions &&
        job.attemptCount >= job.maxAttempts &&
        (await this.isActive(job.id))
      ) {
        await this.versions.markFailed(
          job.payload.sourceId,
          messageKey ?? 'indexing_failed',
          messageKey ?? message,
        );
      }
      throw error;
    }
  }

  private async isActive(jobId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ status: jobs.status })
      .from(jobs)
      .where(eq(jobs.id, jobId));
    return row?.status === 'processing';
  }

  private async isCurrentVersion(
    sourceId: string,
    sourceVersionId?: string | null,
  ): Promise<boolean> {
    const [source] = await this.db
      .select({
        currentVersionId: sources.currentVersionId,
        processingStatus: sources.processingStatus,
        rawText: sources.rawText,
      })
      .from(sources)
      .where(eq(sources.id, sourceId));
    if (!source || source.processingStatus === 'cancelled') return false;
    if (!sourceVersionId) return source.rawText.trim().length > 0;
    return source?.currentVersionId === sourceVersionId;
  }

  private async markReadyIfActive(
    jobId: string,
    sourceId: string,
    sourceVersionId: string | null,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Match the indexing transaction's lock order. A cancellation that has
      // already won the job fence must not be followed by a ready transition.
      const [job] = await tx
        .select({ status: jobs.status })
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .for('update');
      if (!job || job.status !== 'processing') return;

      const [source] = await tx
        .select({
          processingStatus: sources.processingStatus,
          currentVersionId: sources.currentVersionId,
        })
        .from(sources)
        .where(eq(sources.id, sourceId))
        .for('update');
      if (
        !source ||
        source.processingStatus === 'cancelled' ||
        source.currentVersionId !== sourceVersionId
      ) {
        return;
      }

      await tx
        .update(sources)
        .set({
          processingStatus: 'ready',
          processingStage: null,
          processingErrorCode: null,
          processingErrorMessage: null,
        })
        .where(eq(sources.id, sourceId));
    });
  }
}
