import { Module, OnModuleInit } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { CrawlerModule } from '../crawler/crawler.module';
import { JobQueueService } from '../jobs/job-queue.service';
import { NotebooksModule } from '../notebooks/notebooks.module';
import { DocumentNormalizerService } from './document-normalizer.service';
import { HttpFetcherService } from './http-fetcher.service';
import { SourceAcquisitionService } from './source-acquisition.service';
import { SourceExtractionService } from './source-extraction.service';
import { SourceIndexingHandler } from './source-indexing.handler';
import { SourceProcessingHandler } from './source-processing.handler';
import { SourceJobsService } from './source-jobs.service';
import { SourceVersionService } from './source-version.service';
import { SourceUploadsController } from './source-uploads.controller';
import { SourceUploadsService } from './source-uploads.service';
import { ImageInspectorService } from './image-inspector.service';
import { VisionExtractionService } from './vision-extraction.service';
import { AudioInspectorService } from './audio-inspector.service';
import { VideoInspectorService } from './video-inspector.service';
import { YouTubeAcquisitionService } from './youtube-acquisition.service';
import { TranscriptionService } from './transcription.service';
import { PptxInspectorService } from './pptx-inspector.service';
import { EpubInspectorService } from './epub-inspector.service';
import { PptxParserService } from './pptx-parser.service';
import { EpubParserService } from './epub-parser.service';
import { CaptionParserService } from './caption-parser.service';
import { YouTubeOAuthService } from './youtube-oauth.service';
import { TabularInspectorService } from './tabular-inspector.service';
import { TabularParserService } from './tabular-parser.service';
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
  imports: [NotebooksModule, AiModule, CrawlerModule],
  controllers: [SourcesController, SourceUploadsController],
  providers: [
    {
      provide: SOURCE_FETCH_CONFIG,
      useFactory: loadSourceFetchConfig,
    },
    SourcePolicyService,
    HttpFetcherService,
    SourceExtractionService,
    ImageInspectorService,
    VisionExtractionService,
    AudioInspectorService,
    VideoInspectorService,
    YouTubeAcquisitionService,
    TranscriptionService,
    PptxInspectorService,
    EpubInspectorService,
    PptxParserService,
    EpubParserService,
    CaptionParserService,
    YouTubeOAuthService,
    TabularInspectorService,
    TabularParserService,
    DocumentNormalizerService,
    WebScraperService,
    SourceAcquisitionService,
    SourceIndexingHandler,
    SourceProcessingHandler,
    SourceVersionService,
    SourceUploadsService,
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
    ImageInspectorService,
    VisionExtractionService,
    AudioInspectorService,
    VideoInspectorService,
    YouTubeAcquisitionService,
    CaptionParserService,
    YouTubeOAuthService,
    TabularInspectorService,
    TabularParserService,
    TranscriptionService,
    PptxInspectorService,
    EpubInspectorService,
    PptxParserService,
    EpubParserService,
  ],
})
export class SourcesModule implements OnModuleInit {
  constructor(
    private readonly jobQueue: JobQueueService,
    private readonly sourceIndexingHandler: SourceIndexingHandler,
    private readonly sourceProcessingHandler: SourceProcessingHandler,
    private readonly webSearchHandler: WebSearchHandler,
  ) {}

  onModuleInit(): void {
    this.jobQueue.registerHandler(this.sourceIndexingHandler);
    this.jobQueue.registerHandler(this.sourceProcessingHandler);
    this.jobQueue.registerHandler(this.webSearchHandler);
  }
}
