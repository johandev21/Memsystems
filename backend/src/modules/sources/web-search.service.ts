import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { CRAWLER_SERVICE, type CrawlerService } from '../crawler/crawler.types';
import { NotebooksService } from '../notebooks/notebooks.service';
import { SOURCE_LIMIT, SourcesService } from './sources.service';
import {
  DomainError,
  ServiceUnavailableError,
} from '../../common/errors/domain-error';

const MIN_WEB_SEARCH_SOURCE_TEXT_LENGTH = 1000;

/** Number of candidates requested per search (current behaviour, kept). */
export const WEB_SEARCH_RESULT_LIMIT = 10;

export interface WebSearchCandidate {
  title: string;
  url: string;
  description: string | null;
}

export interface WebSearchSearchInput {
  query: string;
}

export interface WebSearchSearchResponse {
  query: string;
  /** Firecrawl search returns no AI summary; always null. */
  summary: string | null;
  sources: WebSearchCandidate[];
}

export interface WebSearchImportCandidate {
  url: string;
  title?: string;
  description?: string | null;
}

export interface WebSearchImportInput {
  candidates: WebSearchImportCandidate[];
  query: string;
}

export type WebSearchImportStatus =
  'added' | 'duplicate' | 'limit_reached' | 'scrape_failed';

export interface WebSearchImportResultItem {
  url: string;
  title: string;
  status: WebSearchImportStatus;
  sourceId?: string;
  error?: string;
}

export interface WebSearchImportResponse {
  results: WebSearchImportResultItem[];
}

@Injectable()
export class WebSearchService {
  private readonly logger = new Logger(WebSearchService.name);

  constructor(
    private readonly notebooksService: NotebooksService,
    private readonly sourcesService: SourcesService,
    @Optional()
    @Inject(CRAWLER_SERVICE)
    private readonly crawler?: CrawlerService,
  ) {
    if (!this.crawler) {
      this.logger.warn(
        'No crawler registered: web search is unavailable until CrawlerModule is wired.',
      );
    }
  }

  async search(
    notebookId: string,
    input: WebSearchSearchInput,
  ): Promise<WebSearchSearchResponse> {
    this.logger.log(`web-search search start`, {
      notebookId,
      query: input.query,
    });

    await this.notebooksService.assertNotebookOwner(notebookId);

    if (!this.crawler) {
      throw new ServiceUnavailableError(
        'Web search is unavailable: no crawler is configured.',
        { messageKey: 'errors.sources.webSearch.unavailable' },
      );
    }
    const found = await this.crawler.search(
      input.query,
      WEB_SEARCH_RESULT_LIMIT,
    );

    const existingUrls =
      await this.sourcesService.listUrlsForNotebook(notebookId);
    const existing = new Set(existingUrls);
    const sources = found.filter((s) => !existing.has(s.url));

    this.logger.log(`web-search search done`, {
      foundCount: found.length,
      deduplicatedCount: sources.length,
      existingCount: existing.size,
    });

    return {
      query: input.query,
      summary: null,
      sources,
    };
  }

  async import(
    notebookId: string,
    input: WebSearchImportInput,
  ): Promise<WebSearchImportResponse> {
    this.logger.log(`web-search import start`, {
      notebookId,
      candidateCount: input.candidates.length,
      query: input.query,
    });

    await this.notebooksService.assertNotebookOwner(notebookId);

    const existingUrls = new Set(
      await this.sourcesService.listUrlsForNotebook(notebookId),
    );
    let count = await this.sourcesService.countForNotebook(notebookId);

    const results: WebSearchImportResultItem[] = [];

    for (const candidate of input.candidates) {
      const fallbackTitle = candidate.url;
      // Descriptions arrive from Firecrawl unbounded; cap for metadata.
      const description = candidate.description?.slice(0, 500) ?? null;

      if (count >= SOURCE_LIMIT) {
        this.logger.warn(`web-search import: limit reached, skipping`, {
          url: candidate.url,
          count,
          limit: SOURCE_LIMIT,
        });
        results.push({
          url: candidate.url,
          title: candidate.title ?? fallbackTitle,
          status: 'limit_reached',
        });
        continue;
      }

      if (existingUrls.has(candidate.url)) {
        this.logger.log(`web-search import: duplicate, skipping`, {
          url: candidate.url,
        });
        results.push({
          url: candidate.url,
          title: candidate.title ?? fallbackTitle,
          status: 'duplicate',
        });
        continue;
      }

      try {
        const source = await this.sourcesService.createUrl(notebookId, {
          url: candidate.url,
          title: candidate.title,
          minTextLength: MIN_WEB_SEARCH_SOURCE_TEXT_LENGTH,
          provenance: {
            addedVia: 'ai_search',
            metadata: {
              searchQuery: input.query,
              provider: 'firecrawl',
              searchedAt: new Date().toISOString(),
              description,
            },
          },
        });
        existingUrls.add(candidate.url);
        count += 1;
        this.logger.log(`web-search import: added`, {
          url: candidate.url,
          sourceId: source.id,
        });
        results.push({
          url: candidate.url,
          title: source.title,
          status: 'added',
          sourceId: source.id,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to scrape source';
        const storedError =
          err instanceof DomainError && err.messageKey
            ? err.messageKey
            : message;
        this.logger.error(`web-search import: scrape failed`, {
          url: candidate.url,
          error:
            err instanceof Error ? (err.stack ?? err.message) : String(err),
        });
        results.push({
          url: candidate.url,
          title: candidate.title ?? fallbackTitle,
          status: 'scrape_failed',
          error: storedError,
        });
      }
    }

    this.logger.log(`web-search import done`, {
      summary: results.reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
      }, {}),
    });

    return { results };
  }
}
