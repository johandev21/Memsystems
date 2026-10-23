export interface FirecrawlDocumentInput {
  title?: string;
  markdown?: string;
  metadata?: Record<string, unknown>;
  html?: string;
  links?: string[];
}

export interface FirecrawlMetaInput {
  sourceUrl: string;
  canonicalUrl?: string;
  fetchedUrl?: string;
  contentType?: string;
}

export interface CrawledDocument {
  url: string;
  canonicalUrl: string;
  title?: string;
  markdown: string;
  html?: string;
  links?: string[];
  metadata?: Record<string, unknown>;
}

export interface CrawlerScrapeOptions {
  onlyMainContent?: boolean;
}

export interface ParseFileInput {
  buffer: Buffer;
  filename: string;
  contentType?: string;
}

export interface ParsedFileDocument {
  markdown: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface CrawlerService {
  scrape(url: string, options?: CrawlerScrapeOptions): Promise<CrawledDocument>;
  parseFile(input: ParseFileInput): Promise<ParsedFileDocument>;
  search(query: string, limit?: number): Promise<SearchResultItem[]>;
}

export interface SearchResultItem {
  url: string;
  title: string;
  description: string | null;
}

export const CRAWLER_SERVICE = 'CRAWLER_SERVICE';
