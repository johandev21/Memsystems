import { Module, OnModuleInit } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { JobQueueService } from '../jobs/job-queue.service';
import { NotebooksModule } from '../notebooks/notebooks.module';
import { DocumentNormalizerService } from './document-normalizer.service';
import { HttpFetcherService } from './http-fetcher.service';
import { SourceAcquisitionService } from './source-acquisition.service';
import { SourceExtractionService } from './source-extraction.service';
import { SourceIndexingHandler } from './source-indexing.handler';
import { SourceJobsService } from './source-jobs.service';
import {
  loadSourceFetchConfig,
  SOURCE_FETCH_CONFIG,
  SourcePolicyService,
} from './source-policy.service';
import { SourcesController } from './sources.controller';
import { SourcesService } from './sources.service';
import { WebScraperService } from './web-scraper.service';
import { WebSearchHandler } from './web-search.handler';
import { WebSearchJobsService } from './web-search-jobs.service';
import { WebSearchService } from './web-search.service';

@Module({
  imports: [NotebooksModule, AiModule],
  controllers: [SourcesController],
  providers: [
    {
      provide: SOURCE_FETCH_CONFIG,
      useFactory: loadSourceFetchConfig,
    },
    SourcePolicyService,
    HttpFetcherService,
    SourceExtractionService,
    DocumentNormalizerService,
    WebScraperService,
    SourceAcquisitionService,
    SourceIndexingHandler,
    WebSearchHandler,
    SourceJobsService,
    SourcesService,
    WebSearchService,
    WebSearchJobsService,
  ],
  exports: [
    SourcesService,
    WebSearchService,
    SourceJobsService,
    WebSearchJobsService,
    SourceIndexingHandler,
    WebSearchHandler,
  ],
})
export class SourcesModule implements OnModuleInit {
  constructor(
    private readonly jobQueue: JobQueueService,
    private readonly sourceIndexingHandler: SourceIndexingHandler,
    private readonly webSearchHandler: WebSearchHandler,
  ) {}

  onModuleInit(): void {
    this.jobQueue.registerHandler(this.sourceIndexingHandler);
    this.jobQueue.registerHandler(this.webSearchHandler);
  }
}
