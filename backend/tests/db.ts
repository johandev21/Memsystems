import { sql } from 'drizzle-orm';
import { Client } from 'pg';
import { createDatabaseConnection } from '../src/database/connection';

const { db } = createDatabaseConnection(process.env.DATABASE_URL);

export { db };

const TABLES = [
  'notebook_chat_messages',
  'generation_requests',
  'source_chunks',
  'source_index_jobs',
  'web_search_jobs',
  'jobs',
  'study_materials',
  'study_material_folders',
  'sources',
  'notebooks',
  'user_settings',
  'verification',
  'account',
  'session',
  'user',
];

export async function resetDatabase(): Promise<void> {
  const list = TABLES.map((t) => `"${t}"`).join(', ');
  await db.execute(sql.raw(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`));
}

export async function ensureTestDatabase(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set — ensure .env.test exists and is loaded',
    );
  }
  const name = new URL(url).pathname.slice(1);
  if (!name) throw new Error(`Could not extract database name from ${url}`);
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error(`Unsafe test database name: ${name}`);
  }

  const u = new URL(url);
  u.pathname = '/postgres';
  const client = new Client({ connectionString: u.toString() });
  try {
    await client.connect();
    const { rows } = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [name],
    );
    if (rows.length === 0) {
      await client.query(`CREATE DATABASE "${name}"`);
    }
  } finally {
    await client.end();
  }

  const pgClient = new Client({ connectionString: url });
  try {
    await pgClient.connect();
    await pgClient.query('CREATE EXTENSION IF NOT EXISTS vector');
    await pgClient.query(
      'ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "deepseek_api_key" text',
    );
    await pgClient.query(
      'ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "anthropic_api_key" text',
    );
    await pgClient.query(
      'ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "gemini_api_key" text',
    );
    await pgClient.query(
      'ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "kimi_api_key" text',
    );
    await pgClient.query(`DO $$ BEGIN
      CREATE TYPE "web_search_job_status" AS ENUM('pending', 'processing', 'ready', 'failed');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`);
    await pgClient.query(`CREATE TABLE IF NOT EXISTS "web_search_jobs" (
      "id" varchar PRIMARY KEY,
      "notebook_id" varchar NOT NULL,
      "user_id" text NOT NULL,
      "query" varchar(500) NOT NULL,
      "model_id" varchar(200) NOT NULL,
      "status" "web_search_job_status" DEFAULT 'pending' NOT NULL,
      "summary" text,
      "candidates" jsonb DEFAULT '[]'::jsonb NOT NULL,
      "last_error" text,
      "started_at" timestamp,
      "completed_at" timestamp,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "web_search_jobs_notebook_id_notebooks_id_fk" FOREIGN KEY ("notebook_id") REFERENCES "notebooks"("id") ON DELETE CASCADE,
      CONSTRAINT "web_search_jobs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
    )`);
    await pgClient.query(
      'CREATE INDEX IF NOT EXISTS "web_search_jobs_notebook_id_idx" ON "web_search_jobs" ("notebook_id")',
    );
    await pgClient.query(
      'CREATE INDEX IF NOT EXISTS "web_search_jobs_status_idx" ON "web_search_jobs" ("status")',
    );

    await pgClient.query(`DO $$ BEGIN
      CREATE TYPE "job_status" AS ENUM('pending', 'processing', 'ready', 'failed', 'cancelled');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`);
    await pgClient.query(`CREATE TABLE IF NOT EXISTS "jobs" (
      "id" varchar PRIMARY KEY,
      "type" varchar(100) NOT NULL,
      "group_key" varchar(255),
      "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
      "status" "job_status" DEFAULT 'pending' NOT NULL,
      "result" jsonb,
      "last_error" text,
      "attempt_count" integer DEFAULT 0 NOT NULL,
      "max_attempts" integer DEFAULT 3 NOT NULL,
      "backoff_base_ms" integer DEFAULT 5000 NOT NULL,
      "next_attempt_at" timestamp,
      "started_at" timestamp,
      "completed_at" timestamp,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )`);
    await pgClient.query(
      'CREATE INDEX IF NOT EXISTS "jobs_status_next_attempt_at_idx" ON "jobs" ("status", "next_attempt_at")',
    );
    await pgClient.query(
      'CREATE INDEX IF NOT EXISTS "jobs_group_key_idx" ON "jobs" ("group_key")',
    );
    await pgClient.query(
      'CREATE INDEX IF NOT EXISTS "jobs_type_idx" ON "jobs" ("type")',
    );
  } finally {
    await pgClient.end();
  }
}
