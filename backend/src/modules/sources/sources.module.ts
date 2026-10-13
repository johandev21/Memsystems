import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import {
  EMBEDDING_DIMENSIONS,
  EmbeddingService,
} from '../ai/indexing/embedding.service';
import { indexingRepresentationKey } from '../ai/indexing/indexing.service';
import { CrawlerModule } from '../crawler/crawler.module';
import { JobQueueService } from '../jobs/job-queue.service';
import { NotebooksModule } from '../notebooks/notebooks.module';
import { DocumentNormalizerService } from './extraction/document-normalizer.service';
import { HttpFetcherService } from './acquisition/http-fetcher.service';
import { SourceAcquisitionService } from './acquisition/source-acquisition.service';
import { SourceExtractionService } from './extraction/source-extraction.service';
import { SourceIndexingHandler } from './jobs/source-indexing.handler';
import { SourceProcessingHandler } from './jobs/source-processing.handler';
import { SourceReindexAllHandler } from './jobs/source-reindex-all.handler';
import { SourceJobsService } from './jobs/source-jobs.service';
import { SourceVersionService } from './source-version.service';
import { SourceUploadsController } from './uploads/source-uploads.controller';
import { SourceUploadsService } from './uploads/source-uploads.service';
import { ImageInspectorService } from './extraction/image-inspector.service';
import { VisionExtractionService } from './extraction/vision-extraction.service';
import { AudioInspectorService } from './extraction/audio-inspector.service';
import { VideoInspectorService } from './extraction/video-inspector.service';
import { YouTubeAcquisitionService } from './acquisition/youtube-acquisition.service';
import { TranscriptionService } from './extraction/transcription.service';
import { PptxInspectorService } from './extraction/pptx-inspector.service';
import { EpubInspectorService } from './extraction/epub-inspector.service';
import { PptxParserService } from './extraction/pptx-parser.service';
import { EpubParserService } from './extraction/epub-parser.service';
import { CaptionParserService } from './extraction/caption-parser.service';
import { YouTubeOAuthService } from './acquisition/youtube-oauth.service';
import { TabularInspectorService } from './extraction/tabular-inspector.service';
import { TabularParserService } from './extraction/tabular-parser.service';
import {
  loadSourceFetchConfig,
  SOURCE_FETCH_CONFIG,
  SourcePolicyService,
} from './source-policy.service';
import {
  loadSourceQualityConfig,
  SOURCE_QUALITY_CONFIG,
  SourceQualityService,
} from './source-quality.service';
import { SourceFolderService } from './folders/source-folder.service';
import { SourceFoldersController } from './folders/source-folders.controller';
import { SourcesController } from './sources.controller';
import { SourcesService } from './sources.service';
import { WebScraperService } from './acquisition/web-scraper.service';
import { WebSearchHandler } from './jobs/web-search.handler';
import { WebSearchJobsService } from './acquisition/web-search-jobs.service';
import { WebSearchService } from './acquisition/web-search.service';

@Module({
  imports: [NotebooksModule, AiModule, CrawlerModule],
  controllers: [
    SourcesController,
    SourceFoldersController,
    SourceUploadsController,
  ],
  providers: [
    {
      provide: SOURCE_FETCH_CONFIG,
      useFactory: loadSourceFetchConfig,
    },
    {
      provide: SOURCE_QUALITY_CONFIG,
      useFactory: loadSourceQualityConfig,
    },
    SourcePolicyService,
    SourceQualityService,
    SourceFolderService,
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
    SourceReindexAllHandler,
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
    SourceFolderService,
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
  private readonly logger = new Logger(SourcesModule.name);

  constructor(
    private readonly jobQueue: JobQueueService,
    private readonly sourceJobsService: SourceJobsService,
    private readonly embeddingService: EmbeddingService,
    private readonly sourceIndexingHandler: SourceIndexingHandler,
    private readonly sourceProcessingHandler: SourceProcessingHandler,
    private readonly sourceReindexAllHandler: SourceReindexAllHandler,
    private readonly webSearchHandler: WebSearchHandler,
  ) {}

  async onModuleInit(): Promise<void> {
    this.jobQueue.registerHandler(this.sourceIndexingHandler);
    this.jobQueue.registerHandler(this.sourceProcessingHandler);
    this.jobQueue.registerHandler(this.sourceReindexAllHandler);
    this.jobQueue.registerHandler(this.webSearchHandler);

    await this.ensureIndexingRepresentation();
  }

  private async ensureIndexingRepresentation(): Promise<void> {
    try {
      const apiKey = await this.embeddingService.getVoyageApiKey();
      if (!apiKey) return;

      await this.embeddingService.ensureContextualAvailability(apiKey);
      await this.sourceJobsService.ensureRepresentationCurrent(
        indexingRepresentationKey(
          this.embeddingService.documentEmbeddingModel(),
          EMBEDDING_DIMENSIONS,
        ),
      );
    } catch (error) {
      this.logger.warn(
        `Could not check the indexing representation: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
