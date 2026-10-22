import fs from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import type { NodePgTransaction } from 'drizzle-orm/node-postgres';
import { describe, expect, it } from 'vitest';
import { db } from '../db';

class RollbackFixture<T> extends Error {
  constructor(readonly value: T) {
    super('Rollback migration fixture');
  }
}

async function runRolledBackFixture<T>(
  schemaName: string,
  run: (tx: NodePgTransaction<any, any>) => Promise<T>,
): Promise<T> {
  await db.execute(sql.raw(`CREATE SCHEMA "${schemaName}"`));
  try {
    try {
      await db.transaction(async (tx) => {
        await tx.execute(
          sql.raw(`SET LOCAL search_path TO "${schemaName}", public`),
        );
        throw new RollbackFixture(await run(tx));
      });
    } catch (error) {
      if (error instanceof RollbackFixture) return error.value;
      throw error;
    }
    throw new Error('Migration fixture transaction unexpectedly committed');
  } finally {
    await db.execute(sql.raw(`DROP SCHEMA "${schemaName}" CASCADE`));
  }
}

const migrationSql = (filename: string) =>
  fs.readFileSync(path.resolve(process.cwd(), `drizzle/${filename}`), 'utf8');

describe('chat branch migrations', () => {
  it('backfills the chronological legacy transcript in 0023 without changing message data', async () => {
    const migration = migrationSql('0024_chat_branches.sql');
    const result = await runRolledBackFixture('chat_0023_legacy_fixture', async (tx) => {
      await tx.execute(sql.raw(`
        CREATE TABLE notebooks (id varchar PRIMARY KEY, title varchar NOT NULL);
        CREATE TABLE notebook_chat_messages (
          id varchar PRIMARY KEY,
          notebook_id varchar NOT NULL REFERENCES notebooks(id),
          role varchar NOT NULL,
          content text NOT NULL,
          metadata jsonb,
          cited_source_ids jsonb,
          created_at timestamp NOT NULL
        );
        INSERT INTO notebooks VALUES ('legacy-notebook', 'Legacy');
        INSERT INTO notebook_chat_messages VALUES
          ('legacy-u1', 'legacy-notebook', 'user', 'legacy content 0', '{"marker":"legacy-u1"}', '[{"sourceId":"source","citationKey":"R1"}]', '2026-01-01T00:00:00Z'),
          ('legacy-a1', 'legacy-notebook', 'assistant', 'legacy content 1', '{"marker":"legacy-a1"}', '[{"sourceId":"source","citationKey":"R2"}]', '2026-01-01T00:00:01Z'),
          ('legacy-a1-retry', 'legacy-notebook', 'assistant', 'legacy content 2', '{"marker":"legacy-a1-retry"}', '[{"sourceId":"source","citationKey":"R3"}]', '2026-01-01T00:00:02Z'),
          ('legacy-u2', 'legacy-notebook', 'user', 'legacy content 3', '{"marker":"legacy-u2"}', '[{"sourceId":"source","citationKey":"R4"}]', '2026-01-01T00:00:03Z'),
          ('legacy-a2', 'legacy-notebook', 'assistant', 'legacy content 4', '{"marker":"legacy-a2"}', '[{"sourceId":"source","citationKey":"R5"}]', '2026-01-01T00:00:04Z');
      `));
      await tx.execute(sql.raw(migration));
      const rows = await tx.execute(sql.raw(`
        SELECT id, parent_id, content, metadata, cited_source_ids
        FROM notebook_chat_messages ORDER BY created_at, id
      `));
      const notebook = await tx.execute(sql.raw(
        `SELECT selected_chat_message_id FROM notebooks WHERE id = 'legacy-notebook'`,
      ));
      return { rows: rows.rows, notebook: notebook.rows[0] };
    });

    expect(result.rows.map(({ id, parent_id }: any) => ({ id, parent_id }))).toEqual([
      { id: 'legacy-u1', parent_id: null },
      { id: 'legacy-a1', parent_id: 'legacy-u1' },
      { id: 'legacy-a1-retry', parent_id: 'legacy-u1' },
      { id: 'legacy-u2', parent_id: 'legacy-a1-retry' },
      { id: 'legacy-a2', parent_id: 'legacy-u2' },
    ]);
    expect(result.rows.map(({ id, content, metadata, cited_source_ids }: any) => ({
      id, content, metadata, cited_source_ids,
    }))).toEqual([
      { id: 'legacy-u1', content: 'legacy content 0', metadata: { marker: 'legacy-u1' }, cited_source_ids: [{ sourceId: 'source', citationKey: 'R1' }] },
      { id: 'legacy-a1', content: 'legacy content 1', metadata: { marker: 'legacy-a1' }, cited_source_ids: [{ sourceId: 'source', citationKey: 'R2' }] },
      { id: 'legacy-a1-retry', content: 'legacy content 2', metadata: { marker: 'legacy-a1-retry' }, cited_source_ids: [{ sourceId: 'source', citationKey: 'R3' }] },
      { id: 'legacy-u2', content: 'legacy content 3', metadata: { marker: 'legacy-u2' }, cited_source_ids: [{ sourceId: 'source', citationKey: 'R4' }] },
      { id: 'legacy-a2', content: 'legacy content 4', metadata: { marker: 'legacy-a2' }, cited_source_ids: [{ sourceId: 'source', citationKey: 'R5' }] },
    ]);
    expect(result.notebook.selected_chat_message_id).toBe('legacy-a2');
  });

  it('preserves roots, nested siblings, and the selected endpoint when 0024 sees existing links', async () => {
    const migration = migrationSql('0025_repair_chat_branches.sql');
    const messages = [
      { id: 'root-a', role: 'user', parentId: null },
      { id: 'root-b', role: 'user', parentId: null },
      { id: 'answer-a1', role: 'assistant', parentId: 'root-a' },
      { id: 'answer-a2', role: 'assistant', parentId: 'root-a' },
      { id: 'nested-sibling-a', role: 'user', parentId: 'answer-a1' },
      { id: 'nested-sibling-b', role: 'user', parentId: 'answer-a1' },
      { id: 'selected-answer', role: 'assistant', parentId: 'nested-sibling-b' },
    ];
    const result = await runRolledBackFixture('chat_0024_branched_fixture', async (tx) => {
      await tx.execute(sql.raw(`
        CREATE TABLE notebooks (
          id varchar PRIMARY KEY,
          title varchar NOT NULL,
          selected_chat_message_id varchar
        );
        CREATE TABLE notebook_chat_messages (
          id varchar PRIMARY KEY,
          notebook_id varchar NOT NULL REFERENCES notebooks(id),
          role varchar NOT NULL,
          content text NOT NULL,
          created_at timestamp NOT NULL,
          parent_id varchar
        );
        INSERT INTO notebooks VALUES ('branched-notebook', 'Branched', 'nested-sibling-b');
        INSERT INTO notebook_chat_messages VALUES
          ('root-a', 'branched-notebook', 'user', 'marker root-a', '2026-01-01T00:00:00Z', NULL),
          ('root-b', 'branched-notebook', 'user', 'marker root-b', '2026-01-01T00:00:01Z', NULL),
          ('answer-a1', 'branched-notebook', 'assistant', 'marker answer-a1', '2026-01-01T00:00:02Z', 'root-a'),
          ('answer-a2', 'branched-notebook', 'assistant', 'marker answer-a2', '2026-01-01T00:00:03Z', 'root-a'),
          ('nested-sibling-a', 'branched-notebook', 'user', 'marker nested-sibling-a', '2026-01-01T00:00:04Z', 'answer-a1'),
          ('nested-sibling-b', 'branched-notebook', 'user', 'marker nested-sibling-b', '2026-01-01T00:00:05Z', 'answer-a1'),
          ('selected-answer', 'branched-notebook', 'assistant', 'marker selected-answer', '2026-01-01T00:00:06Z', 'nested-sibling-b');
      `));
      await tx.execute(sql.raw(migration));
      const rows = await tx.execute(sql.raw(
        `SELECT id, parent_id FROM notebook_chat_messages ORDER BY created_at, id`,
      ));
      const notebook = await tx.execute(sql.raw(
        `SELECT selected_chat_message_id FROM notebooks WHERE id = 'branched-notebook'`,
      ));
      return { rows: rows.rows, notebook: notebook.rows[0] };
    });

    expect(result.rows.map(({ id, parent_id }: any) => ({ id, parentId: parent_id }))).toEqual(
      messages.map(({ id, parentId }) => ({ id, parentId })),
    );
    expect(result.notebook.selected_chat_message_id).toBe('nested-sibling-b');
  });

  it('rebuilds a legacy tree only when 0024 adds a missing parent column', async () => {
    const migration = migrationSql('0025_repair_chat_branches.sql');
    const result = await runRolledBackFixture('chat_0024_legacy_fixture', async (tx) => {
      await tx.execute(sql.raw(`
        CREATE TABLE notebooks (id varchar PRIMARY KEY, title varchar NOT NULL);
        CREATE TABLE notebook_chat_messages (
          id varchar PRIMARY KEY,
          notebook_id varchar NOT NULL REFERENCES notebooks(id),
          role varchar NOT NULL,
          content text NOT NULL,
          created_at timestamp NOT NULL
        );
        INSERT INTO notebooks VALUES ('legacy-notebook', 'Legacy');
        INSERT INTO notebook_chat_messages VALUES
          ('legacy-root', 'legacy-notebook', 'user', 'root', '2026-01-01T00:00:00Z'),
          ('legacy-answer-a', 'legacy-notebook', 'assistant', 'answer a', '2026-01-01T00:00:01Z'),
          ('legacy-answer-b', 'legacy-notebook', 'assistant', 'answer b', '2026-01-01T00:00:02Z'),
          ('legacy-followup', 'legacy-notebook', 'user', 'followup', '2026-01-01T00:00:03Z');
      `));
      await tx.execute(sql.raw(migration));
      const rows = await tx.execute(sql.raw(
        `SELECT id, parent_id FROM notebook_chat_messages ORDER BY created_at, id`,
      ));
      const notebook = await tx.execute(sql.raw(
        `SELECT selected_chat_message_id FROM notebooks WHERE id = 'legacy-notebook'`,
      ));
      return { rows: rows.rows, notebook: notebook.rows[0] };
    });

    expect(result.rows.map(({ id, parent_id }: any) => ({ id, parentId: parent_id }))).toEqual([
      { id: 'legacy-root', parentId: null },
      { id: 'legacy-answer-a', parentId: 'legacy-root' },
      { id: 'legacy-answer-b', parentId: 'legacy-root' },
      { id: 'legacy-followup', parentId: 'legacy-answer-b' },
    ]);
    expect(result.notebook.selected_chat_message_id).toBe('legacy-followup');
  });

  it('initializes durable preferences from the selected path and stable defaults without rewiring the tree', async () => {
    const migration = migrationSql('0026_chat_branch_preferences.sql');
    const stoppedEndpointMigration = migrationSql(
      '0027_chat_branch_stopped_endpoint.sql',
    );
    const result = await runRolledBackFixture('chat_0025_preferences_fixture', async (tx) => {
      await tx.execute(sql.raw(`
        CREATE TABLE notebooks (
          id varchar PRIMARY KEY,
          selected_chat_message_id varchar
        );
        CREATE TABLE notebook_chat_messages (
          id varchar PRIMARY KEY,
          notebook_id varchar NOT NULL REFERENCES notebooks(id),
          parent_id varchar,
          role varchar NOT NULL,
          content text NOT NULL,
          created_at timestamp NOT NULL
        );
        INSERT INTO notebooks VALUES ('preferences-notebook', 'nested-b');
        INSERT INTO notebook_chat_messages VALUES
          ('root-a', 'preferences-notebook', NULL, 'user', 'root A', '2026-01-01T00:00:00Z'),
          ('root-b', 'preferences-notebook', NULL, 'user', 'root B', '2026-01-01T00:00:01Z'),
          ('answer-a1', 'preferences-notebook', 'root-a', 'assistant', 'answer A1', '2026-01-01T00:00:02Z'),
          ('answer-a2', 'preferences-notebook', 'root-a', 'assistant', 'answer A2', '2026-01-01T00:00:03Z'),
          ('nested-a', 'preferences-notebook', 'answer-a1', 'user', 'nested A', '2026-01-01T00:00:04Z'),
          ('nested-b', 'preferences-notebook', 'answer-a1', 'user', 'nested B', '2026-01-01T00:00:05Z'),
          ('selected-answer', 'preferences-notebook', 'nested-b', 'assistant', 'selected answer', '2026-01-01T00:00:06Z');
      `));
      await tx.execute(sql.raw(migration));
      await tx.execute(sql.raw(stoppedEndpointMigration));
      const rows = await tx.execute(sql.raw(`
        SELECT id, parent_id, preferred_child_id, preferred_child_initialized
        FROM notebook_chat_messages ORDER BY created_at, id
      `));
      const notebook = await tx.execute(sql.raw(
        `SELECT selected_chat_message_id FROM notebooks WHERE id = 'preferences-notebook'`,
      ));
      return { rows: rows.rows, notebook: notebook.rows[0] };
    });

    expect(result.rows.map(({ id, parent_id }: any) => ({ id, parentId: parent_id }))).toEqual([
      { id: 'root-a', parentId: null },
      { id: 'root-b', parentId: null },
      { id: 'answer-a1', parentId: 'root-a' },
      { id: 'answer-a2', parentId: 'root-a' },
      { id: 'nested-a', parentId: 'answer-a1' },
      { id: 'nested-b', parentId: 'answer-a1' },
      { id: 'selected-answer', parentId: 'nested-b' },
    ]);
    expect(result.rows.map(({ id, preferred_child_id, preferred_child_initialized }: any) => ({
      id,
      preferredChildId: preferred_child_id,
      initialized: preferred_child_initialized,
    }))).toEqual([
      { id: 'root-a', preferredChildId: 'answer-a1', initialized: true },
      { id: 'root-b', preferredChildId: null, initialized: true },
      { id: 'answer-a1', preferredChildId: 'nested-b', initialized: true },
      { id: 'answer-a2', preferredChildId: null, initialized: true },
      { id: 'nested-a', preferredChildId: null, initialized: true },
      { id: 'nested-b', preferredChildId: null, initialized: true },
      { id: 'selected-answer', preferredChildId: null, initialized: true },
    ]);
    expect(result.notebook.selected_chat_message_id).toBe('nested-b');
  });
});
