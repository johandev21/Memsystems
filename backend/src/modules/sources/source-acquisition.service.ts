import { Injectable, Optional } from '@nestjs/common';
import {
  DocumentNormalizerService,
  NormalizedDocument,
} from './document-normalizer.service';
import { HttpFetcherService } from './http-fetcher.service';
import { ImageInspectorService } from './image-inspector.service';
import { SourceExtractionService } from './source-extraction.service';
import { SourcePolicyService } from './source-policy.service';
import { VisionExtractionService } from './vision-extraction.service';
import { WebScraperService } from './web-scraper.service';
import {
  extractYouTubeVideoId,
  isYouTubeUrl,
  YouTubeAcquisitionOptions,
  YouTubeAcquisitionService,
} from './youtube-acquisition.service';

/** A normalized URL document plus the fetch provenance used for persistence. */
export interface AcquiredUrlDocument extends NormalizedDocument {
  status: number;
  httpContentType: string;
  etag?: string;
  lastModified?: string;
  robotsDecision: string;
  redirects: string[];
}

export type AcquireUrlOptions = YouTubeAcquisitionOptions;

@Injectable()
export class SourceAcquisitionService {
  constructor(
    private readonly policyService: SourcePolicyService,
    private readonly httpFetcher: HttpFetcherService,
    private readonly webScraper: WebScraperService,
    private readonly normalizer: DocumentNormalizerService,
    private readonly extraction: SourceExtractionService,
    private readonly imageInspector: ImageInspectorService,
    private readonly visionExtraction: VisionExtractionService,
    @Optional() private readonly youtubeAcquisition?: YouTubeAcquisitionService,
  ) {}

  /**
   * Full URL pipeline: identifies YouTube video URLs and routes to dedicated adapter,
   * or runs standard policy validation -> bounded fetch -> Readability extraction -> normalized document.
   */
  async acquireUrl(
    input: string,
    options: AcquireUrlOptions = {},
  ): Promise<AcquiredUrlDocument> {
    const trimmed = (input || '').trim();

    if (isYouTubeUrl(trimmed)) {
      const youtube =
        this.youtubeAcquisition ?? new YouTubeAcquisitionService();
      const videoId = extractYouTubeVideoId(trimmed) ?? trimmed;
      const ytResult = await youtube.acquire(input, options);
      const doc = this.normalizer.fromYouTubeResult(ytResult, {
        sourceUrl: input,
        canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
        contentType: 'text/html',
      });
      return {
        ...doc,
        status: 200,
        httpContentType: 'text/html',
        robotsDecision: 'allowed',
        redirects: [],
      };
    }

    // Default web fetch & scrape pipeline
    const fetched = await this.httpFetcher.fetchHtml(input);
    const page = this.webScraper.extractHtml(fetched.body, fetched.url);
    const document = this.normalizer.fromHtml(page, {
      sourceUrl: fetched.requestedUrl,
      canonicalUrl: fetched.canonicalUrl,
      fetchedUrl: fetched.url,
      contentType: fetched.contentType,
    });

    return {
      ...document,
      status: fetched.status,
      httpContentType: fetched.contentType,
      etag: fetched.etag,
      lastModified: fetched.lastModified,
      robotsDecision: fetched.robotsDecision,
      redirects: fetched.redirects,
    };
  }

  /** Uploaded file pipeline: extraction -> normalized document. */
  async acquireFile(
    buffer: Buffer,
    contentType: string,
    fileName: string,
    options: { userId?: string; modelId?: string } = {},
  ): Promise<NormalizedDocument> {
    if (this.extraction.isImageFile(contentType, fileName)) {
      const inspected = this.imageInspector.inspect(buffer);
      const visionResult = await this.visionExtraction.extract({
        imageBuffer: buffer,
        mimeType: inspected.mimeType,
        fileName,
        userId: options.userId,
        modelId: options.modelId,
      });
      return this.normalizer.fromImageResult(visionResult, {
        fileName,
        contentType: inspected.mimeType,
      });
    }

    const extracted = await this.extraction.extractText(
      buffer,
      contentType,
      fileName,
    );
    return this.normalizer.fromFile({
      text: extracted.text,
      contentType,
      fileName,
      pageCount: extracted.pageCount,
    });
  }

  /** Pasted text pipeline: direct normalization. */
  fromText(rawText: string, title: string): NormalizedDocument {
    return this.normalizer.fromText(rawText, title);
  }
}
