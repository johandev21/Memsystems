import {
  HttpException,
  type ExecutionContext,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  AgentKeyGuard,
  extractBearerToken,
} from '../../src/modules/agent-access/agent-key.guard';
import type { AgentKeysService } from '../../src/modules/agent-access/agent-keys.service';
import type { AgentAuthenticatedRequest } from '../../src/modules/agent-access/agent-request.types';

function contextFor(request: AgentAuthenticatedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({ setHeader: vi.fn() }),
    }),
  } as unknown as ExecutionContext;
}

function guardWith(validateKey: (key: string) => Promise<unknown>) {
  const service = {
    validateKey: vi.fn(validateKey),
  } as unknown as AgentKeysService;
  return { guard: new AgentKeyGuard(service), service };
}

describe('AgentKeyGuard', () => {
  it('attaches the Agent Key identity and MCP auth info', async () => {
    const { guard, service } = guardWith(async () => ({
      id: 'key_1',
      name: 'Claude Code',
    }));
    const request = {
      headers: { authorization: 'Bearer msk_test-key' },
    } as unknown as AgentAuthenticatedRequest;

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(service.validateKey).toHaveBeenCalledWith('msk_test-key');
    expect(request.agentKey).toEqual({ id: 'key_1', name: 'Claude Code' });
    expect(request.auth).toEqual({
      token: 'msk_test-key',
      clientId: 'key_1',
      scopes: [],
    });
  });

  it('rejects a missing Authorization header with agent_key_invalid', async () => {
    const { guard, service } = guardWith(async () => null);
    const request = { headers: {} } as unknown as AgentAuthenticatedRequest;

    const error = await guard
      .canActivate(contextFor(request))
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(401);
    expect((error as HttpException).getResponse()).toMatchObject({
      statusCode: 401,
      code: 'agent_key_invalid',
    });
    expect(service.validateKey).not.toHaveBeenCalled();
  });

  it('rejects a revoked or unknown key with agent_key_invalid', async () => {
    const { guard } = guardWith(async () => null);
    const request = {
      headers: { authorization: 'Bearer msk_revoked' },
    } as unknown as AgentAuthenticatedRequest;

    const error = await guard
      .canActivate(contextFor(request))
      .catch((caught: unknown) => caught);

    expect((error as HttpException).getResponse()).toMatchObject({
      statusCode: 401,
      code: 'agent_key_invalid',
    });
    expect(request.agentKey).toBeUndefined();
  });

  it('accepts only the Bearer scheme', () => {
    expect(extractBearerToken('Bearer msk_abc')).toBe('msk_abc');
    expect(extractBearerToken('bearer   msk_abc  ')).toBe('msk_abc');
    expect(extractBearerToken('Basic abc')).toBeNull();
    expect(extractBearerToken('Bearer ')).toBeNull();
    expect(extractBearerToken(undefined)).toBeNull();
  });
});
