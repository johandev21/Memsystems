import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CrawlerController } from '../src/modules/crawler/crawler.controller';
import type { FirecrawlCrawlerService } from '../src/modules/crawler/firecrawl-crawler.service';

function creditUsageResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('CrawlerController health (credit-safe)', () => {
  const envBackup = { ...process.env };
  let fetchMock: ReturnType<typeof vi.fn>;
  let scrapeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    delete process.env.CRAWLER_PROVIDER;
    delete process.env.FIRECRAWL_API_URL;
    delete process.env.FIRECRAWL_API_KEY;
    vi.clearAllMocks();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    scrapeMock = vi.fn().mockResolvedValue({
      url: 'https://example.com',
      canonicalUrl: 'https://example.com',
      markdown: '# Example',
    });
  });

  afterEach(() => {
    for (const key of [
      'CRAWLER_PROVIDER',
      'FIRECRAWL_API_URL',
      'FIRECRAWL_API_KEY',
    ] as const) {
      if (envBackup[key] === undefined) delete process.env[key];
      else process.env[key] = envBackup[key];
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function controller(): CrawlerController {
    return new CrawlerController({
      scrape: scrapeMock,
    } as unknown as FirecrawlCrawlerService);
  }

  it('reports key-missing without spending any credit or scraping', async () => {
    const health = await controller().getCrawlerHealth();

    expect(health.apiKeyConfigured).toBe(false);
    expect(health.reachable).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(scrapeMock).not.toHaveBeenCalled();
  });

  it('checks the free credit endpoint instead of scraping by default', async () => {
    process.env.FIRECRAWL_API_KEY = 'fc-test-key';
    fetchMock.mockResolvedValue(
      creditUsageResponse({
        credits_total: 10000,
        credits_used: 2500,
        credits_remaining: 7500,
      }),
    );

    const health = await controller().getCrawlerHealth();

    expect(health.reachable).toBe(true);
    expect(health.authValid).toBe(true);
    expect(health.apiUrlRedacted).toBe('https://api.firecrawl.dev');
    expect(health.credits).toEqual({ total: 10000, used: 2500, remaining: 7500 });
    expect(scrapeMock).not.toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit?];
    expect(url).toBe('https://api.firecrawl.dev/v2/team/credit-usage');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer fc-test-key' });
  });

  it('flags a rejected key without retrying a scrape', async () => {
    process.env.FIRECRAWL_API_KEY = 'fc-bad-key';
    fetchMock.mockResolvedValue(creditUsageResponse({}, 401));

    const health = await controller().getCrawlerHealth();

    expect(health.reachable).toBe(false);
    expect(health.authValid).toBe(false);
    expect(health.message).toContain('FIRECRAWL_API_KEY');
    expect(scrapeMock).not.toHaveBeenCalled();
  });

  it('reads the nested live credit shape too', async () => {
    process.env.FIRECRAWL_API_KEY = 'fc-test-key';
    fetchMock.mockResolvedValue(
      creditUsageResponse({
        success: true,
        data: {
          remainingCredits: 499,
          planCredits: 500,
          billingPeriodStart: '2026-09-01',
          billingPeriodEnd: '2026-10-01',
        },
      }),
    );

    const health = await controller().getCrawlerHealth();

    expect(health.reachable).toBe(true);
    expect(health.credits).toEqual({ total: 500, used: 1, remaining: 499 });
    expect(scrapeMock).not.toHaveBeenCalled();
  });

  it('clamps computed usage at zero when remaining exceeds plan total', async () => {
    process.env.FIRECRAWL_API_KEY = 'fc-test-key';
    fetchMock.mockResolvedValue(
      creditUsageResponse({
        success: true,
        data: { remainingCredits: 1393, planCredits: 1000 },
      }),
    );

    const health = await controller().getCrawlerHealth();

    expect(health.credits).toEqual({
      total: 1000,
      used: 0,
      remaining: 1393,
    });
  });

  it('only scrapes when explicitly asked with ?probe=true', async () => {
    process.env.FIRECRAWL_API_KEY = 'fc-test-key';
    fetchMock.mockResolvedValue(
      creditUsageResponse({
        credits_total: 100,
        credits_used: 1,
        credits_remaining: 99,
      }),
    );

    const health = await controller().getCrawlerHealth('true');

    expect(health.reachable).toBe(true);
    expect(scrapeMock).toHaveBeenCalledOnce();
    expect(health.probe?.ok).toBe(true);
  });
});
