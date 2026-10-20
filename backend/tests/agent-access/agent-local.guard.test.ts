import { HttpException, type ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import {
  AgentLocalGuard,
  isAllowedHostValue,
  isAllowedOrigin,
  parseAllowedHosts,
  parseHostname,
} from '../../src/modules/agent-access/agent-local.guard';

function guardWith(allowedHosts?: string): AgentLocalGuard {
  const config = {
    get: (key: string) =>
      key === 'AGENT_ALLOWED_HOSTS' ? allowedHosts : undefined,
  } as unknown as ConfigService;
  return new AgentLocalGuard(config);
}

function contextWith(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
      getResponse: () => ({ setHeader: () => undefined }),
    }),
  } as unknown as ExecutionContext;
}

function rejection(
  guard: AgentLocalGuard,
  headers: Record<string, string>,
): unknown {
  try {
    guard.canActivate(contextWith(headers));
    return null;
  } catch (error) {
    return error;
  }
}

describe('AgentLocalGuard', () => {
  it('accepts local Host headers with or without a port', () => {
    expect(guardWith().canActivate(contextWith({ host: 'localhost' }))).toBe(
      true,
    );
    expect(
      guardWith().canActivate(contextWith({ host: 'localhost:4000' })),
    ).toBe(true);
    expect(
      guardWith().canActivate(contextWith({ host: '127.0.0.1:4000' })),
    ).toBe(true);
    expect(guardWith().canActivate(contextWith({ host: '[::1]:4000' }))).toBe(
      true,
    );
    expect(guardWith().canActivate(contextWith({ host: '[::1]' }))).toBe(true);
  });

  it('accepts local Origins and requests without an Origin', () => {
    expect(
      guardWith().canActivate(
        contextWith({
          host: 'localhost:4000',
          origin: 'http://localhost:3000',
        }),
      ),
    ).toBe(true);
    expect(
      guardWith().canActivate(
        contextWith({
          host: '127.0.0.1:4000',
          origin: 'http://127.0.0.1:3000',
        }),
      ),
    ).toBe(true);
    expect(guardWith().canActivate(contextWith({ host: 'localhost' }))).toBe(
      true,
    );
  });

  it('rejects non-local Host headers with agent_origin_rejected', async () => {
    const error = rejection(guardWith(), { host: 'evil.example.com' });

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(403);
    expect((error as HttpException).getResponse()).toMatchObject({
      statusCode: 403,
      code: 'agent_origin_rejected',
    });
  });

  it('rejects non-local Origins even when the Host is local', async () => {
    const error = rejection(guardWith(), {
      host: 'localhost:4000',
      origin: 'https://evil.example.com',
    });

    expect((error as HttpException).getStatus()).toBe(403);
    expect((error as HttpException).getResponse()).toMatchObject({
      code: 'agent_origin_rejected',
    });
  });

  it('rejects a null Origin', async () => {
    const error = rejection(guardWith(), {
      host: 'localhost:4000',
      origin: 'null',
    });
    expect((error as HttpException).getStatus()).toBe(403);
  });

  it('allows hosts listed in AGENT_ALLOWED_HOSTS', () => {
    const guard = guardWith('agent.example.com, 10.0.0.5:4000');

    expect(
      guard.canActivate(
        contextWith({
          host: 'agent.example.com:4000',
          origin: 'https://agent.example.com',
        }),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(contextWith({ host: '10.0.0.5:4000' })),
    ).toBe(true);
    expect(() =>
      guard.canActivate(contextWith({ host: 'other.example.com' })),
    ).toThrow(HttpException);
  });

  it('parses Host headers and allowlists', () => {
    expect(parseHostname('LOCALHOST:4000')).toBe('localhost');
    expect(parseHostname('[::1]:4000')).toBe('::1');
    expect(parseAllowedHosts('a.example, b.example ,')).toEqual([
      'a.example',
      'b.example',
    ]);
    expect(isAllowedHostValue('localhost:3000', [])).toBe(true);
    expect(isAllowedOrigin('https://example.com', ['example.com'])).toBe(true);
    expect(isAllowedOrigin('not a url', [])).toBe(false);
  });
});
