import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SOURCE_FETCH_CONFIG,
  isPrivateAddress,
  RobotsTxt,
  SourcePolicyService,
  type HostnameResolver,
} from '../../src/modules/sources/source-policy.service';
import { WebScrapeError } from '../../src/modules/sources/source-errors';

const testResolver: HostnameResolver = {
  lookupAll: async (hostname) => {
    if (hostname === 'example.com') return ['93.184.216.34'];
    return [];
  },
};

function policy(overrides: Partial<typeof DEFAULT_SOURCE_FETCH_CONFIG> = {}) {
  return new SourcePolicyService(
    {
      ...DEFAULT_SOURCE_FETCH_CONFIG,
      ...overrides,
    },
    testResolver,
  );
}

describe('SourcePolicyService URL validation', () => {
  it('accepts valid http(s) URLs', async () => {
    const service = policy();
    const result = await service.validateUrl('https://example.com/article');
    expect(result.normalizedUrl).toBe('https://example.com/article');
  });

  it('rejects non-http schemes', async () => {
    const service = policy();
    await expect(service.validateUrl('ftp://example.com/file')).rejects.toThrow(
      'Unsupported protocol',
    );
    await expect(service.validateUrl('javascript:alert(1)')).rejects.toThrow(
      'Unsupported protocol',
    );
  });

  it('rejects invalid URLs and missing hostnames', async () => {
    const service = policy();
    await expect(service.validateUrl('not a url')).rejects.toThrow(
      WebScrapeError,
    );
    await expect(service.validateUrl('http://')).rejects.toThrow(
      WebScrapeError,
    );
  });

  it('rejects URLs with embedded credentials', async () => {
    const service = policy();
    await expect(
      service.validateUrl('https://user:pass@example.com/page'),
    ).rejects.toThrow('embedded credentials');
  });

  it('rejects disallowed ports', async () => {
    const service = policy();
    await expect(
      service.validateUrl('https://example.com:8443/page'),
    ).rejects.toThrow('Port 8443 is not allowed');
  });

  it('allows configured non-default ports', async () => {
    const service = policy({ allowedPorts: [80, 443, 8443] });
    const result = await service.validateUrl('https://example.com:8443/page');
    expect(result.url.port).toBe('8443');
  });

  it('rejects URLs longer than the configured maximum', async () => {
    const service = policy({ maxUrlLength: 50 });
    await expect(
      service.validateUrl('https://example.com/' + 'a'.repeat(60)),
    ).rejects.toThrow('exceeds maximum length');
  });

  it('rejects localhost and loopback addresses', async () => {
    const service = policy();
    await expect(service.validateUrl('http://localhost/x')).rejects.toThrow(
      'private or restricted',
    );
    await expect(service.validateUrl('http://127.0.0.1/x')).rejects.toThrow(
      'private or restricted',
    );
    await expect(service.validateUrl('http://[::1]/x')).rejects.toThrow(
      'private or restricted',
    );
  });

  it('rejects private and link-local IPv4 ranges', async () => {
    const service = policy();
    for (const ip of [
      '10.0.0.1',
      '172.16.0.1',
      '172.31.255.254',
      '192.168.1.1',
      '169.254.169.254', // cloud metadata
      '100.64.0.1', // CGNAT
    ]) {
      await expect(service.validateUrl(`http://${ip}/x`)).rejects.toThrow(
        'private or restricted',
      );
    }
  });

  it('rejects private IPv6 ranges', async () => {
    const service = policy();
    for (const ip of ['fc00::1', 'fd12:3456::1', 'fe80::1']) {
      await expect(service.validateUrl(`http://[${ip}]/x`)).rejects.toThrow(
        'private or restricted',
      );
    }
  });

  it('rejects IPv4-mapped IPv6 loopback addresses', async () => {
    const service = policy();
    await expect(
      service.validateUrl('http://[::ffff:127.0.0.1]/x'),
    ).rejects.toThrow('private or restricted');
  });

  it('allows public addresses', async () => {
    const service = policy();
    const result = await service.validateUrl('http://93.184.216.34/page');
    expect(result.normalizedUrl).toBe('http://93.184.216.34/page');
  });

  it('allows private addresses when explicitly enabled', async () => {
    const service = policy({
      allowPrivateAddresses: true,
      allowedPorts: [80, 443, 8080],
    });
    const result = await service.validateUrl('http://192.168.1.10:8080/x');
    expect(result.url.port).toBe('8080');
  });
});

describe('SourcePolicyService URL normalization', () => {
  it('removes fragments', () => {
    expect(policy().normalizeUrl('https://Example.com/a#section')).toBe(
      'https://example.com/a',
    );
  });

  it('lowercases the hostname and strips default ports', () => {
    expect(policy().normalizeUrl('HTTPS://EXAMPLE.com:443/a')).toBe(
      'https://example.com/a',
    );
    expect(policy().normalizeUrl('http://example.com:80/a')).toBe(
      'http://example.com/a',
    );
  });

  it('keeps non-default ports and query strings', () => {
    expect(
      policy({ allowedPorts: [80, 443, 8443] }).normalizeUrl(
        'https://example.com:8443/a?q=1&utm=b',
      ),
    ).toBe('https://example.com:8443/a?q=1&utm=b');
  });

  it('normalizes an empty path to a trailing slash', () => {
    expect(policy().normalizeUrl('https://example.com')).toBe(
      'https://example.com/',
    );
  });

  it('strips embedded credentials during normalization', () => {
    expect(policy().normalizeUrl('https://user:pass@example.com/a')).toBe(
      'https://example.com/a',
    );
  });
});

describe('isPrivateAddress', () => {
  it('classifies IPv4 ranges', () => {
    expect(isPrivateAddress('10.1.2.3')).toBe(true);
    expect(isPrivateAddress('192.168.1.1')).toBe(true);
    expect(isPrivateAddress('172.20.0.1')).toBe(true);
    expect(isPrivateAddress('169.254.169.254')).toBe(true);
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
    expect(isPrivateAddress('93.184.216.34')).toBe(false);
  });

  it('classifies IPv6 ranges', () => {
    expect(isPrivateAddress('::1')).toBe(true);
    expect(isPrivateAddress('::')).toBe(true);
    expect(isPrivateAddress('fc00::1')).toBe(true);
    expect(isPrivateAddress('fe80::1')).toBe(true);
    expect(isPrivateAddress('2606:4700:4700::1111')).toBe(false);
    expect(isPrivateAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateAddress('::ffff:7f00:1')).toBe(true);
    expect(isPrivateAddress('::ffff:8.8.8.8')).toBe(false);
  });
});

describe('RobotsTxt', () => {
  it('allows everything when no rules match', () => {
    const robots = RobotsTxt.parse('User-agent: *\nDisallow: /private/');
    expect(robots.isAllowed('memsystems/1.0', '/public/page')).toBe(true);
  });

  it('denies matching disallow rules', () => {
    const robots = RobotsTxt.parse('User-agent: *\nDisallow: /private/');
    expect(robots.isAllowed('memsystems/1.0', '/private/secret')).toBe(false);
  });

  it('prefers allow rules over disallow', () => {
    const robots = RobotsTxt.parse(
      'User-agent: *\nAllow: /private/\nDisallow: /',
    );
    expect(robots.isAllowed('memsystems/1.0', '/private/ok')).toBe(true);
    expect(robots.isAllowed('memsystems/1.0', '/other')).toBe(false);
  });

  it('matches wildcard patterns', () => {
    const robots = RobotsTxt.parse('User-agent: *\nDisallow: /*.pdf$');
    expect(robots.isAllowed('memsystems/1.0', '/manual.pdf')).toBe(false);
    expect(robots.isAllowed('memsystems/1.0', '/manual.pdf/page')).toBe(true);
  });

  it('matches user-agent groups by prefix', () => {
    const robots = RobotsTxt.parse(
      'User-agent: specialbot\nDisallow: /no\n\nUser-agent: *\nDisallow: /all',
    );
    // The first matching group is authoritative
    expect(robots.isAllowed('specialbot/2.0', '/no')).toBe(false);
    expect(robots.isAllowed('specialbot/2.0', '/all')).toBe(true);
    expect(robots.isAllowed('otherbot/1.0', '/no')).toBe(true);
    expect(robots.isAllowed('otherbot/1.0', '/all')).toBe(false);
  });

  it('treats an empty disallow as allowing everything', () => {
    const robots = RobotsTxt.parse('User-agent: *\nDisallow:');
    expect(robots.isAllowed('memsystems/1.0', '/anything')).toBe(true);
  });
});
