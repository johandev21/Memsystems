import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { jobs } from '../../database/schema';
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from '../ai/embedding.service';
import {
  INDEX_PROCESSING_VERSION,
  IndexingService,
  IndexResult,
} from '../ai/indexing.service';
import { DRIZZLE } from '../database/database.module';
import { Job, JobHandler } from '../jobs/job-handler.interface';

export interface SourceIndexingJobPayload {
  sourceId: string;
  notebookId: string;
  contentHash?: string | null;
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
  ) {}

  async shouldSkip(
    job: Job<SourceIndexingJobPayload, IndexResult>,
  ): Promise<IndexResult | null> {
    if (!job.payload.contentHash) return null;

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
      priorResult.processingVersion === INDEX_PROCESSING_VERSION &&
      priorResult.embeddingModel === EMBEDDING_MODEL &&
      priorResult.embeddingDimensions === EMBEDDING_DIMENSIONS
    ) {
      return priorResult;
    }

    return null;
  }

  async process(
    job: Job<SourceIndexingJobPayload, IndexResult>,
  ): Promise<IndexResult> {
    return this.indexingService.indexSource(job.payload.sourceId);
  }
}
