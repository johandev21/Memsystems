import { Injectable } from '@nestjs/common';
import { Job } from '../jobs/job-handler.interface';
import { JobQueueService } from '../jobs/job-queue.service';
import { NotebooksService } from '../notebooks/notebooks.service';
import { WebSearchJobPayload } from './web-search.handler';
import { WebSearchSearchResponse } from './web-search.service';

export interface FormattedWebSearchJob {
  id: string;
  notebookId: string;
  query: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  summary: string | null;
  candidates: { title: string; url: string; description: string | null }[];
  lastError: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export function formatWebSearchJob(
  job: Job<WebSearchJobPayload, WebSearchSearchResponse>,
): FormattedWebSearchJob {
  return {
    id: job.id,
    notebookId: job.payload.notebookId,
    query: job.payload.query,
    status: job.status === 'cancelled' ? 'failed' : job.status,
    summary: job.result?.summary ?? null,
    candidates: (job.result?.sources ?? []).map((s) => ({
      title: s.title,
      url: s.url,
      description: s.description ?? null,
    })),
    lastError: job.lastError,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  };
}

@Injectable()
export class WebSearchJobsService {
  constructor(
    private readonly notebooksService: NotebooksService,
    private readonly jobQueue: JobQueueService,
  ) {}

  async enqueue(
    notebookId: string,
    input: { query: string },
  ): Promise<FormattedWebSearchJob> {
    await this.notebooksService.assertNotebookOwner(notebookId);

    const job = await this.jobQueue.enqueue<
      WebSearchJobPayload,
      WebSearchSearchResponse
    >(
      'web_search',
      {
        notebookId,
        query: input.query,
      },
      {
        groupKey: `web_search:${notebookId}`,
        onConflict: 'replace',
      },
    );

    return formatWebSearchJob(job);
  }

  async latest(notebookId: string): Promise<FormattedWebSearchJob | null> {
    await this.notebooksService.assertNotebookOwner(notebookId);
    const job = await this.jobQueue.getLatestByGroup<
      WebSearchJobPayload,
      WebSearchSearchResponse
    >(`web_search:${notebookId}`);
    return job ? formatWebSearchJob(job) : null;
  }

  async dismiss(notebookId: string): Promise<void> {
    await this.notebooksService.assertNotebookOwner(notebookId);
    await this.jobQueue.deleteByGroup(`web_search:${notebookId}`);
  }

  async drain(): Promise<void> {
    await this.jobQueue.drain();
  }
}
