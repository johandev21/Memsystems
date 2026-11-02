import { createId } from '@paralleldrive/cuid2';
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  agentAccessLevelEnum,
  agentConfirmPolicyEnum,
  agentSoftDeletePolicyEnum,
} from './enums';

export const agentKeys = pgTable(
  'agent_keys',
  {
    id: varchar('id')
      .$defaultFn(() => createId())
      .primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    keyHash: varchar('key_hash', { length: 64 }).notNull().unique(),
    keyPrefix: varchar('key_prefix', { length: 16 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    lastUsedAt: timestamp('last_used_at'),
    revokedAt: timestamp('revoked_at'),
  },
  (table) => [
    index('agent_keys_revoked_at_idx').on(table.revokedAt),
    index('agent_keys_last_used_at_idx').on(table.lastUsedAt),
  ],
);

export type AgentAuditStatus =
  'success' | 'error' | 'denied' | 'pending_approval';

export const agentAuditLogs = pgTable(
  'agent_audit_logs',
  {
    id: varchar('id')
      .$defaultFn(() => createId())
      .primaryKey(),
    agentKeyId: varchar('agent_key_id').references(() => agentKeys.id, {
      onDelete: 'set null',
    }),
    toolName: varchar('tool_name', { length: 100 }).notNull(),
    args: jsonb('args').$type<Record<string, unknown>>().notNull().default({}),
    status: varchar('status', { length: 20 })
      .$type<AgentAuditStatus>()
      .notNull(),
    errorMessage: text('error_message'),
    durationMs: integer('duration_ms'),
    notebookId: varchar('notebook_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('agent_audit_logs_created_at_idx').on(table.createdAt),
    index('agent_audit_logs_agent_key_id_idx').on(table.agentKeyId),
  ],
);

export type AgentPendingActionStatus =
  'pending' | 'approved' | 'rejected' | 'expired' | 'failed';

export type AgentActionTargetType =
  'notebook' | 'source' | 'study_material' | 'folder' | 'trash';

export const agentPendingActions = pgTable(
  'agent_pending_actions',
  {
    id: varchar('id')
      .$defaultFn(() => createId())
      .primaryKey(),
    agentKeyId: varchar('agent_key_id').references(() => agentKeys.id, {
      onDelete: 'set null',
    }),
    toolName: varchar('tool_name', { length: 100 }).notNull(),
    notebookId: varchar('notebook_id'),
    targetType: varchar('target_type', { length: 40 })
      .$type<AgentActionTargetType>()
      .notNull(),
    targetIds: jsonb('target_ids').$type<string[]>().notNull().default([]),
    summary: text('summary').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown> | null>(),
    status: varchar('status', { length: 20 })
      .$type<AgentPendingActionStatus>()
      .default('pending')
      .notNull(),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    resolvedAt: timestamp('resolved_at'),
  },
  (table) => [
    index('agent_pending_actions_status_idx').on(table.status),
    index('agent_pending_actions_expires_at_idx').on(table.expiresAt),
  ],
);

export const appSettings = pgTable('app_settings', {
  id: text('id').primaryKey().default('global'),
  indexingRepresentation: varchar('indexing_representation', { length: 200 }),
  agentSoftDeletePolicy: agentSoftDeletePolicyEnum('agent_soft_delete_policy')
    .default('ask')
    .notNull(),
  agentPermanentDeletePolicy: agentConfirmPolicyEnum(
    'agent_permanent_delete_policy',
  )
    .default('never')
    .notNull(),
  agentResourceDeletePolicy: agentConfirmPolicyEnum(
    'agent_resource_delete_policy',
  )
    .default('never')
    .notNull(),
  agentNotebookAccessDefault: agentAccessLevelEnum(
    'agent_notebook_access_default',
  )
    .default('on')
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
