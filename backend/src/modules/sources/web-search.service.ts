import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { NotebooksService } from '../notebooks/notebooks.service';
import { SOURCE_LIMIT, SourcesService } from './sources.service';

const MIN_WEB_SEARCH_SOURCE_TEXT_LENGTH = 1000;

export interface WebSearchCandidate {
  title: string;
  url: string;
  description: string | null;
}

export interface WebSearchSearchInput {
  query: string;
  modelId: string;
}

export interface WebSearchSearchResponse {
  query: string;
  modelId: string;
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
  modelId: string;
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
    private readonly aiService: AiService,
  ) {}

  async search(
    notebookId: string,
    input: WebSearchSearchInput,
  ): Promise<WebSearchSearchResponse> {
    this.logger.log(`web-search search start`, {
      notebookId,
      query: input.query,
      modelId: input.modelId,
    });

    await this.notebooksService.assertNotebookOwner(notebookId);

    const result = await this.aiService.searchWeb(input.query, input.modelId);

    const existingUrls =
      await this.sourcesService.listUrlsForNotebook(notebookId);
    const existing = new Set(existingUrls);
    const sources = result.sources.filter((s) => !existing.has(s.url));

    this.logger.log(`web-search search done`, {
      foundCount: result.sources.length,
      deduplicatedCount: sources.length,
      existingCount: existing.size,
    });

    return {
      query: input.query,
      modelId: input.modelId,
      summary: result.summary,
      sources,
    };
  }

  async import(
    notebookId: string,
    input: WebSearchImportInput,
  ): Promise<WebSearchImportResponse> {
    this.logger.log(`web-search import start`, {
      notebookId,
      modelId: input.modelId,
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
              modelId: input.modelId,
              searchedAt: new Date().toISOString(),
              description: candidate.description ?? null,
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
        this.logger.error(`web-search import: scrape failed`, {
          url: candidate.url,
          error:
            err instanceof Error ? (err.stack ?? err.message) : String(err),
        });
        results.push({
          url: candidate.url,
          title: candidate.title ?? fallbackTitle,
          status: 'scrape_failed',
          error: message,
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
