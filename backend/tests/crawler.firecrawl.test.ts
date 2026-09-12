import { Logger } from '@nestjs/common';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import { Firecrawl } from 'firecrawl';
import {
  FirecrawlCrawlerService,
  loadFirecrawlConfig,
} from '../src/modules/crawler/firecrawl-crawler.service';
import { WebScrapeError } from '../src/modules/sources/source-errors';

type ScrapeResult = Awaited<ReturnType<Firecrawl['scrape']>>;

function scrapeSuccess(overrides: Partial<ScrapeResult> = {}): ScrapeResult {
  return {
    markdown: '# Hi\nBody',
    metadata: { title: 'T', language: 'en' },
    ...overrides,
  };
}

describe('FirecrawlCrawlerService', () => {
  const envBackup = { ...process.env };
  let logSpy: MockInstance;
  let warnSpy: MockInstance;

  beforeEach(() => {
    delete process.env.FIRECRAWL_API_URL;
    delete process.env.FIRECRAWL_API_KEY;
    delete process.env.FIRECRAWL_TIMEOUT_MS;
    logSpy = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    warnSpy = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.FIRECRAWL_API_URL = envBackup.FIRECRAWL_API_URL;
    process.env.FIRECRAWL_API_KEY = envBackup.FIRECRAWL_API_KEY;
    process.env.FIRECRAWL_TIMEOUT_MS = envBackup.FIRECRAWL_TIMEOUT_MS;
    // Remove keys that were originally absent to avoid leaking between tests.
    if (envBackup.FIRECRAWL_API_URL === undefined)
      delete process.env.FIRECRAWL_API_URL;
    if (envBackup.FIRECRAWL_API_KEY === undefined)
      delete process.env.FIRECRAWL_API_KEY;
    if (envBackup.FIRECRAWL_TIMEOUT_MS === undefined)
      delete process.env.FIRECRAWL_TIMEOUT_MS;
    vi.restoreAllMocks();
  });

  it('maps SDK markdown/metadata to a CrawledDocument', async () => {
    const scrapeMock = vi
      .spyOn(Firecrawl.prototype, 'scrape')
      .mockResolvedValue(scrapeSuccess());
    const service = new FirecrawlCrawlerService();

    const result = await service.scrape('https://example.com/article');

    expect(scrapeMock).toHaveBeenCalledOnce();
    expect(scrapeMock.mock.calls[0][0]).toBe('https://example.com/article');
    expect(result.url).toBe('https://example.com/article');
    // No url/sourceURL in mocked metadata, so canonical falls back to input.
    expect(result.canonicalUrl).toBe('https://example.com/article');
    expect(result.title).toBe('T');
    expect(result.markdown).toBe('# Hi\nBody');
    expect(result.metadata).toMatchObject({ title: 'T', language: 'en' });
  });

  it('prefers metadata url/sourceURL for canonicalUrl', async () => {
    vi.spyOn(Firecrawl.prototype, 'scrape').mockResolvedValue(
      scrapeSuccess({
        metadata: {
          title: 'T',
          url: 'https://example.com/canonical',
          sourceURL: 'https://example.com/source',
        },
      }),
    );
    const service = new FirecrawlCrawlerService();

    const result = await service.scrape('https://example.com/article');

    expect(result.canonicalUrl).toBe('https://example.com/canonical');
  });

  it('falls back to sourceURL when url is absent', async () => {
    vi.spyOn(Firecrawl.prototype, 'scrape').mockResolvedValue(
      scrapeSuccess({
        metadata: { title: 'T', sourceURL: 'https://example.com/source' },
      }),
    );
    const service = new FirecrawlCrawlerService();

    const result = await service.scrape('https://example.com/article');

    expect(result.canonicalUrl).toBe('https://example.com/source');
  });

  it('defaults missing markdown to an empty string', async () => {
    vi.spyOn(Firecrawl.prototype, 'scrape').mockResolvedValue(
      scrapeSuccess({ markdown: undefined, metadata: { title: 'T' } }),
    );
    const service = new FirecrawlCrawlerService();

    const result = await service.scrape('https://example.com/article');

    expect(result.markdown).toBe('');
  });

  it('uses the default timeout when FIRECRAWL_TIMEOUT_MS is unset', async () => {
    const scrapeMock = vi
      .spyOn(Firecrawl.prototype, 'scrape')
      .mockResolvedValue(scrapeSuccess());
    const service = new FirecrawlCrawlerService();

    await service.scrape('https://example.com/article');

    expect(scrapeMock.mock.calls[0][1]).toMatchObject({ timeout: 30_000 });
  });

  it('parses a custom FIRECRAWL_TIMEOUT_MS', async () => {
    process.env.FIRECRAWL_TIMEOUT_MS = '5000';
    const scrapeMock = vi
      .spyOn(Firecrawl.prototype, 'scrape')
      .mockResolvedValue(scrapeSuccess());
    const service = new FirecrawlCrawlerService();

    await service.scrape('https://example.com/article');

    expect(scrapeMock.mock.calls[0][1]).toMatchObject({ timeout: 5000 });
  });

  it.each([['not-a-number'], ['0'], ['-100'], ['']])(
    'falls back to the default timeout for invalid value %j',
    async (value) => {
      process.env.FIRECRAWL_TIMEOUT_MS = value;
      const scrapeMock = vi
        .spyOn(Firecrawl.prototype, 'scrape')
        .mockResolvedValue(scrapeSuccess());
      const service = new FirecrawlCrawlerService();

      await service.scrape('https://example.com/article');

      expect(scrapeMock.mock.calls[0][1]).toMatchObject({ timeout: 30_000 });
    },
  );

  it('maps timeout failures to WebScrapeError with code timeout', async () => {
    vi.spyOn(Firecrawl.prototype, 'scrape').mockRejectedValue(
      new Error('Request timed out after 30000ms'),
    );
    const service = new FirecrawlCrawlerService();

    const promise = service.scrape('https://example.com/slow');

    await expect(promise).rejects.toMatchObject({ code: 'timeout' });
    await expect(promise).rejects.toThrow(WebScrapeError);
    await expect(promise).rejects.toThrow('https://example.com/slow');
  });

  it('maps AbortError names to timeout', async () => {
    const aborted = new Error('The operation was aborted');
    aborted.name = 'AbortError';
    vi.spyOn(Firecrawl.prototype, 'scrape').mockRejectedValue(aborted);
    const service = new FirecrawlCrawlerService();

    await expect(
      service.scrape('https://example.com/slow'),
    ).rejects.toMatchObject({ code: 'timeout' });
  });

  it('maps generic failures to WebScrapeError with code fetch_failed', async () => {
    vi.spyOn(Firecrawl.prototype, 'scrape').mockRejectedValue(
      new Error('500 Internal Server Error'),
    );
    const service = new FirecrawlCrawlerService();

    const promise = service.scrape('https://example.com/article');

    await expect(promise).rejects.toMatchObject({ code: 'fetch_failed' });
    await expect(promise).rejects.toThrow(WebScrapeError);
    await expect(promise).rejects.toThrow('500 Internal Server Error');
  });

  it('defaults to Firecrawl Cloud when FIRECRAWL_API_URL is unset', async () => {
    expect(loadFirecrawlConfig().apiUrl).toBe('https://api.firecrawl.dev');
  });

  it('honours a FIRECRAWL_API_URL override (e.g. self-hosted)', async () => {
    process.env.FIRECRAWL_API_URL = 'http://localhost:3002';
    expect(loadFirecrawlConfig().apiUrl).toBe('http://localhost:3002');
  });

  it('maps authentication failures to WebScrapeError with code unauthorized', async () => {
    const authError = Object.assign(new Error('Invalid API key'), {
      name: 'AuthenticationError',
      statusCode: 401,
    });
    vi.spyOn(Firecrawl.prototype, 'scrape').mockRejectedValue(authError);
    const service = new FirecrawlCrawlerService();

    const promise = service.scrape('https://example.com/article');

    await expect(promise).rejects.toMatchObject({ code: 'unauthorized' });
    await expect(promise).rejects.toThrow(WebScrapeError);
    await expect(promise).rejects.toThrow('FIRECRAWL_API_KEY');
  });

  it('maps rate limiting to WebScrapeError with code rate_limited', async () => {
    const rateError = Object.assign(new Error('Too many requests'), {
      name: 'RateLimitError',
      statusCode: 429,
    });
    vi.spyOn(Firecrawl.prototype, 'scrape').mockRejectedValue(rateError);
    const service = new FirecrawlCrawlerService();

    const promise = service.scrape('https://example.com/article');

    await expect(promise).rejects.toMatchObject({ code: 'rate_limited' });
    await expect(promise).rejects.toThrow(WebScrapeError);
  });

  it('search maps web results to candidates with null description fallback', async () => {
    const searchMock = vi
      .spyOn(Firecrawl.prototype, 'search')
      .mockResolvedValue({
        web: [
          {
            url: 'https://example.com/a',
            title: 'A',
            description: 'About A',
          },
          { url: 'https://example.com/b' },
        ],
      } as never);
    const service = new FirecrawlCrawlerService();

    const result = await service.search('test query', 10);

    expect(searchMock).toHaveBeenCalledOnce();
    expect(searchMock.mock.calls[0][0]).toBe('test query');
    expect(searchMock.mock.calls[0][1]).toMatchObject({ limit: 10 });
    expect(result).toEqual([
      { url: 'https://example.com/a', title: 'A', description: 'About A' },
      {
        url: 'https://example.com/b',
        title: 'https://example.com/b',
        description: null,
      },
    ]);
  });

  it('truncates overlong descriptions to the 500-char metadata budget', async () => {
    vi.spyOn(Firecrawl.prototype, 'search').mockResolvedValue({
      web: [
        {
          url: 'https://example.com/long',
          title: 'Long',
          description: 'x'.repeat(600),
        },
      ],
    } as never);
    const service = new FirecrawlCrawlerService();

    const result = await service.search('test query');

    expect(result).toEqual([
      {
        url: 'https://example.com/long',
        title: 'Long',
        description: 'x'.repeat(500),
      },
    ]);
  });

  it('search skips results without a usable url', async () => {
    vi.spyOn(Firecrawl.prototype, 'search').mockResolvedValue({
      web: [{ title: 'No url here' }, { url: '', title: 'Empty' }],
    } as never);
    const service = new FirecrawlCrawlerService();

    await expect(service.search('test query')).resolves.toEqual([]);
  });

  it('search maps auth and rate-limit failures like scrape does', async () => {
    const service = new FirecrawlCrawlerService();

    vi.spyOn(Firecrawl.prototype, 'search').mockRejectedValue(
      Object.assign(new Error('Unauthorized'), { statusCode: 401 }),
    );
    await expect(service.search('q')).rejects.toMatchObject({
      code: 'unauthorized',
    });

    vi.spyOn(Firecrawl.prototype, 'search').mockRejectedValue(
      Object.assign(new Error('Too many requests'), { statusCode: 429 }),
    );
    await expect(service.search('q')).rejects.toMatchObject({
      code: 'rate_limited',
    });
  });

  it('never logs the apiKey on success or failure', async () => {
    const secret = 'firecrawl-secret-never-log-me-12345';
    process.env.FIRECRAWL_API_KEY = secret;
    const scrapeMock = vi
      .spyOn(Firecrawl.prototype, 'scrape')
      .mockResolvedValue(scrapeSuccess());
    const service = new FirecrawlCrawlerService();

    await service.scrape('https://example.com/article');

    scrapeMock.mockRejectedValueOnce(new Error('boom'));
    await expect(service.scrape('https://example.com/fails')).rejects.toThrow(
      WebScrapeError,
    );

    const logged = [
      ...(logSpy.mock.calls.flat() as unknown[]),
      ...(warnSpy.mock.calls.flat() as unknown[]),
    ].map((arg) => String(arg));
    expect(logged.length).toBeGreaterThan(0);
    for (const entry of logged) {
      expect(entry).not.toContain(secret);
    }
  });
});
