import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { sources } from '../src/database/schema';
import { NotebooksService } from '../src/modules/notebooks/notebooks.service';
import { StorageService } from '../src/modules/storage/storage.service';
import { SourceAcquisitionService } from '../src/modules/sources/source-acquisition.service';
import { SourceExtractionService } from '../src/modules/sources/source-extraction.service';
import { SourcesService } from '../src/modules/sources/sources.service';
import { WebSearchService } from '../src/modules/sources/web-search.service';
import { seedNotebook, seedSource } from './fixtures';
import { db } from './db';

function createSourcesService() {
  const mockConfigService = {
    get: (key: string) => {
      if (key === 'DEV_STORAGE_TOKEN_SECRET') return 'dev-storage-secret-test';
      return undefined;
    },
  } as any;
  const notebooksService = new NotebooksService(
    db as any,
    new StorageService(mockConfigService),
  );
  const sourceJobsService = {
    enqueue: vi.fn().mockResolvedValue(undefined),
    cancelForSource: vi.fn().mockResolvedValue(undefined),
    latestForSource: vi.fn().mockResolvedValue(null),
  } as any;
  const acquisitionService = {
    acquireUrl: vi.fn().mockResolvedValue({
      title: 'Scraped Title',
      text: LONG_SOURCE_TEXT,
      contentHash: 'hash',
      extractionMethod: 'readability',
      status: 200,
      httpContentType: 'text/html',
      robotsDecision: 'skipped',
      sections: [],
    }),
  } as any;
  const sourcesService = new SourcesService(
    db as any,
    notebooksService,
    new StorageService(mockConfigService),
    acquisitionService,
    sourceJobsService,
    new SourceExtractionService(),
  );
  return { db, sourcesService, notebooksService, acquisitionService };
}

const LONG_SOURCE_TEXT = Array.from(
  { length: 40 },
  (_, i) =>
    `Paragraph ${i}: This is a sufficiently long scraped source body used to satisfy the minimum content threshold for web-search imports. It contains multiple sentences of real substance so the page counts as a usable study source.`,
).join('\n\n');

function createWebSearchService(
  sourcesService: SourcesService,
  notebooksService: NotebooksService,
) {
  const aiService = {
    searchWeb: vi.fn().mockResolvedValue({
      query: 'philosophy',
      summary: 'A summary of philosophy sources.',
      sources: [
        {
          title: 'Philosophy Basics',
          url: 'https://philosophybasics.com',
          description: 'Intro',
        },
        {
          title: 'Stanford Encyclopedia',
          url: 'https://plato.stanford.edu',
          description: 'Deep dive',
        },
      ],
    }),
  } as any;
  const service = new WebSearchService(
    notebooksService,
    sourcesService,
    aiService,
  );
  return { service, aiService };
}

describe('WebSearchService', () => {
  it('search returns candidates minus already-added URLs', async () => {
    const { sourcesService, notebooksService } = createSourcesService();
    const notebook = await seedNotebook();
    await seedSource(notebook.id, {
      kind: 'url',
      title: 'Philosophy Basics',
      rawText: 'existing',
      url: 'https://philosophybasics.com',
    });

    const { service, aiService } = createWebSearchService(
      sourcesService,
      notebooksService,
    );
    const result = await service.search(notebook.id, {
      query: 'philosophy',
      modelId: 'openai/gpt-5.6-sol',
    });

    expect(aiService.searchWeb).toHaveBeenCalledWith(
      'philosophy',
      'openai/gpt-5.6-sol',
    );
    expect(result.summary).toBe('A summary of philosophy sources.');
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].url).toBe('https://plato.stanford.edu');
  });

  it('import scrapes and persists each candidate as an ai_search source', async () => {
    const { sourcesService, notebooksService, acquisitionService } =
      createSourcesService();
    const notebook = await seedNotebook();

    const { service } = createWebSearchService(
      sourcesService,
      notebooksService,
    );
    const result = await service.import(notebook.id, {
      candidates: [
        { url: 'https://example.com/one', title: 'One', description: 'First' },
        { url: 'https://example.com/two', description: 'Second' },
      ],
      modelId: 'openai/gpt-5.6-sol',
      query: 'philosophy',
    });

    expect(acquisitionService.acquireUrl).toHaveBeenCalledTimes(2);
    expect(result.results).toHaveLength(2);
    expect(result.results.every((r) => r.status === 'added')).toBe(true);

    const sources = await sourcesService.list(notebook.id);
    expect(sources).toHaveLength(2);
    const rows = await sourcesService.listUrlsForNotebook(notebook.id);
    expect(rows).toEqual(
      expect.arrayContaining([
        'https://example.com/one',
        'https://example.com/two',
      ]),
    );
  });

  it('import marks duplicate URLs and skips re-scraping', async () => {
    const { sourcesService, notebooksService, acquisitionService } =
      createSourcesService();
    const notebook = await seedNotebook();
    await seedSource(notebook.id, {
      kind: 'url',
      title: 'Existing',
      rawText: 'existing',
      url: 'https://example.com/one',
    });

    const { service } = createWebSearchService(
      sourcesService,
      notebooksService,
    );
    const result = await service.import(notebook.id, {
      candidates: [
        { url: 'https://example.com/one', title: 'One' },
        { url: 'https://example.com/two' },
      ],
      modelId: 'openai/gpt-5.6-sol',
      query: 'philosophy',
    });

    expect(acquisitionService.acquireUrl).toHaveBeenCalledTimes(1);
    const byUrl = new Map(result.results.map((r) => [r.url, r.status]));
    expect(byUrl.get('https://example.com/one')).toBe('duplicate');
    expect(byUrl.get('https://example.com/two')).toBe('added');
  });

  it('import reports scrape_failed per candidate when scraping throws', async () => {
    const { sourcesService, notebooksService, acquisitionService } =
      createSourcesService();
    acquisitionService.acquireUrl
      .mockResolvedValueOnce({
        title: 'Good',
        text: LONG_SOURCE_TEXT,
        contentHash: 'hash',
        extractionMethod: 'readability',
        status: 200,
        httpContentType: 'text/html',
        robotsDecision: 'skipped',
        sections: [],
      })
      .mockRejectedValueOnce(new Error('fetch_failed'));
    const notebook = await seedNotebook();

    const { service } = createWebSearchService(
      sourcesService,
      notebooksService,
    );
    const result = await service.import(notebook.id, {
      candidates: [
        { url: 'https://example.com/good' },
        { url: 'https://example.com/bad' },
      ],
      modelId: 'openai/gpt-5.6-sol',
      query: 'philosophy',
    });

    const byUrl = new Map(result.results.map((r) => [r.url, r.status]));
    expect(byUrl.get('https://example.com/good')).toBe('added');
    expect(byUrl.get('https://example.com/bad')).toBe('scrape_failed');
  });

  it('import records provenance (addedVia + metadata) on created sources', async () => {
    const { db, sourcesService, notebooksService } = createSourcesService();
    const notebook = await seedNotebook();

    const { service } = createWebSearchService(
      sourcesService,
      notebooksService,
    );
    await service.import(notebook.id, {
      candidates: [{ url: 'https://example.com/provenance' }],
      modelId: 'openai/gpt-5.6-sol',
      query: 'philosophy',
    });

    const [row] = await db
      .select()
      .from(sources)
      .where(eq(sources.url, 'https://example.com/provenance'));
    expect(row.addedVia).toBe('ai_search');
    expect(row.metadata?.searchQuery).toBe('philosophy');
    expect(row.metadata?.modelId).toBe('openai/gpt-5.6-sol');
    expect(row.metadata?.searchedAt).toBeDefined();
  });
});
