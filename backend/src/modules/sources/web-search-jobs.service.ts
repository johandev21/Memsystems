import { Injectable } from '@nestjs/common';
import { WebSearchResult } from '../ai/ai.service';
import { Job } from '../jobs/job-handler.interface';
import { JobQueueService } from '../jobs/job-queue.service';
import { NotebooksService } from '../notebooks/notebooks.service';
import { WebSearchJobPayload } from './web-search.handler';

export interface FormattedWebSearchJob {
  id: string;
  notebookId: string;
  userId: string;
  query: string;
  modelId: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  summary: string | null;
  candidates: { title: string; url: string; description: string | null }[];
  lastError: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export function formatWebSearchJob(
  job: Job<WebSearchJobPayload, WebSearchResult>,
): FormattedWebSearchJob {
  return {
    id: job.id,
    notebookId: job.payload.notebookId,
    userId: job.payload.userId,
    query: job.payload.query,
    modelId: job.payload.modelId,
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
    userId: string,
    notebookId: string,
    input: { query: string; modelId: string },
  ): Promise<FormattedWebSearchJob> {
    await this.notebooksService.assertNotebookOwner(userId, notebookId);

    const job = await this.jobQueue.enqueue<
      WebSearchJobPayload,
      WebSearchResult
    >(
      'web_search',
      {
        userId,
        notebookId,
        query: input.query,
        modelId: input.modelId,
      },
      {
        groupKey: `web_search:${notebookId}`,
        onConflict: 'replace',
      },
    );

    return formatWebSearchJob(job);
  }

  async latest(
    userId: string,
    notebookId: string,
  ): Promise<FormattedWebSearchJob | null> {
    await this.notebooksService.assertNotebookOwner(userId, notebookId);
    const job = await this.jobQueue.getLatestByGroup<
      WebSearchJobPayload,
      WebSearchResult
    >(`web_search:${notebookId}`);
    return job ? formatWebSearchJob(job) : null;
  }

  async dismiss(userId: string, notebookId: string): Promise<void> {
    await this.notebooksService.assertNotebookOwner(userId, notebookId);
    await this.jobQueue.deleteByGroup(`web_search:${notebookId}`);
  }

  async drain(): Promise<void> {
    await this.jobQueue.drain();
  }
}
