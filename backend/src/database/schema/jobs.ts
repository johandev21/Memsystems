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
import { jobStatusEnum } from './enums';

export const jobs = pgTable(
  'jobs',
  {
    id: varchar('id')
      .$defaultFn(() => createId())
      .primaryKey(),
    type: varchar('type', { length: 100 }).notNull(),
    groupKey: varchar('group_key', { length: 255 }),
    payload: jsonb('payload').notNull().default({}),
    status: jobStatusEnum('status').notNull().default('pending'),
    result: jsonb('result'),
    lastError: text('last_error'),
    attemptCount: integer('attempt_count').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    backoffBaseMs: integer('backoff_base_ms').notNull().default(5000),
    nextAttemptAt: timestamp('next_attempt_at'),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('jobs_status_next_attempt_at_idx').on(
      table.status,
      table.nextAttemptAt,
    ),
    index('jobs_group_key_idx').on(table.groupKey),
    index('jobs_type_idx').on(table.type),
  ],
);
