import { Injectable } from '@nestjs/common';
import { Job, JobHandler } from '../jobs/job-handler.interface';
import {
  WebSearchSearchResponse,
  WebSearchService,
} from './web-search.service';

export interface WebSearchJobPayload {
  notebookId: string;
  query: string;
}

@Injectable()
export class WebSearchHandler implements JobHandler<
  WebSearchJobPayload,
  WebSearchSearchResponse
> {
  readonly type = 'web_search';
  readonly concurrency = 2;
  readonly maxAttempts = 1;
  readonly backoffBaseMs = 2_000;

  constructor(private readonly webSearchService: WebSearchService) {}

  async process(
    job: Job<WebSearchJobPayload, WebSearchSearchResponse>,
  ): Promise<WebSearchSearchResponse> {
    return this.webSearchService.search(job.payload.notebookId, {
      query: job.payload.query,
    });
  }
}
