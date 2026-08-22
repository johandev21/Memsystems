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
      .select({
        id: sources.id,
        notebookId: sources.notebookId,
        contentHash: sources.contentHash,
      })
      .from(sources)
      .where(eq(sources.id, sourceId));

    if (!source) throw new NotFoundError('Source');

    const job = await this.jobQueue.enqueue<
      SourceIndexingJobPayload,
      IndexResult
    >(
      'source_indexing',
      {
        sourceId,
        notebookId: source.notebookId,
        contentHash: source.contentHash ?? null,
      },
      {
        groupKey: `source:${sourceId}`,
        onConflict: 'cancel_existing',
      },
    );

    return formatSourceJob(job);
  }

  async reindexNotebook(notebookId: string): Promise<number> {
    const rows = await this.db
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.notebookId, notebookId));

    for (const row of rows) {
      await this.enqueue(row.id);
    }
    return rows.length;
  }

  async cancelForSource(sourceId: string): Promise<void> {
    await this.jobQueue.cancelByGroup(`source:${sourceId}`);
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
