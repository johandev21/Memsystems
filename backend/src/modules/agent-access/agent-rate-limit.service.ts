import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type AgentRateLimitScope = 'mcp' | 'chat' | 'generate';

/** Sliding-window length. Limits are expressed per minute. */
export const AGENT_RATE_LIMIT_WINDOW_MS = 60_000;

export const DEFAULT_AGENT_RATE_LIMITS: Record<AgentRateLimitScope, number> = {
  mcp: 120,
  chat: 60,
  generate: 20,
};

const ENV_LIMIT_KEYS: Record<AgentRateLimitScope, string> = {
  mcp: 'AGENT_MCP_RATE_LIMIT',
  chat: 'AGENT_CHAT_RATE_LIMIT',
  generate: 'AGENT_GENERATE_RATE_LIMIT',
};

export interface AgentRateLimitResult {
  allowed: boolean;
  /** Seconds until the oldest request leaves the window. Zero when allowed. */
  retryAfterSeconds: number;
  limit: number;
  remaining: number;
}

function parseLimit(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

/**
 * In-memory sliding-window limiter for Agent traffic.
 *
 * MCP requests are keyed by Agent Key; chat and generation requests are keyed
 * by client IP. The state is intentionally process-local: Memsystems runs as a
 * single-user, single-process backend.
 */
@Injectable()
export class AgentRateLimitService {
  private readonly windows = new Map<string, number[]>();
  private readonly limits: Record<AgentRateLimitScope, number>;

  constructor(private readonly configService: ConfigService) {
    this.limits = {
      mcp: parseLimit(
        this.configService.get<string>(ENV_LIMIT_KEYS.mcp),
        DEFAULT_AGENT_RATE_LIMITS.mcp,
      ),
      chat: parseLimit(
        this.configService.get<string>(ENV_LIMIT_KEYS.chat),
        DEFAULT_AGENT_RATE_LIMITS.chat,
      ),
      generate: parseLimit(
        this.configService.get<string>(ENV_LIMIT_KEYS.generate),
        DEFAULT_AGENT_RATE_LIMITS.generate,
      ),
    };
  }

  limitFor(scope: AgentRateLimitScope): number {
    return this.limits[scope];
  }

  consume(
    scope: AgentRateLimitScope,
    key: string,
    now: number = Date.now(),
  ): AgentRateLimitResult {
    const limit = this.limitFor(scope);
    const bucketKey = `${scope}:${key}`;
    const windowStart = now - AGENT_RATE_LIMIT_WINDOW_MS;

    const timestamps = (this.windows.get(bucketKey) ?? []).filter(
      (timestamp) => timestamp > windowStart,
    );

    if (timestamps.length >= limit) {
      this.windows.set(bucketKey, timestamps);
      const oldest = timestamps[0] ?? now;
      const retryAfterMs = Math.max(
        0,
        oldest + AGENT_RATE_LIMIT_WINDOW_MS - now,
      );
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
        limit,
        remaining: 0,
      };
    }

    timestamps.push(now);
    this.windows.set(bucketKey, timestamps);
    return {
      allowed: true,
      retryAfterSeconds: 0,
      limit,
      remaining: limit - timestamps.length,
    };
  }

  /** Clears all windows. Intended for tests and key revocation cleanup. */
  reset(): void {
    this.windows.clear();
  }
}
