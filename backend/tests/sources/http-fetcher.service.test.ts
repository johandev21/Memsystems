import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SOURCE_FETCH_CONFIG,
  SourcePolicyService,
} from '../../src/modules/sources/source-policy.service';
import { HttpFetcherService } from '../../src/modules/sources/acquisition/http-fetcher.service';

const HTML_BODY =
  '<html><head><title>T</title></head><body><p>Hello world, this is an article.</p></body></html>';

function bodyFrom(text: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  return {
    getReader() {
      let done = false;
      return {
        read() {
          if (done) return { done: true, value: undefined };
          done = true;
          return { done: false, value: data };
        },
        cancel: async () => {},
      };
    },
  };
}

function htmlResponse(
  options: {
    status?: number;
    url?: string;
    body?: string;
    headers?: Record<string, string>;
  } = {},
) {
  const status = options.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    url: options.url ?? 'https://example.com/page',
    headers: new Headers({
      'content-type': 'text/html; charset=utf-8',
      ...options.headers,
    }),
    body: bodyFrom(options.body ?? HTML_BODY),
  };
}

function redirectResponse(location: string) {
  return {
    ok: false,
    status: 302,
    url: '',
    headers: new Headers({ location }),
    body: null,
  };
}

function createFetcher(
  overrides: Partial<typeof DEFAULT_SOURCE_FETCH_CONFIG> = {},
) {
  const config = { ...DEFAULT_SOURCE_FETCH_CONFIG, ...overrides };
  return new HttpFetcherService(new SourcePolicyService(config), config);
}

describe('HttpFetcherService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches an HTML page and reports fetch provenance', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      htmlResponse({
        headers: {
          etag: '"abc"',
          'last-modified': 'Tue, 01 Jan 2025 00:00:00 GMT',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await createFetcher().fetchHtml('https://example.com/page');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/page',
      expect.objectContaining({ redirect: 'manual' }),
    );
    expect(result.status).toBe(200);
    expect(result.body).toBe(HTML_BODY);
    expect(result.etag).toBe('"abc"');
    expect(result.lastModified).toContain('2025');
    expect(result.robotsDecision).toBe('skipped');
    expect(result.redirects).toEqual([]);
    expect(result.canonicalUrl).toBe('https://example.com/page');
  });

  it('follows redirects and revalidates each hop', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirectResponse('https://example.com/final?x=1'))
      .mockResolvedValueOnce(
        htmlResponse({ url: 'https://example.com/final?x=1' }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await createFetcher().fetchHtml('https://example.com/start');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.url).toBe('https://example.com/final?x=1');
    expect(result.redirects).toEqual(['https://example.com/start']);
  });

  it('blocks redirects to private addresses (SSRF bypass attempt)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirectResponse('http://127.0.0.1/admin'))
      .mockResolvedValueOnce(htmlResponse());
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createFetcher().fetchHtml('https://example.com/start'),
    ).rejects.toThrow('private or restricted');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('stops after the redirect limit', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(redirectResponse('https://example.com/next'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createFetcher({ maxRedirects: 2 }).fetchHtml('https://example.com/start'),
    ).rejects.toThrow('Too many redirects');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('fails on redirects without a Location header', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 301,
        url: '',
        headers: new Headers(),
        body: null,
      }),
    );
    await expect(
      createFetcher().fetchHtml('https://example.com/start'),
    ).rejects.toThrow('without a Location header');
  });

  it('rejects non-HTML content types', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        htmlResponse({
          headers: { 'content-type': 'application/json' },
          body: '{}',
        }),
      ),
    );
    await expect(
      createFetcher().fetchHtml('https://example.com/api'),
    ).rejects.toThrow('Unsupported content-type');
  });

  it('rejects responses that exceed the byte limit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(htmlResponse({ body: 'x'.repeat(2000) })),
    );
    await expect(
      createFetcher({ maxBytes: 1000 }).fetchHtml('https://example.com/page'),
    ).rejects.toThrow('exceeded 1000 bytes');
  });

  it('times out when the request hangs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(
                new DOMException('The operation was aborted', 'AbortError'),
              ),
            );
          }),
      ),
    );
    await expect(
      createFetcher({ timeoutMs: 100 }).fetchHtml('https://example.com/slow'),
    ).rejects.toThrow('timed out after 100ms');
  });

  it('reports non-OK responses with a stable code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(htmlResponse({ status: 404 })),
    );
    await expect(
      createFetcher().fetchHtml('https://example.com/missing'),
    ).rejects.toMatchObject({ code: 'fetch_failed' });
  });

  it('records robots decisions when robots policy is respected', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/robots.txt')) {
        return Promise.resolve(
          htmlResponse({
            url: 'https://example.com/robots.txt',
            headers: { 'content-type': 'text/plain' },
            body: 'User-agent: *\nDisallow: /private/',
          }),
        );
      }
      return Promise.resolve(htmlResponse());
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await createFetcher({ robots: 'respect' }).fetchHtml(
      'https://example.com/public',
    );
    expect(result.robotsDecision).toBe('allowed');
  });

  it('denies fetches blocked by robots.txt', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.endsWith('/robots.txt')) {
          return Promise.resolve(
            htmlResponse({
              url: 'https://example.com/robots.txt',
              headers: { 'content-type': 'text/plain' },
              body: 'User-agent: *\nDisallow: /private/',
            }),
          );
        }
        return Promise.resolve(htmlResponse());
      }),
    );
    await expect(
      createFetcher({ robots: 'respect' }).fetchHtml(
        'https://example.com/private/x',
      ),
    ).rejects.toMatchObject({ code: 'robots_denied' });
  });

  it('treats unavailable robots.txt as allowed', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        htmlResponse({
          url: 'https://example.com/robots.txt',
          status: 404,
          body: '',
        }),
      )
      .mockResolvedValueOnce(htmlResponse());
    vi.stubGlobal('fetch', fetchMock);

    const result = await createFetcher({ robots: 'respect' }).fetchHtml(
      'https://example.com/page',
    );
    expect(result.robotsDecision).toBe('unavailable');
    expect(result.body).toBe(HTML_BODY);
  });
});
