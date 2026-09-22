import { Injectable } from '@nestjs/common';
import { Job, JobHandler } from '../jobs/job-handler.interface';
import { SourceJobsService } from './source-jobs.service';

export interface SourceReindexAllJobPayload {
  /** Restrict the fan-out to one Notebook; null reindexes every Source. */
  notebookId?: string | null;
  /**
   * The representation key this fan-out brings the corpus up to, when it was
   * triggered by a representation change. The handler records it once the
   * fan-out succeeds, so a failed run is retried instead of forgotten.
   */
  representation?: string;
}

export interface SourceReindexAllResult {
  /** Per-Source indexing (or processing) jobs the fan-out enqueued. */
  sourcesQueued: number;
  /** Sources skipped because they have no usable representation. */
  skipped: number;
}

/**
 * The reindex-all job. It does not index anything itself: it fans out one
 * `source_indexing` job per eligible Source through the existing queue, so
 * each Source keeps the usual idempotency, cancellation, and atomic
 * replacement behavior. The representation version bump makes those jobs
 * rebuild every chunk; nothing has to be reindexed by hand per Source.
 */
@Injectable()
export class SourceReindexAllHandler implements JobHandler<
  SourceReindexAllJobPayload,
  SourceReindexAllResult
> {
  readonly type = 'source_reindex_all';
  readonly concurrency = 1;
  // The fan-out is idempotent (per-Source jobs use cancel_existing), so a
  // transient database failure is retried instead of leaving Sources stale.
  readonly maxAttempts = 3;
  readonly backoffBaseMs = 5_000;

  constructor(private readonly sourceJobsService: SourceJobsService) {}

  async process(
    job: Job<SourceReindexAllJobPayload, SourceReindexAllResult>,
  ): Promise<SourceReindexAllResult> {
    const result = await this.sourceJobsService.fanOutReindexes(
      job.payload.notebookId ?? null,
    );
    // Bookmark the representation only after the fan-out succeeded: a failed
    // run leaves the bookmark stale, so the next startup retries it.
    if (job.payload.representation) {
      await this.sourceJobsService.recordRepresentation(
        job.payload.representation,
      );
    }
    return result;
  }
}
