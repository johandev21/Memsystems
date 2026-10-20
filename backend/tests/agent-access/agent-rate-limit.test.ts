import { HttpException, type ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { AgentRateLimitGuard } from '../../src/modules/agent-access/agent-rate-limit.guard';
import {
  AGENT_RATE_LIMIT_WINDOW_MS,
  AgentRateLimitService,
  DEFAULT_AGENT_RATE_LIMITS,
} from '../../src/modules/agent-access/agent-rate-limit.service';

function serviceWith(env: Record<string, string> = {}): AgentRateLimitService {
  const config = {
    get: (key: string) => env[key],
  } as unknown as ConfigService;
  return new AgentRateLimitService(config);
}

function rateLimitContext(request: Record<string, unknown>) {
  const setHeader = vi.fn();
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({ setHeader }),
    }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
  return { context, setHeader };
}

describe('AgentRateLimitService', () => {
  it('uses the documented defaults and environments overrides', () => {
    expect(serviceWith().limitFor('mcp')).toBe(
      DEFAULT_AGENT_RATE_LIMITS.mcp,
    );
    expect(serviceWith().limitFor('chat')).toBe(
      DEFAULT_AGENT_RATE_LIMITS.chat,
    );
    expect(serviceWith().limitFor('generate')).toBe(
      DEFAULT_AGENT_RATE_LIMITS.generate,
    );
    expect(
      serviceWith({
        AGENT_MCP_RATE_LIMIT: '7',
        AGENT_CHAT_RATE_LIMIT: '8',
        AGENT_GENERATE_RATE_LIMIT: '9',
      }).limitFor('generate'),
    ).toBe(9);
    expect(
      serviceWith({ AGENT_CHAT_RATE_LIMIT: 'not-a-number' }).limitFor('chat'),
    ).toBe(DEFAULT_AGENT_RATE_LIMITS.chat);
  });

  it('allows requests inside the window and rejects the next one', () => {
    const service = serviceWith({ AGENT_CHAT_RATE_LIMIT: '2' });
    const start = 1_000;

    expect(service.consume('chat', 'ip:1', start).allowed).toBe(true);
    expect(service.consume('chat', 'ip:1', start + 1_000).allowed).toBe(true);

    const denied = service.consume('chat', 'ip:1', start + 2_000);
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.retryAfterSeconds).toBe(58);
  });

  it('slides the window instead of resetting it on a fixed boundary', () => {
    const service = serviceWith({ AGENT_CHAT_RATE_LIMIT: '2' });
    const start = 1_000;

    service.consume('chat', 'ip:1', start);
    service.consume('chat', 'ip:1', start + 1_000);

    // The oldest request is still inside the window one millisecond earlier.
    expect(
      service.consume('chat', 'ip:1', start + AGENT_RATE_LIMIT_WINDOW_MS - 1)
        .allowed,
    ).toBe(false);

    // Once the oldest request expires, one slot frees up.
    expect(
      service.consume('chat', 'ip:1', start + AGENT_RATE_LIMIT_WINDOW_MS)
        .allowed,
    ).toBe(true);
  });

  it('keys windows per scope and per agent/ip', () => {
    const service = serviceWith({ AGENT_CHAT_RATE_LIMIT: '1' });

    expect(service.consume('chat', 'ip:1', 1_000).allowed).toBe(true);
    expect(service.consume('chat', 'ip:2', 1_000).allowed).toBe(true);
    expect(service.consume('chat', 'ip:1', 1_000).allowed).toBe(false);
  });
});

describe('AgentRateLimitGuard', () => {
  it('sets Retry-After and returns agent_rate_limited when over budget', () => {
    const service = serviceWith({ AGENT_CHAT_RATE_LIMIT: '1' });
    const reflector = {
      getAllAndOverride: () => 'chat',
    } as unknown as Reflector;
    const guard = new AgentRateLimitGuard(service, reflector);
    const { context, setHeader } = rateLimitContext({ ip: '10.0.0.2' });

    expect(guard.canActivate(context)).toBe(true);

    const error = (() => {
      try {
        guard.canActivate(context);
        return null;
      } catch (caught) {
        return caught;
      }
    })();

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    expect((error as HttpException).getResponse()).toMatchObject({
      statusCode: 429,
      code: 'agent_rate_limited',
    });
    expect(setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('uses the Agent Key as the bucket key when one is attached', () => {
    const service = serviceWith({ AGENT_MCP_RATE_LIMIT: '1' });
    const reflector = {
      getAllAndOverride: () => 'mcp',
    } as unknown as Reflector;
    const guard = new AgentRateLimitGuard(service, reflector);
    const first = rateLimitContext({
      ip: '10.0.0.2',
      agentKey: { id: 'key_1', name: 'One' },
    });
    const second = rateLimitContext({
      ip: '10.0.0.2',
      agentKey: { id: 'key_2', name: 'Two' },
    });

    expect(guard.canActivate(first.context)).toBe(true);
    expect(guard.canActivate(second.context)).toBe(true);
    expect(() => guard.canActivate(first.context)).toThrow(HttpException);
  });
});
