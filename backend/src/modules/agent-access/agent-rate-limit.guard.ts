import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import {
  AgentRateLimitService,
  type AgentRateLimitScope,
} from './agent-rate-limit.service';
import type {
  AgentAuthenticatedRequest,
  AgentErrorBody,
} from './agent-request.types';

export const AGENT_RATE_LIMIT_SCOPE = 'agent_rate_limit_scope';

/**
 * Selects the rate-limit budget for a route. Routes without the decorator use
 * the MCP budget, so the MCP controller can apply the guard without metadata.
 */
export const AgentRateLimit = (scope: AgentRateLimitScope) =>
  SetMetadata(AGENT_RATE_LIMIT_SCOPE, scope);

function rateLimitedError(
  limit: number,
  retryAfterSeconds: number,
): AgentErrorBody {
  return {
    statusCode: HttpStatus.TOO_MANY_REQUESTS,
    message: `Rate limit exceeded (${limit} requests per minute). Try again in ${retryAfterSeconds}s.`,
    code: 'agent_rate_limited',
    retryAfter: retryAfterSeconds,
  };
}

/**
 * Enforces the per-scope sliding window. MCP requests are keyed by Agent Key
 * (the guard runs after `AgentKeyGuard`); chat and generation requests are
 * keyed by client IP because the UI does not present an Agent Key.
 */
@Injectable()
export class AgentRateLimitGuard implements CanActivate {
  constructor(
    private readonly rateLimitService: AgentRateLimitService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const scope =
      this.reflector.getAllAndOverride<AgentRateLimitScope>(
        AGENT_RATE_LIMIT_SCOPE,
        [context.getHandler(), context.getClass()],
      ) ?? 'mcp';

    const http = context.switchToHttp();
    const request = http.getRequest<AgentAuthenticatedRequest>();
    const key = request.agentKey
      ? `agent:${request.agentKey.id}`
      : `ip:${request.ip ?? request.socket?.remoteAddress ?? 'unknown'}`;

    const result = this.rateLimitService.consume(scope, key);
    if (result.allowed) {
      return true;
    }

    const response = http.getResponse<Response>();
    response.setHeader('Retry-After', String(result.retryAfterSeconds));
    throw new HttpException(
      rateLimitedError(result.limit, result.retryAfterSeconds),
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
