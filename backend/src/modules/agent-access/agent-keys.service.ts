import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, lt, or } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { agentKeys } from '../../database/schema';
import { NotFoundError } from '../../common/errors/domain-error';
import { DRIZZLE } from '../database/database.module';
import {
  agentKeyDisplayPrefix,
  generateAgentKey,
  hashAgentKey,
} from './agent-key.crypto';
import type { AgentKeyIdentity } from './agent-request.types';

/** `last_used_at` is refreshed at most once per minute per key. */
const LAST_USED_REFRESH_MS = 60_000;

export interface AgentKeySummary {
  id: string;
  name: string;
  prefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export interface CreatedAgentKey {
  /** Plaintext key. Returned once and never persisted. */
  key: string;
  agentKey: AgentKeySummary;
}

const summarySelection = {
  id: agentKeys.id,
  name: agentKeys.name,
  prefix: agentKeys.keyPrefix,
  createdAt: agentKeys.createdAt,
  lastUsedAt: agentKeys.lastUsedAt,
  revokedAt: agentKeys.revokedAt,
};

@Injectable()
export class AgentKeysService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
  ) {}

  async create(name: string): Promise<CreatedAgentKey> {
    const key = generateAgentKey();
    const [row] = await this.db
      .insert(agentKeys)
      .values({
        name,
        keyHash: hashAgentKey(key),
        keyPrefix: agentKeyDisplayPrefix(key),
      })
      .returning(summarySelection);

    return { key, agentKey: row };
  }

  async list(): Promise<{ keys: AgentKeySummary[] }> {
    const keys = await this.db
      .select(summarySelection)
      .from(agentKeys)
      .orderBy(desc(agentKeys.createdAt));
    return { keys };
  }

  async revoke(id: string): Promise<void> {
    const [existing] = await this.db
      .select({ id: agentKeys.id, revokedAt: agentKeys.revokedAt })
      .from(agentKeys)
      .where(eq(agentKeys.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundError('Agent key');
    }
    if (existing.revokedAt) {
      return;
    }

    await this.db
      .update(agentKeys)
      .set({ revokedAt: new Date() })
      .where(eq(agentKeys.id, id));
  }

  /**
   * Resolves a plaintext Agent Key to its identity. Revoked keys are rejected.
   * The row's `last_used_at` is refreshed opportunistically, at most once per
   * minute, so a busy MCP session does not write on every request.
   */
  async validateKey(key: string): Promise<AgentKeyIdentity | null> {
    const keyHash = hashAgentKey(key);
    const [row] = await this.db
      .select({
        id: agentKeys.id,
        name: agentKeys.name,
        lastUsedAt: agentKeys.lastUsedAt,
      })
      .from(agentKeys)
      .where(and(eq(agentKeys.keyHash, keyHash), isNull(agentKeys.revokedAt)))
      .limit(1);

    if (!row) {
      return null;
    }

    const now = new Date();
    const refreshCutoff = new Date(now.getTime() - LAST_USED_REFRESH_MS);
    if (!row.lastUsedAt || row.lastUsedAt < refreshCutoff) {
      await this.db
        .update(agentKeys)
        .set({ lastUsedAt: now })
        .where(
          and(
            eq(agentKeys.id, row.id),
            or(
              isNull(agentKeys.lastUsedAt),
              lt(agentKeys.lastUsedAt, refreshCutoff),
            ),
          ),
        );
    }

    return { id: row.id, name: row.name };
  }
}
