import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SOURCE_FETCH_CONFIG,
  SourcePolicyService,
} from '../../src/modules/sources/source-policy.service';
import type { HostnameResolver } from '../../src/modules/sources/source-policy.service';

function policyWithResolver(hostnames: Record<string, string[]>) {
  const resolver: HostnameResolver = {
    lookupAll: async (hostname) => hostnames[hostname] ?? [],
  };
  return new SourcePolicyService({ ...DEFAULT_SOURCE_FETCH_CONFIG }, resolver);
}

describe('SourcePolicyService SSRF via DNS resolution', () => {
  it('rejects a hostname resolving to a private address', async () => {
    const service = policyWithResolver({
      'innocent.example.com': ['10.0.0.5', '93.184.216.34'],
    });
    await expect(
      service.validateUrl('http://innocent.example.com/x'),
    ).rejects.toThrow('private or restricted');
  });

  it('rejects a hostname resolving to a loopback address', async () => {
    const service = policyWithResolver({
      'innocent.example.com': ['127.0.0.1'],
    });
    await expect(
      service.validateUrl('http://innocent.example.com/x'),
    ).rejects.toThrow('private or restricted');
  });

  it('rejects hostnames resolving to link-local IPv6', async () => {
    const service = policyWithResolver({
      'innocent.example.com': ['fe80::1'],
    });
    await expect(
      service.validateUrl('http://innocent.example.com/x'),
    ).rejects.toThrow('private or restricted');
  });

  it('accepts hostnames resolving only to public addresses', async () => {
    const service = policyWithResolver({
      'example.com': ['93.184.216.34', '2606:4700::6810:84e5'],
    });
    const result = await service.validateUrl('http://example.com/x');
    expect(result.normalizedUrl).toBe('http://example.com/x');
  });

  it('fails closed when DNS resolution fails', async () => {
    const resolver: HostnameResolver = {
      lookupAll: async () => {
        throw new Error('ENOTFOUND');
      },
    };
    const service = new SourcePolicyService(
      { ...DEFAULT_SOURCE_FETCH_CONFIG },
      resolver,
    );
    await expect(
      service.validateUrl('http://unresolvable.example.com/x'),
    ).rejects.toThrow('private or restricted');
  });

  it('fails closed when DNS returns no addresses', async () => {
    const service = policyWithResolver({});
    await expect(
      service.validateUrl('http://empty.example.com/x'),
    ).rejects.toThrow('private or restricted');
  });

  it('does not resolve literal IP addresses', async () => {
    let lookedUp = false;
    const resolver: HostnameResolver = {
      lookupAll: async () => {
        lookedUp = true;
        return ['93.184.216.34'];
      },
    };
    const service = new SourcePolicyService(
      { ...DEFAULT_SOURCE_FETCH_CONFIG },
      resolver,
    );
    await service.validateUrl('http://93.184.216.34/x');
    expect(lookedUp).toBe(false);
  });
});
