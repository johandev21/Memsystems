import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { describe, expect, it } from 'vitest';

const journal = JSON.parse(
  readFileSync('drizzle/meta/_journal.json', 'utf8'),
) as {
  entries: Array<{ idx: number; when: number; tag: string }>;
};
const migrations = journal.entries.filter((entry) => entry.idx >= 28);

describe('merged audio migration history', () => {
  it.each(['main', 'audio', 'fresh'] as const)(
    'preserves data when upgrading from %s',
    async (history) => {
      const url = new URL(process.env.DATABASE_URL!);
      expect(url.port).toBe('5499');
      expect(url.pathname).toBe('/memsystems_test');
      const client = new Client({ connectionString: url.toString() });
      await client.connect();
      try {
        await client.query('BEGIN');
        await client.query('CREATE SCHEMA audio_merge_check');
        await client.query(
          'SET LOCAL search_path TO audio_merge_check, public',
        );
        await client.query(`
          CREATE TYPE study_material_kind AS ENUM ('quiz');
          CREATE TABLE study_materials (id varchar PRIMARY KEY);
          CREATE TABLE generation_requests (id varchar PRIMARY KEY);
          CREATE TABLE notebooks (banner text);
          INSERT INTO study_materials VALUES ('saved-material');
          INSERT INTO generation_requests VALUES ('saved-request');
          INSERT INTO notebooks VALUES ('keep-this-banner');
        `);
        if (history === 'audio') {
          for (const migration of migrations.filter(
            (entry) => entry.tag.includes('audio') && entry.idx < 30,
          )) {
            await client.query(
              readFileSync(`drizzle/${migration.tag}.sql`, 'utf8'),
            );
          }
          await client.query(
            `INSERT INTO study_material_audio (study_material_id, audio) VALUES ('saved-material', '\\x010203');`,
          );
          await client.query(
            `UPDATE generation_requests SET generation_options = '{"length":"short"}';`,
          );
        }
        const lastApplied =
          history === 'main'
            ? migrations.find(
                (entry) => entry.tag === '0029_filtered_hnsw_iterative_scans',
              )!.when
            : history === 'audio'
              ? migrations.find(
                  (entry) =>
                    entry.tag === '0029_audio_overview_generation_options',
                )!.when
              : 0;
        for (const migration of migrations.filter(
          (entry) => entry.when > lastApplied,
        )) {
          const sql = readFileSync(`drizzle/${migration.tag}.sql`, 'utf8');
          for (const statement of sql.split('--> statement-breakpoint'))
            await client.query(statement);
        }
        // Reconciliation must also be safe on a database that already has audio.
        await client.query(
          readFileSync(
            'drizzle/0032_reconcile_audio_overview_history.sql',
            'utf8',
          ),
        );
        const result = await client.query(
          `SELECT id, generation_options FROM generation_requests`,
        );
        expect(result.rows).toEqual([
          {
            id: 'saved-request',
            generation_options:
              history === 'audio' ? { length: 'short' } : null,
          },
        ]);
        expect(
          (await client.query('SELECT banner FROM notebooks')).rows,
        ).toEqual([{ banner: 'keep-this-banner' }]);
        expect(
          (
            await client.query(
              `SELECT enumlabel FROM pg_enum WHERE enumtypid = 'study_material_kind'::regtype ORDER BY enumsortorder`,
            )
          ).rows,
        ).toEqual([{ enumlabel: 'quiz' }, { enumlabel: 'audio_overview' }]);
        if (history === 'audio')
          expect(
            (await client.query('SELECT audio FROM study_material_audio'))
              .rows[0].audio,
          ).toEqual(Buffer.from([1, 2, 3]));
      } finally {
        await client.query('ROLLBACK');
        await client.end();
      }
    },
  );
});
