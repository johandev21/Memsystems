import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { AgentKeysService } from './agent-keys.service';
import type {
  AgentAuthenticatedRequest,
  AgentErrorBody,
} from './agent-request.types';

const MISSING_KEY_MESSAGE =
  'Provide an Agent Key as `Authorization: Bearer <agentKey>`.';
const INVALID_KEY_MESSAGE =
  'The Agent Key is invalid or has been revoked. Create a new key in Settings.';

export function invalidAgentKeyError(message: string): AgentErrorBody {
  return {
    statusCode: HttpStatus.UNAUTHORIZED,
    message,
    code: 'agent_key_invalid',
  };
}

/** Extracts the token from an `Authorization: Bearer <token>` header. */
export function extractBearerToken(header: unknown): string | null {
  if (typeof header !== 'string') {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token ? token : null;
}

/**
 * Authenticates MCP requests with an Agent Key.
 *
 * On success it attaches `req.agentKey` (the identity used by tools and audit
 * rows) and `req.auth` (the shape `toNodeHandler` forwards to the MCP server as
 * `authInfo`).
 */
@Injectable()
export class AgentKeyGuard implements CanActivate {
  constructor(private readonly agentKeysService: AgentKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AgentAuthenticatedRequest>();

    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new HttpException(
        invalidAgentKeyError(MISSING_KEY_MESSAGE),
        HttpStatus.UNAUTHORIZED,
      );
    }

    const agentKey = await this.agentKeysService.validateKey(token);
    if (!agentKey) {
      throw new HttpException(
        invalidAgentKeyError(INVALID_KEY_MESSAGE),
        HttpStatus.UNAUTHORIZED,
      );
    }

    request.agentKey = agentKey;
    request.auth = {
      token,
      clientId: agentKey.id,
      scopes: [],
    };
    return true;
  }
}
