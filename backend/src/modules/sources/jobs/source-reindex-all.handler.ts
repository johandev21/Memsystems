import { Injectable } from '@nestjs/common';
import { Job, JobHandler } from '../../jobs/job-handler.interface';
import { SourceJobsService } from './source-jobs.service';

export interface SourceReindexAllJobPayload {
  notebookId?: string | null;
  representation?: string;
}

export interface SourceReindexAllResult {
  sourcesQueued: number;
  skipped: number;
}

@Injectable()
export class SourceReindexAllHandler implements JobHandler<
  SourceReindexAllJobPayload,
  SourceReindexAllResult
> {
  readonly type = 'source_reindex_all';
  readonly concurrency = 1;
  readonly maxAttempts = 3;
  readonly backoffBaseMs = 5_000;

  constructor(private readonly sourceJobsService: SourceJobsService) {}

  async process(
    job: Job<SourceReindexAllJobPayload, SourceReindexAllResult>,
  ): Promise<SourceReindexAllResult> {
    const result = await this.sourceJobsService.fanOutReindexes(
      job.payload.notebookId ?? null,
    );
    if (job.payload.representation) {
      await this.sourceJobsService.recordRepresentation(
        job.payload.representation,
      );
    }
    return result;
  }
}
