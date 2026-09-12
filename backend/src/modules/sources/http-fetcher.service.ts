import { Inject, Injectable, Optional } from '@nestjs/common';
import { WebScrapeError } from './source-errors';
import {
  loadSourceFetchConfig,
  SOURCE_FETCH_CONFIG,
  SourcePolicyService,
} from './source-policy.service';
import type { SourceFetchConfig } from './source-policy.service';

export interface FetchedHtml {
  /** Requested URL (original input). */
  requestedUrl: string;
  /** Final URL after redirects. */
  url: string;
  /** Canonical identity of the final URL. */
  canonicalUrl: string;
  status: number;
  contentType: string;
  body: string;
  etag?: string;
  lastModified?: string;
  /** Robots decision for the final hop. */
  robotsDecision: string;
  /** Redirect hop URLs, in order (excludes the final URL). */
  redirects: string[];
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function isHtmlContentType(contentType: string): boolean {
  const ct = contentType.split(';')[0].trim().toLowerCase();
  return ct === 'text/html' || ct === 'application/xhtml+xml';
}

@Injectable()
export class HttpFetcherService {
  private readonly config: SourceFetchConfig;

  constructor(
    private readonly policy: SourcePolicyService,
    @Optional() @Inject(SOURCE_FETCH_CONFIG) config?: SourceFetchConfig,
  ) {
    this.config = config ?? loadSourceFetchConfig();
  }

  async fetchHtml(input: string): Promise<FetchedHtml> {
    const redirects: string[] = [];
    let currentUrl = input;

    for (let hop = 0; ; hop++) {
      const validated = await this.policy.validateUrl(currentUrl);
      const robotsDecision = await this.policy.checkRobots(validated.url);
      if (robotsDecision === 'denied') {
        throw new WebScrapeError(
          `Fetch denied by robots.txt policy: ${validated.normalizedUrl}`,
          'robots_denied',
          {
            messageKey: 'errors.sources.web.robotsDenied',
            params: { url: validated.normalizedUrl },
          },
        );
      }

      const response = await this.request(validated.url.toString());

      if (REDIRECT_STATUSES.has(response.status)) {
        const location = response.headers.get('location');
        if (!location) {
          throw new WebScrapeError(
            `Redirect (HTTP ${response.status}) without a Location header`,
            'fetch_failed',
            {
              messageKey: 'errors.sources.web.redirectNoLocation',
              params: { status: response.status },
            },
          );
        }
        if (hop >= this.config.maxRedirects) {
          throw new WebScrapeError(
            `Too many redirects (limit ${this.config.maxRedirects})`,
            'redirect_limit',
            {
              messageKey: 'errors.sources.web.tooManyRedirects',
              params: { limit: this.config.maxRedirects },
            },
          );
        }
        redirects.push(validated.normalizedUrl);
        currentUrl = new URL(location, validated.url).toString();
        continue;
      }

      if (!response.ok) {
        throw new WebScrapeError(
          `Fetch failed: HTTP ${response.status}`,
          'fetch_failed',
          {
            messageKey: 'errors.sources.web.fetchFailed',
            params: { status: response.status },
          },
        );
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!isHtmlContentType(contentType)) {
        throw new WebScrapeError(
          `Unsupported content-type: ${contentType || 'unknown'}`,
          'invalid_content_type',
          {
            messageKey: 'errors.sources.web.contentTypeUnsupported',
            params: { contentType: contentType || 'unknown' },
          },
        );
      }

      const body = await readBoundedBody(response, this.config.maxBytes);

      return {
        requestedUrl: input,
        url: response.url || validated.url.toString(),
        canonicalUrl: this.policy.normalizeUrl(
          response.url || validated.url.toString(),
        ),
        status: response.status,
        contentType,
        body,
        etag: response.headers.get('etag') ?? undefined,
        lastModified: response.headers.get('last-modified') ?? undefined,
        robotsDecision,
        redirects,
      };
    }
  }

  private async request(url: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      return await fetch(url, {
        headers: {
          'User-Agent': this.config.userAgent,
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: controller.signal,
        redirect: 'manual',
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new WebScrapeError(
          `Request timed out after ${this.config.timeoutMs}ms`,
          'timeout',
          {
            messageKey: 'errors.sources.web.timeout',
            params: { ms: this.config.timeoutMs },
          },
        );
      }
      throw new WebScrapeError(
        `Fetch failed: ${err instanceof Error ? err.message : String(err)}`,
        'fetch_failed',
        {
          messageKey: 'errors.sources.web.fetchFailedReason',
          params: {
            reason: err instanceof Error ? err.message : String(err),
          },
        },
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

async function readBoundedBody(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new WebScrapeError(
          `Response exceeded ${maxBytes} bytes`,
          'response_too_large',
          {
            messageKey: 'errors.sources.web.responseTooLarge',
            params: { maxBytes },
          },
        );
      }
      chunks.push(value);
    }
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8').decode(merged);
}
