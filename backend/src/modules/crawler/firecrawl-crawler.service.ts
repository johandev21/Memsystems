import { Injectable, Logger } from '@nestjs/common';
import { Firecrawl } from 'firecrawl';
import { WebScrapeError } from '../sources/source-errors';
import type {
  CrawledDocument,
  CrawlerService,
  SearchResultItem,
} from './crawler.types';

const DEFAULT_FIRECRAWL_API_URL = 'https://api.firecrawl.dev';
const DEFAULT_FIRECRAWL_TIMEOUT_MS = 30_000;

export interface FirecrawlClientConfig {
  apiUrl: string;
  apiKey: string | undefined;
  timeoutMs: number;
}

export function loadFirecrawlConfig(
  env: NodeJS.ProcessEnv = process.env,
): FirecrawlClientConfig {
  return {
    apiUrl: env.FIRECRAWL_API_URL ?? DEFAULT_FIRECRAWL_API_URL,
    apiKey: env.FIRECRAWL_API_KEY || undefined,
    timeoutMs: parseTimeoutMs(env.FIRECRAWL_TIMEOUT_MS),
  };
}

function parseTimeoutMs(value: string | undefined): number {
  if (value === undefined) return DEFAULT_FIRECRAWL_TIMEOUT_MS;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_FIRECRAWL_TIMEOUT_MS;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function errorStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    if (typeof statusCode === 'number') return statusCode;
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number') return status;
  }
  return undefined;
}

function errorNameAndMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);
  return `${name} ${message}`;
}

function isAuthError(error: unknown): boolean {
  const status = errorStatus(error);
  if (status === 401 || status === 403) return true;
  return /authentication|unauthorized|forbidden|invalid api key|do not have access/i.test(
    errorNameAndMessage(error),
  );
}

function isRateLimitError(error: unknown): boolean {
  const status = errorStatus(error);
  if (status === 429) return true;
  return /rate.?limit|too many requests|quota exceeded/i.test(
    errorNameAndMessage(error),
  );
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return true;
    }
    const message = error.message.toLowerCase();
    if (
      message.includes('timed out') ||
      message.includes('timeout') ||
      message.includes('etimedout') ||
      message.includes('aborted')
    ) {
      return true;
    }
  }
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code.toLowerCase().includes('timeout')) {
      return true;
    }
  }
  return false;
}

@Injectable()
export class FirecrawlCrawlerService implements CrawlerService {
  private readonly logger = new Logger(FirecrawlCrawlerService.name);
  private readonly client: Firecrawl;
  private readonly apiUrl: string;
  private readonly timeoutMs: number;

  constructor() {
    // Firecrawl Cloud by default. The key is required for Cloud and is read
    // here for client construction only — it is never written to logs.
    // Point FIRECRAWL_API_URL at a self-hosted instance to use that instead.
    const config = loadFirecrawlConfig();
    this.apiUrl = config.apiUrl;
    this.timeoutMs = config.timeoutMs;
    this.client = new Firecrawl({
      apiKey: config.apiKey,
      apiUrl: this.apiUrl,
      timeoutMs: this.timeoutMs,
    });
  }

  async scrape(url: string): Promise<CrawledDocument> {
    const startedAt = Date.now();
    try {
      const document = await this.client.scrape(url, {
        formats: ['markdown', 'html', 'links'],
        onlyMainContent: true,
        timeout: this.timeoutMs,
      });
      const durationMs = Date.now() - startedAt;
      const metadata: Record<string, unknown> = {
        ...(document.metadata ?? {}),
      };
      const reportedUrl =
        asString(metadata['url']) ?? asString(metadata['sourceURL']);
      this.logger.log(
        `Firecrawl scrape succeeded url="${url}" durationMs=${durationMs}`,
      );
      return {
        url,
        canonicalUrl: reportedUrl ?? url,
        title: asString(metadata['title']),
        markdown: document.markdown ?? '',
        html: document.html,
        links: document.links,
        metadata,
      };
    } catch (error: unknown) {
      throw this.toWebScrapeError(error, url, Date.now() - startedAt);
    }
  }

  /**
   * Model-free web search. Returns basic result metadata (no AI summary);
   * full page content is fetched later through scrape() at import time.
   */
  async search(query: string, limit = 10): Promise<SearchResultItem[]> {
    const startedAt = Date.now();
    try {
      const result = await this.client.search(query, {
        limit,
        timeout: this.timeoutMs,
        ignoreInvalidURLs: true,
      });
      const items = result.web ?? [];
      const mapped = items.flatMap((item): SearchResultItem[] => {
        const record = item as {
          url?: unknown;
          title?: unknown;
          description?: unknown;
        };
        if (typeof record.url !== 'string' || record.url.length === 0) {
          return [];
        }
        // Firecrawl descriptions can exceed our 500-char metadata budget.
        const description =
          typeof record.description === 'string'
            ? record.description.slice(0, 500)
            : null;
        return [
          {
            url: record.url,
            title:
              typeof record.title === 'string' && record.title.length > 0
                ? record.title
                : record.url,
            description,
          },
        ];
      });
      this.logger.log(
        `Firecrawl search succeeded query="${query}" resultCount=${mapped.length} durationMs=${Date.now() - startedAt}`,
      );
      return mapped;
    } catch (error: unknown) {
      throw this.toWebScrapeError(
        error,
        `search query "${query}"`,
        Date.now() - startedAt,
      );
    }
  }

  private toWebScrapeError(
    error: unknown,
    subject: string,
    durationMs: number,
  ): WebScrapeError {
    if (isAuthError(error)) {
      this.logger.warn(
        `Firecrawl rejected the API key subject="${subject}" durationMs=${durationMs}`,
      );
      throw new WebScrapeError(
        `Firecrawl rejected the API key — check FIRECRAWL_API_KEY.`,
        'unauthorized',
      );
    }
    if (isRateLimitError(error)) {
      this.logger.warn(
        `Firecrawl rate limit hit subject="${subject}" durationMs=${durationMs}`,
      );
      throw new WebScrapeError(
        `Firecrawl rate limit hit for ${subject}: slow down and retry later.`,
        'rate_limited',
      );
    }
    if (isTimeoutError(error)) {
      this.logger.warn(
        `Firecrawl request timed out subject="${subject}" durationMs=${durationMs} timeoutMs=${this.timeoutMs}`,
      );
      throw new WebScrapeError(
        `Scrape timed out after ${this.timeoutMs}ms: ${subject}`,
        'timeout',
      );
    }
    const detail = error instanceof Error ? error.message : String(error);
    this.logger.warn(
      `Firecrawl request failed subject="${subject}" durationMs=${durationMs} error="${detail}"`,
    );
    throw new WebScrapeError(
      `Scrape failed for ${subject}: ${detail}`,
      'fetch_failed',
    );
  }
}
