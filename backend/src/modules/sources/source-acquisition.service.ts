import { Inject, Injectable, Optional } from '@nestjs/common';
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
import {
  RETRY_LINK_DENSITY_THRESHOLD,
  RETRY_MIN_TEXT_LENGTH,
} from './web-scraper.service';
import { measureTextLinkDensity } from './source-quality.service';
import {
  CRAWLER_SERVICE,
  type CrawledDocument,
  type CrawlerService,
} from '../crawler/crawler.types';

/** A normalized URL document plus the fetch provenance used for persistence. */
export interface AcquiredUrlDocument extends NormalizedDocument {
  status?: number;
  httpContentType?: string;
  etag?: string;
  lastModified?: string;
  robotsDecision?: string;
  redirects?: string[];
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
    @Optional()
    @Inject(CRAWLER_SERVICE)
    private readonly crawler?: CrawlerService,
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
    const validated = await this.policyService.validateUrl(input);

    if (this.crawler) {
      const requestedUrl = validated.url.toString();
      let document = this.fromCrawledDocument(
        await this.crawler.scrape(requestedUrl),
        input,
      );
      // A link-dense or very short main-content extraction is retried with
      // the heuristic loosened, so pages whose article was misclassified
      // still have a chance of being captured.
      if (this.needsLooserExtraction(document)) {
        const relaxed = await this.crawler
          .scrape(requestedUrl, { onlyMainContent: false })
          .catch(() => null);
        if (relaxed) {
          const relaxedDocument = this.fromCrawledDocument(relaxed, input);
          if (this.isBetterExtraction(relaxedDocument, document)) {
            document = relaxedDocument;
          }
        }
      }
      return document;
    }

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
    options: { modelId?: string } = {},
  ): Promise<NormalizedDocument> {
    if (this.extraction.isImageFile(contentType, fileName)) {
      const inspected = this.imageInspector.inspect(buffer);
      const visionResult = await this.visionExtraction.extract({
        imageBuffer: buffer,
        mimeType: inspected.mimeType,
        fileName,
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

  private fromCrawledDocument(
    crawled: CrawledDocument,
    input: string,
  ): AcquiredUrlDocument {
    const canonical = this.policyService.normalizeUrl(
      crawled.canonicalUrl || crawled.url,
    );
    const document = this.normalizer.fromFirecrawlResult(
      {
        title: crawled.title,
        markdown: crawled.markdown,
        metadata: crawled.metadata,
        html: crawled.html,
      },
      {
        sourceUrl: input,
        canonicalUrl: canonical,
        fetchedUrl: crawled.url,
        contentType: 'text/markdown',
      },
    );
    return {
      ...document,
      status: 200,
      httpContentType: 'text/markdown',
      robotsDecision: 'skipped',
      redirects: [],
    };
  }

  private needsLooserExtraction(document: NormalizedDocument): boolean {
    return (
      this.webLinkDensity(document) >= RETRY_LINK_DENSITY_THRESHOLD ||
      document.text.length < RETRY_MIN_TEXT_LENGTH
    );
  }

  private isBetterExtraction(
    candidate: NormalizedDocument,
    current: NormalizedDocument,
  ): boolean {
    const candidateDensity = this.webLinkDensity(candidate);
    const currentDensity = this.webLinkDensity(current);
    if (candidateDensity !== currentDensity) {
      return candidateDensity < currentDensity;
    }
    return candidate.text.length > current.text.length;
  }

  private webLinkDensity(document: NormalizedDocument): number {
    return measureTextLinkDensity(document.markdown?.trim() || document.text);
  }
}
