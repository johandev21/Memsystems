import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface MigrationJournal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

config();
config({ path: '.env.local' });
config({ path: path.resolve(__dirname, '../../.env.local') });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Cannot run migrations.');
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
  await pool.query(
    'ALTER TABLE IF EXISTS "notebooks" DROP CONSTRAINT IF EXISTS "notebooks_user_id_user_id_fk"',
  );
  await pool.query(
    'ALTER TABLE IF EXISTS "user_settings" DROP CONSTRAINT IF EXISTS "user_settings_user_id_user_id_fk"',
  );
  await pool.query(
    'ALTER TABLE IF EXISTS "web_search_jobs" DROP CONSTRAINT IF EXISTS "web_search_jobs_user_id_user_id_fk"',
  );
  await pool.query('DROP TABLE IF EXISTS "verification" CASCADE');
  await pool.query('DROP TABLE IF EXISTS "account" CASCADE');
  await pool.query('DROP TABLE IF EXISTS "session" CASCADE');
  await pool.query('DROP TABLE IF EXISTS "user" CASCADE');

  const migrationsFolder = fs.existsSync(
    path.resolve(__dirname, '../../drizzle'),
  )
    ? path.resolve(__dirname, '../../drizzle')
    : path.resolve(process.cwd(), 'drizzle');

  // If the database already has the baseline schema (e.g. enum chat_role or table notebooks),
  // ensure drizzle.__drizzle_migrations records the baseline migration so Drizzle does not
  // attempt to re-create existing types and tables from 0000_baseline.sql.
  const schemaExistsResult = await pool.query(
    `SELECT 1 FROM pg_type WHERE typname = 'chat_role'`,
  );

  if (schemaExistsResult.rows.length > 0) {
    const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
    if (fs.existsSync(journalPath)) {
      const journal = JSON.parse(
        fs.readFileSync(journalPath, 'utf8'),
      ) as MigrationJournal;
      const baselineEntry: JournalEntry | undefined = journal.entries?.[0];

      if (baselineEntry) {
        await pool.query('CREATE SCHEMA IF NOT EXISTS drizzle');
        await pool.query(`
          CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
            id SERIAL PRIMARY KEY,
            hash text NOT NULL,
            created_at bigint
          )
        `);

        const migrationCheck = await pool.query(
          `SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at >= $1`,
          [baselineEntry.when],
        );

        if (migrationCheck.rows.length === 0) {
          const baselineSqlPath = path.join(
            migrationsFolder,
            `${baselineEntry.tag}.sql`,
          );
          if (fs.existsSync(baselineSqlPath)) {
            const baselineSql = fs.readFileSync(baselineSqlPath, 'utf8');
            const hash = crypto
              .createHash('sha256')
              .update(baselineSql)
              .digest('hex');

            await pool.query(
              `DELETE FROM drizzle.__drizzle_migrations WHERE created_at < $1`,
              [baselineEntry.when],
            );
            await pool.query(
              `INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at") VALUES ($1, $2)`,
              [hash, baselineEntry.when],
            );
            console.log(
              `Recorded baseline migration (${baselineEntry.tag}) in drizzle.__drizzle_migrations.`,
            );
          }
        }
      }
    }
  }

  await migrate(db, { migrationsFolder });
  await pool.end();
  console.log('Database migrations applied.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
