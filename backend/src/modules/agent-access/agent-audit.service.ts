import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { and, count, desc, eq, lt, type SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { agentAuditLogs, type AgentAuditStatus } from '../../database/schema';
import { DRIZZLE } from '../database/database.module';

export const AGENT_AUDIT_RETENTION_DAYS = 30;
const PRUNE_INTERVAL_MS = 60 * 60 * 1000;

const REDACTED_ARG_KEYS = new Set([
  'text',
  'content',
  'rawText',
  'contentBase64',
  'transcript',
]);

export interface RecordAgentToolCallInput {
  agentKeyId?: string | null;
  toolName: string;
  args?: Record<string, unknown> | null;
  status: AgentAuditStatus;
  errorMessage?: string | null;
  durationMs?: number | null;
  notebookId?: string | null;
}

export interface AgentAuditEntry {
  id: string;
  agentKeyId: string | null;
  toolName: string;
  args: Record<string, unknown>;
  status: AgentAuditStatus;
  errorMessage: string | null;
  durationMs: number | null;
  notebookId: string | null;
  createdAt: Date;
}

export interface ListAgentAuditInput {
  keyId?: string;
  status?: AgentAuditStatus;
  limit?: number;
  offset?: number;
}

export interface AgentAuditPage {
  entries: AgentAuditEntry[];
  total: number;
}

function serializedLength(value: unknown): number {
  if (typeof value === 'string') {
    return value.length;
  }
  try {
    const serialized = JSON.stringify(value);
    return typeof serialized === 'string' ? serialized.length : 0;
  } catch {
    return 0;
  }
}

function redactValue(
  value: unknown,
  key: string | undefined,
  seen: WeakSet<object>,
): unknown {
  if (
    key !== undefined &&
    REDACTED_ARG_KEYS.has(key) &&
    value !== undefined &&
    value !== null
  ) {
    return `[redacted ${serializedLength(value)} chars]`;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry, undefined, seen));
  }

  if (value !== null && typeof value === 'object') {
    if (seen.has(value)) {
      return '[circular]';
    }
    seen.add(value);
    const redacted: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      redacted[entryKey] = redactValue(entryValue, entryKey, seen);
    }
    return redacted;
  }

  return value;
}

/**
 * Removes bulky or sensitive tool payloads before they reach the audit table.
 * Only the key names are inspected, so nested objects and arrays are covered.
 */
export function redactAgentAuditArgs(
  args: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!args || typeof args !== 'object') {
    return {};
  }
  return redactValue(args, undefined, new WeakSet()) as Record<string, unknown>;
}

const entrySelection = {
  id: agentAuditLogs.id,
  agentKeyId: agentAuditLogs.agentKeyId,
  toolName: agentAuditLogs.toolName,
  args: agentAuditLogs.args,
  status: agentAuditLogs.status,
  errorMessage: agentAuditLogs.errorMessage,
  durationMs: agentAuditLogs.durationMs,
  notebookId: agentAuditLogs.notebookId,
  createdAt: agentAuditLogs.createdAt,
};

/**
 * Persists MCP tool activity. `recordToolCall` is the entry point for the MCP
 * tool wrapper (#123); `record` remains available for direct callers.
 */
@Injectable()
export class AgentAuditService {
  private readonly logger = new Logger(AgentAuditService.name);
  private lastPruneStartedAt = 0;

  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
  ) {}

  async record(input: RecordAgentToolCallInput): Promise<AgentAuditEntry> {
    const [entry] = await this.db
      .insert(agentAuditLogs)
      .values({
        agentKeyId: input.agentKeyId ?? null,
        toolName: input.toolName.slice(0, 100),
        args: redactAgentAuditArgs(input.args),
        status: input.status,
        errorMessage: input.errorMessage ?? null,
        durationMs: input.durationMs ?? null,
        notebookId: input.notebookId ?? null,
      })
      .returning(entrySelection);

    this.maybePrune();
    return entry;
  }

  recordToolCall(input: RecordAgentToolCallInput): Promise<AgentAuditEntry> {
    return this.record(input);
  }

  async list(input: ListAgentAuditInput = {}): Promise<AgentAuditPage> {
    const limit = Math.min(200, Math.max(1, input.limit ?? 50));
    const offset = Math.max(0, input.offset ?? 0);

    const conditions: SQL[] = [];
    if (input.keyId) {
      conditions.push(eq(agentAuditLogs.agentKeyId, input.keyId));
    }
    if (input.status) {
      conditions.push(eq(agentAuditLogs.status, input.status));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [entries, totals] = await Promise.all([
      this.db
        .select(entrySelection)
        .from(agentAuditLogs)
        .where(where)
        .orderBy(desc(agentAuditLogs.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: count() }).from(agentAuditLogs).where(where),
    ]);

    return {
      entries,
      total: Number(totals[0]?.total ?? 0),
    };
  }

  async clear(): Promise<void> {
    await this.db.delete(agentAuditLogs);
  }

  async pruneOlderThan(
    days: number = AGENT_AUDIT_RETENTION_DAYS,
  ): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const deleted = await this.db
      .delete(agentAuditLogs)
      .where(lt(agentAuditLogs.createdAt, cutoff))
      .returning({ id: agentAuditLogs.id });
    return deleted.length;
  }

  @Cron('0 4 * * *')
  async pruneRetention(): Promise<void> {
    try {
      await this.pruneOlderThan();
    } catch (error) {
      this.logger.warn(
        `Agent audit retention prune failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private maybePrune(): void {
    const now = Date.now();
    if (now - this.lastPruneStartedAt < PRUNE_INTERVAL_MS) {
      return;
    }
    this.lastPruneStartedAt = now;
    void this.pruneOlderThan().catch((error: unknown) => {
      this.logger.warn(
        `Agent audit retention prune failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  }
}
