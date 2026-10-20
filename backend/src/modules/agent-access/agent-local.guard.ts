import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { AgentErrorBody } from './agent-request.types';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

const HOST_REJECTED_MESSAGE =
  'The MCP endpoint only accepts local requests. Set AGENT_ALLOWED_HOSTS (comma-separated) to allow another host.';
const ORIGIN_REJECTED_MESSAGE =
  'The Origin is not allowed to reach the MCP endpoint. Set AGENT_ALLOWED_HOSTS (comma-separated) to allow another origin.';

function rejectedError(message: string): AgentErrorBody {
  return {
    statusCode: HttpStatus.FORBIDDEN,
    message,
    code: 'agent_origin_rejected',
  };
}

export function parseAllowedHosts(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

/**
 * Extracts a bare hostname from a Host header or an Origin hostname.
 * Handles `localhost:4000`, `127.0.0.1:4000`, `[::1]:4000`, and `[::1]`.
 */
export function parseHostname(value: string): string | null {
  const raw = value.trim().toLowerCase();
  if (!raw) {
    return null;
  }
  if (raw.startsWith('[')) {
    const end = raw.indexOf(']');
    return end > 1 ? raw.slice(1, end) : null;
  }
  const portSeparator = raw.indexOf(':');
  return portSeparator === -1 ? raw : raw.slice(0, portSeparator);
}

export function isAllowedHostValue(
  value: string,
  allowedHosts: string[],
): boolean {
  const raw = value.trim().toLowerCase();
  const hostname = parseHostname(raw);
  if (!hostname) {
    return false;
  }
  if (LOCAL_HOSTNAMES.has(hostname)) {
    return true;
  }
  return allowedHosts.includes(raw) || allowedHosts.includes(hostname);
}

export function isAllowedOrigin(
  origin: string,
  allowedHosts: string[],
): boolean {
  if (origin === 'null') {
    return false;
  }
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  return (
    isAllowedHostValue(url.host, allowedHosts) ||
    isAllowedHostValue(url.hostname, allowedHosts)
  );
}

/**
 * Rejects non-local callers of the MCP endpoint. Browser-originated requests
 * must come from a local Origin (or one listed in `AGENT_ALLOWED_HOSTS`);
 * native MCP clients typically send no Origin at all.
 */
@Injectable()
export class AgentLocalGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const allowedHosts = parseAllowedHosts(
      this.configService.get<string>('AGENT_ALLOWED_HOSTS'),
    );

    const host = request.headers.host;
    if (!host || !isAllowedHostValue(host, allowedHosts)) {
      throw new HttpException(
        rejectedError(HOST_REJECTED_MESSAGE),
        HttpStatus.FORBIDDEN,
      );
    }

    const origin = request.headers.origin;
    if (origin && !isAllowedOrigin(origin, allowedHosts)) {
      throw new HttpException(
        rejectedError(ORIGIN_REJECTED_MESSAGE),
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
