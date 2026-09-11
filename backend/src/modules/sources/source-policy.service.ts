import { Inject, Injectable, Optional } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { isIPv4, isIPv6 } from 'node:net';
import { WebScrapeError } from './source-errors';

export type RobotsMode = 'off' | 'respect';
export type RobotsDecisionValue =
  'allowed' | 'denied' | 'unavailable' | 'skipped';

export const SOURCE_FETCH_CONFIG = 'SOURCE_FETCH_CONFIG';

export interface HostnameResolver {
  /** Resolves every address of a hostname; throws when unresolvable. */
  lookupAll(hostname: string): Promise<string[]>;
}

const defaultResolver: HostnameResolver = {
  async lookupAll(hostname: string): Promise<string[]> {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    return addresses.map((a) => a.address);
  },
};

export interface SourceFetchConfig {
  /** Per-request timeout in milliseconds. */
  timeoutMs: number;
  /** Maximum response bytes read from the body. */
  maxBytes: number;
  /** Maximum redirect hops per request. */
  maxRedirects: number;
  /** Maximum accepted URL length. */
  maxUrlLength: number;
  /** User-Agent header sent on every request. */
  userAgent: string;
  /** robots.txt behavior: 'off' skips the check, 'respect' enforces it. */
  robots: RobotsMode;
  /** Allow requests to private/loopback/link-local addresses (development use only). */
  allowPrivateAddresses: boolean;
  /** Ports that may be requested; other ports are rejected. */
  allowedPorts: number[];
}

export const DEFAULT_SOURCE_FETCH_CONFIG: SourceFetchConfig = {
  timeoutMs: 15_000,
  maxBytes: 10 * 1024 * 1024,
  maxRedirects: 5,
  maxUrlLength: 2048,
  userAgent:
    'Mozilla/5.0 (compatible; memsystems/1.0; +https://memsystems.ai/bot)',
  robots: 'off',
  allowPrivateAddresses: false,
  allowedPorts: [80, 443],
};

function parseIntEnv(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadSourceFetchConfig(
  env: NodeJS.ProcessEnv = process.env,
): SourceFetchConfig {
  const allowedPorts =
    env.SOURCE_FETCH_ALLOWED_PORTS?.split(',')
      .map((p) => Number.parseInt(p.trim(), 10))
      .filter((p) => Number.isInteger(p) && p > 0 && p <= 65535) ?? [];

  return {
    timeoutMs: parseIntEnv(
      env.SOURCE_FETCH_TIMEOUT_MS,
      DEFAULT_SOURCE_FETCH_CONFIG.timeoutMs,
    ),
    maxBytes: parseIntEnv(
      env.SOURCE_FETCH_MAX_BYTES,
      DEFAULT_SOURCE_FETCH_CONFIG.maxBytes,
    ),
    maxRedirects: parseIntEnv(
      env.SOURCE_FETCH_MAX_REDIRECTS,
      DEFAULT_SOURCE_FETCH_CONFIG.maxRedirects,
    ),
    maxUrlLength: parseIntEnv(
      env.SOURCE_FETCH_MAX_URL_LENGTH,
      DEFAULT_SOURCE_FETCH_CONFIG.maxUrlLength,
    ),
    userAgent:
      env.SOURCE_FETCH_USER_AGENT ?? DEFAULT_SOURCE_FETCH_CONFIG.userAgent,
    robots: env.SOURCE_FETCH_ROBOTS === 'respect' ? 'respect' : 'off',
    allowPrivateAddresses: env.SOURCE_FETCH_ALLOW_PRIVATE === 'true',
    allowedPorts:
      allowedPorts.length > 0
        ? allowedPorts
        : DEFAULT_SOURCE_FETCH_CONFIG.allowedPorts,
  };
}

export interface ValidatedUrl {
  url: URL;
  /** Canonical identity: lowercase host, no fragment, default port stripped. */
  normalizedUrl: string;
}

/**
 * Robots.txt parser for the subset of the standard that matters here:
 * `User-agent`, `Allow`, `Disallow` rules with `*` wildcards and trailing `$`
 * anchors. Groups are ordered; the first group matching the user agent wins.
 */
export class RobotsTxt {
  private constructor(
    private readonly groups: {
      userAgents: string[];
      allow: string[];
      disallow: string[];
    }[],
  ) {}

  static parse(text: string): RobotsTxt {
    const groups: RobotsTxt['groups'] = [];
    let current: (typeof groups)[number] | null = null;

    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const sep = line.indexOf(':');
      if (sep === -1) continue;
      const field = line.slice(0, sep).trim().toLowerCase();
      const value = line.slice(sep + 1).trim();
      if (field === 'user-agent') {
        if (current) groups.push(current);
        current = {
          userAgents: [value.toLowerCase()],
          allow: [],
          disallow: [],
        };
      } else if (current) {
        if (field === 'allow') current.allow.push(value);
        else if (field === 'disallow') current.disallow.push(value);
      }
    }
    if (current) groups.push(current);

    return new RobotsTxt(groups);
  }

  isAllowed(userAgent: string, path: string): boolean {
    const ua = userAgent.toLowerCase();
    const group =
      this.groups.find(
        (g) =>
          g.userAgents.includes('*') ||
          g.userAgents.some((candidate) => ua.includes(candidate)),
      ) ?? null;

    if (!group) return true;

    const disallowed = group.disallow.some((rule) =>
      globToRegex(rule).test(path),
    );
    if (!disallowed) return true;

    const allowed = group.allow.some((rule) => globToRegex(rule).test(path));
    return allowed;
  }
}

function globToRegex(pattern: string): RegExp {
  if (!pattern) return /^$/;
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '*') {
      out += '.*';
    } else if (ch === '$' && i === pattern.length - 1) {
      out += '$';
    } else {
      out += ch.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${out}`);
}

function isPrivateIpv4(o1: number, o2: number, o3: number): boolean {
  if (o1 === 0) return true; // 0.0.0.0/8
  if (o1 === 10) return true; // 10.0.0.0/8
  if (o1 === 100 && o2 >= 64 && o2 <= 127) return true; // 100.64.0.0/10 (CGNAT)
  if (o1 === 127) return true; // 127.0.0.0/8 loopback
  if (o1 === 169 && o2 === 254) return true; // 169.254.0.0/16 link-local + cloud metadata
  if (o1 === 172 && o2 >= 16 && o2 <= 31) return true; // 172.16.0.0/12
  if (o1 === 192 && o2 === 168) return true; // 192.168.0.0/16
  if (o1 === 192 && o2 === 0 && o3 === 0) return true; // 192.0.0.0/24
  if (o1 === 198 && (o2 === 18 || o2 === 19)) return true; // 198.18.0.0/15
  if (o1 >= 224) return true; // multicast + reserved
  return false;
}

/** Expands an IPv6 address (with `::`) into 8 hextets, or null when malformed. */
function expandIpv6(address: string): string[] | null {
  if (!address.includes('::')) {
    const parts = address.split(':');
    if (parts.length !== 8) return null;
    return parts.every((h) => /^[0-9a-f]{1,4}$/i.test(h)) ? parts : null;
  }
  const [left, right] = address.split('::', 2);
  const leftParts = left ? left.split(':') : [];
  const rightParts = right ? right.split(':') : [];
  const missing = 8 - leftParts.length - rightParts.length;
  if (missing < 1) return null;
  const all = [
    ...leftParts,
    ...new Array<string>(missing).fill('0'),
    ...rightParts,
  ];
  return all.every((h) => /^[0-9a-f]{1,4}$/i.test(h)) ? all : null;
}

function isPrivateIpv6(address: string): boolean {
  const mappedV4 = address.toLowerCase().match(/^::ffff:(.+)$/);
  if (mappedV4) {
    const inner = mappedV4[1];
    // Node's URL parser normalizes mapped IPv4 to hex, e.g. ::ffff:7f00:1
    if (inner.includes('.')) return isPrivateAddress(inner);
    const [hi, lo] = inner.split(':');
    if (!hi || !lo) return true;
    const hi16 = Number.parseInt(hi, 16);
    const lo16 = Number.parseInt(lo, 16);
    if (!Number.isFinite(hi16) || !Number.isFinite(lo16)) return true;
    return isPrivateIpv4(hi16 >> 8, hi16 & 0xff, lo16 >> 8);
  }

  const parts = expandIpv6(address);
  if (!parts) return true; // malformed literal: fail closed
  const first = Number.parseInt(parts[0], 16);
  const second = Number.parseInt(parts[1], 16);
  if (first === 0 && parts.slice(1).every((h) => h === '0')) return true; // ::
  if (
    first === 0 &&
    second === 0 &&
    parts[7] === '1' &&
    parts.slice(2, 7).every((h) => h === '0')
  ) {
    return true; // ::1 loopback
  }
  if (first >= 0xfc00 && first <= 0xfdff) return true; // fc00::/7 unique local
  if (first >= 0xfe80 && first <= 0xfebf) return true; // fe80::/10 link-local
  return false;
}

export function isPrivateAddress(address: string): boolean {
  if (isIPv4(address)) {
    const parts = address.split('.').map((p) => Number.parseInt(p, 10));
    return isPrivateIpv4(parts[0], parts[1], parts[2]);
  }
  if (isIPv6(address)) return isPrivateIpv6(address);
  return true; // unknown format: fail closed
}

const HOSTNAME_RE = /^[a-z0-9]([a-z0-9-_.]*[a-z0-9])?$/i;

function stripIpv6Brackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;
}

@Injectable()
export class SourcePolicyService {
  private readonly config: SourceFetchConfig;
  private readonly resolver: HostnameResolver;

  constructor(
    @Optional() @Inject(SOURCE_FETCH_CONFIG) config?: SourceFetchConfig,
    @Optional() resolver?: HostnameResolver,
  ) {
    this.config = config ?? loadSourceFetchConfig();
    this.resolver = resolver ?? defaultResolver;
  }

  /**
   * Validates a URL for acquisition: scheme, hostname shape, port policy,
   * length, credentials, and SSRF safety (resolved DNS addresses).
   */
  async validateUrl(input: string): Promise<ValidatedUrl> {
    if (typeof input !== 'string' || input.length === 0) {
      throw new WebScrapeError('URL is required', 'invalid_url', {
        messageKey: 'errors.sources.web.urlRequired',
      });
    }
    if (input.length > this.config.maxUrlLength) {
      throw new WebScrapeError(
        `URL exceeds maximum length of ${this.config.maxUrlLength} characters`,
        'invalid_url',
        {
          messageKey: 'errors.sources.web.urlTooLong',
          params: { max: this.config.maxUrlLength },
        },
      );
    }

    let url: URL;
    try {
      url = new URL(input);
    } catch {
      throw new WebScrapeError(`Invalid URL: ${input}`, 'invalid_url', {
        messageKey: 'errors.sources.web.urlInvalid',
        params: { url: input },
      });
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new WebScrapeError(
        `Unsupported protocol: ${url.protocol.replace(':', '') || 'unknown'}`,
        'invalid_url',
        {
          messageKey: 'errors.sources.web.protocolUnsupported',
          params: { protocol: url.protocol.replace(':', '') || 'unknown' },
        },
      );
    }

    const hostname = stripIpv6Brackets(url.hostname);
    if (!hostname) {
      throw new WebScrapeError('Invalid hostname: empty', 'invalid_url', {
        messageKey: 'errors.sources.web.hostnameEmpty',
      });
    }
    const isIpLiteral = isIPv4(hostname) || isIPv6(hostname);
    if (!isIpLiteral && !HOSTNAME_RE.test(hostname)) {
      throw new WebScrapeError(
        `Invalid hostname: ${url.hostname}`,
        'invalid_url',
        {
          messageKey: 'errors.sources.web.hostnameInvalid',
          params: { hostname: url.hostname },
        },
      );
    }

    const port = url.port ? Number.parseInt(url.port, 10) : 0;
    if (port && !this.config.allowedPorts.includes(port)) {
      throw new WebScrapeError(
        `Port ${port} is not allowed. Allowed ports: ${this.config.allowedPorts.join(', ')}`,
        'blocked_url',
        {
          messageKey: 'errors.sources.web.portNotAllowed',
          params: {
            port,
            allowedPorts: this.config.allowedPorts.join(', '),
          },
        },
      );
    }

    if (url.username || url.password) {
      throw new WebScrapeError(
        'URLs with embedded credentials are not allowed',
        'blocked_url',
        { messageKey: 'errors.sources.web.credentialsNotAllowed' },
      );
    }

    if (
      !this.config.allowPrivateAddresses &&
      (await this.isPrivateHostname(hostname))
    ) {
      throw new WebScrapeError(
        `URL resolves to a private or restricted address: ${hostname}`,
        'blocked_url',
        {
          messageKey: 'errors.sources.web.privateAddress',
          params: { hostname },
        },
      );
    }

    return { url, normalizedUrl: this.normalizeUrl(url) };
  }

  async isPrivateHostname(hostname: string): Promise<boolean> {
    const lower = stripIpv6Brackets(hostname.toLowerCase());
    if (lower === 'localhost') return true;
    if (lower.endsWith('.localhost')) return true;
    if (isIPv4(lower) || isIPv6(lower)) return isPrivateAddress(lower);

    let addresses: string[];
    try {
      addresses = await this.resolver.lookupAll(lower);
    } catch {
      return true; // unresolvable host: fail closed
    }
    return addresses.length === 0 || addresses.some((a) => isPrivateAddress(a));
  }

  /**
   * Normalizes a URL for identity purposes: lowercases the host, removes
   * credentials, fragments and default ports, and adds a trailing slash to an
   * empty path. The query string is preserved as requested (identity includes
   * query parameters; parameter-level policies are a later dedup concern).
   */
  normalizeUrl(input: string | URL): string {
    const url =
      input instanceof URL ? new URL(input.toString()) : new URL(input);
    url.username = '';
    url.password = '';
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    if (
      (url.protocol === 'http:' && url.port === '80') ||
      (url.protocol === 'https:' && url.port === '443')
    ) {
      url.port = '';
    }
    if (url.pathname === '') url.pathname = '/';
    return url.toString();
  }

  /** Robots.txt policy check. Records whether fetching is allowed, denied, or skipped. */
  async checkRobots(url: URL): Promise<RobotsDecisionValue> {
    if (this.config.robots !== 'respect') return 'skipped';

    let text: string;
    try {
      const response = await fetch(`${url.origin}/robots.txt`, {
        headers: { 'User-Agent': this.config.userAgent, Accept: 'text/plain' },
        redirect: 'follow',
        signal: AbortSignal.timeout(3_000),
      });
      if (!response.ok) return 'unavailable';
      text = await readBoundedText(response, 1024 * 1024);
    } catch {
      return 'unavailable';
    }

    const robots = RobotsTxt.parse(text);
    return robots.isAllowed(this.config.userAgent, url.pathname + url.search)
      ? 'allowed'
      : 'denied';
  }
}

async function readBoundedText(
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
        return '';
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
