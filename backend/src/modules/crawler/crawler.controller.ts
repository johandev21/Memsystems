import { Controller, Get, Logger, Query } from '@nestjs/common';
import { FirecrawlCrawlerService } from './firecrawl-crawler.service';

const DEFAULT_FIRECRAWL_API_URL = 'https://api.firecrawl.dev';
const HEALTH_PROBE_URL = 'https://example.com';
const HEALTH_CHECK_TIMEOUT_MS = 5_000;

interface CreditUsage {
  total: number;
  used: number;
  remaining: number;
}

export interface CrawlerHealth {
  provider: string;
  apiUrlRedacted: string;
  apiKeyConfigured: boolean;
  reachable: boolean;
  latencyMs: number;
  authValid?: boolean;
  credits?: CreditUsage;
  probe?: { ok: boolean; latencyMs: number };
  message?: string;
}

function redactApiUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return 'invalid-url';
  }
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

@Controller('health')
export class CrawlerController {
  private readonly logger = new Logger(CrawlerController.name);

  constructor(private readonly crawler: FirecrawlCrawlerService) {}

  /**
   * Credit-safe health check. Reads the free credit-usage endpoint, which
   * proves connectivity AND that the API key works without spending a
   * scrape credit. Pass ?probe=true for one real scrape (costs 1 credit)
   * when a human explicitly tests the full read path.
   */
  @Get('crawler')
  async getCrawlerHealth(
    @Query('probe') probe?: string,
  ): Promise<CrawlerHealth> {
    const provider = process.env.CRAWLER_PROVIDER ?? 'firecrawl';
    const apiUrl = process.env.FIRECRAWL_API_URL ?? DEFAULT_FIRECRAWL_API_URL;
    const apiUrlRedacted = redactApiUrl(apiUrl);
    const apiKey = process.env.FIRECRAWL_API_KEY || undefined;
    const startedAt = Date.now();

    if (!apiKey) {
      return {
        provider,
        apiUrlRedacted,
        apiKeyConfigured: false,
        reachable: false,
        latencyMs: 0,
        message: 'Set FIRECRAWL_API_KEY to enable web ingestion.',
      };
    }

    let credits: CreditUsage | undefined;
    try {
      const base = apiUrl.replace(/\/+$/u, '');
      const creditUrl = /\/v\d+$/u.test(base)
        ? `${base}/team/credit-usage`
        : `${base}/v2/team/credit-usage`;
      const response = await fetch(creditUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
      });
      if (response.status === 401 || response.status === 403) {
        return {
          provider,
          apiUrlRedacted,
          apiKeyConfigured: true,
          reachable: false,
          latencyMs: Date.now() - startedAt,
          authValid: false,
          message: 'Firecrawl rejected the API key — check FIRECRAWL_API_KEY.',
        };
      }
      if (!response.ok) {
        return {
          provider,
          apiUrlRedacted,
          apiKeyConfigured: true,
          reachable: false,
          latencyMs: Date.now() - startedAt,
          message: `Firecrawl credit check failed (HTTP ${response.status}).`,
        };
      }
      const body = (await response.json()) as Record<string, unknown>;
      // Documented shape: { credits_total, credits_used, credits_remaining }.
      // Live shape (v2): { success, data: { planCredits, remainingCredits } }.
      const data =
        body['data'] && typeof body['data'] === 'object'
          ? (body['data'] as Record<string, unknown>)
          : body;
      const total =
        asNumber(body['credits_total']) ?? asNumber(data['planCredits']);
      const remaining =
        asNumber(body['credits_remaining']) ??
        asNumber(data['remainingCredits']);
      const used =
        asNumber(body['credits_used']) ??
        (total !== undefined && remaining !== undefined
          ? Math.max(0, total - remaining)
          : undefined);
      if (
        total !== undefined &&
        used !== undefined &&
        remaining !== undefined
      ) {
        credits = { total, used, remaining };
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Firecrawl credit check failed: ${detail}`);
      return {
        provider,
        apiUrlRedacted,
        apiKeyConfigured: true,
        reachable: false,
        latencyMs: Date.now() - startedAt,
        message: 'Firecrawl API is unreachable.',
      };
    }

    const health: CrawlerHealth = {
      provider,
      apiUrlRedacted,
      apiKeyConfigured: true,
      reachable: true,
      latencyMs: Date.now() - startedAt,
      authValid: true,
      credits,
    };

    if (probe === 'true') {
      const probeStartedAt = Date.now();
      try {
        await this.crawler.scrape(HEALTH_PROBE_URL);
        health.probe = { ok: true, latencyMs: Date.now() - probeStartedAt };
      } catch {
        health.probe = { ok: false, latencyMs: Date.now() - probeStartedAt };
      }
    }

    return health;
  }
}
