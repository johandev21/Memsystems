import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CrawlerService } from '../src/modules/crawler/crawler.types';
import { DocumentNormalizerService } from '../src/modules/sources/document-normalizer.service';
import type { HttpFetcherService } from '../src/modules/sources/http-fetcher.service';
import type { ImageInspectorService } from '../src/modules/sources/image-inspector.service';
import type { SourceExtractionService } from '../src/modules/sources/source-extraction.service';
import {
  DEFAULT_SOURCE_FETCH_CONFIG,
  SourcePolicyService,
} from '../src/modules/sources/source-policy.service';
import { SourceAcquisitionService } from '../src/modules/sources/source-acquisition.service';
import type { VisionExtractionService } from '../src/modules/sources/vision-extraction.service';
import type { WebScraperService } from '../src/modules/sources/web-scraper.service';
import type { YouTubeAcquisitionService } from '../src/modules/sources/youtube-acquisition.service';

function createHarness() {
  const policyService = new SourcePolicyService({
    ...DEFAULT_SOURCE_FETCH_CONFIG,
    allowPrivateAddresses: true,
  });
  const normalizer = new DocumentNormalizerService();

  const fetchHtml = vi.fn();
  const httpFetcher = {
    fetchHtml,
  } as unknown as HttpFetcherService;

  const webScraper = {
    extractHtml: vi.fn(),
  } as unknown as WebScraperService;

  const extraction = {} as unknown as SourceExtractionService;
  const imageInspector = {} as unknown as ImageInspectorService;
  const visionExtraction = {} as unknown as VisionExtractionService;

  const acquireYoutube = vi.fn();
  const youtubeAcquisition = {
    acquire: acquireYoutube,
  } as unknown as YouTubeAcquisitionService;

  const scrape = vi.fn();
  const crawler = {
    scrape,
  } as unknown as CrawlerService;

  const service = new SourceAcquisitionService(
    policyService,
    httpFetcher,
    webScraper,
    normalizer,
    extraction,
    imageInspector,
    visionExtraction,
    youtubeAcquisition,
    crawler,
  );

  return {
    service,
    fetchHtml,
    acquireYoutube,
    scrape,
  };
}

describe('SourceAcquisitionService with crawler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('routes non-YouTube URLs through the crawler instead of HttpFetcher', async () => {
    const harness = createHarness();
    harness.scrape.mockResolvedValue({
      url: 'https://example.com/article',
      canonicalUrl: 'https://example.com/article',
      title: 'T',
      markdown: '# Hi\nBody',
      metadata: { title: 'T', language: 'en' },
    });

    const doc = await harness.service.acquireUrl('https://example.com/article');

    expect(harness.scrape).toHaveBeenCalledTimes(1);
    expect(harness.scrape).toHaveBeenCalledWith(
      expect.stringContaining('example.com/article'),
    );
    expect(harness.fetchHtml).not.toHaveBeenCalled();
    expect(harness.acquireYoutube).not.toHaveBeenCalled();
    expect(doc.extractionMethod).toBe('firecrawl');
    expect(doc.title).toBe('T');
    expect(doc.markdown).toBe('# Hi\nBody');
    expect(doc.text).toContain('Body');
    expect(doc.status).toBe(200);
    expect(doc.httpContentType).toBe('text/markdown');
    expect(doc.robotsDecision).toBe('skipped');
  });

  it('still routes YouTube URLs to the YouTube path without calling the crawler', async () => {
    const harness = createHarness();
    harness.acquireYoutube.mockResolvedValue({
      videoId: 'dQw4w9WgXcQ',
      title: 'YT Title',
      author: 'Channel Host',
      durationMs: 60000,
      segments: [
        {
          content: 'Hello from YouTube.',
          startOffsetMs: 0,
          endOffsetMs: 5000,
        },
      ],
      rawText: 'Hello from YouTube.',
    });

    const doc = await harness.service.acquireUrl(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );

    expect(harness.acquireYoutube).toHaveBeenCalledTimes(1);
    expect(harness.scrape).not.toHaveBeenCalled();
    expect(harness.fetchHtml).not.toHaveBeenCalled();
    expect(doc.extractionMethod).toBe('youtube');
    expect(doc.title).toBe('YT Title');
  });
});
