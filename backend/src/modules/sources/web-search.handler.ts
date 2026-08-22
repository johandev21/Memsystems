import { Injectable } from '@nestjs/common';
import { WebSearchResult } from '../ai/ai.service';
import { Job, JobHandler } from '../jobs/job-handler.interface';
import { WebSearchService } from './web-search.service';

export interface WebSearchJobPayload {
  userId: string;
  notebookId: string;
  query: string;
  modelId: string;
}

@Injectable()
export class WebSearchHandler implements JobHandler<
  WebSearchJobPayload,
  WebSearchResult
> {
  readonly type = 'web_search';
  readonly concurrency = 2;
  readonly maxAttempts = 1;
  readonly backoffBaseMs = 2_000;

  constructor(private readonly webSearchService: WebSearchService) {}

  async process(
    job: Job<WebSearchJobPayload, WebSearchResult>,
  ): Promise<WebSearchResult> {
    return this.webSearchService.search(
      job.payload.userId,
      job.payload.notebookId,
      {
        query: job.payload.query,
        modelId: job.payload.modelId,
      },
    );
  }
}
