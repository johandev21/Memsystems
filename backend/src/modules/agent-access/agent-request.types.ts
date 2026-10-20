import type { Request } from 'express';

/** Identity attached to a request after a valid Agent Key is presented. */
export interface AgentKeyIdentity {
  id: string;
  name: string;
}

/**
 * Auth information forwarded to the MCP adapter. `toNodeHandler` reads
 * `req.auth` and exposes it to the server factory as `authInfo`.
 */
export interface AgentAuthInfo {
  token: string;
  clientId: string;
  scopes: string[];
}

export interface AgentAuthenticatedRequest extends Request {
  agentKey?: AgentKeyIdentity;
  auth?: AgentAuthInfo;
}

/**
 * Error body shared by the Agent guards. The domain exception filter forwards
 * this shape verbatim instead of wrapping it as a generic HTTP exception.
 */
export interface AgentErrorBody {
  statusCode: number;
  message: string;
  code: string;
  retryAfter?: number;
}
