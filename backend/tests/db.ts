import { sql } from 'drizzle-orm';
import { Client } from 'pg';
import { createDatabaseConnection } from '../src/database/connection';

const { db } = createDatabaseConnection(process.env.DATABASE_URL);

export { db };

const TABLES = [
  'retrieval_traces',
  'notebook_chat_messages',
  'generation_requests',
  'source_segments',
  'source_versions',
  'source_upload_intents',
  'source_chunks',
  'source_index_jobs',
  'web_search_jobs',
  'jobs',
  'study_materials',
  'study_material_folders',
  'sources',
  'notebooks',
  'notebook_folders',
  // Renamed to app_settings by migration 0007 (user_settings was dropped).
  'app_settings',
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
      'ALTER TABLE IF EXISTS "notebooks" DROP CONSTRAINT IF EXISTS "notebooks_user_id_user_id_fk"',
    );
    await pgClient.query(
      'ALTER TABLE IF EXISTS "user_settings" DROP CONSTRAINT IF EXISTS "user_settings_user_id_user_id_fk"',
    );
    await pgClient.query(
      'ALTER TABLE IF EXISTS "web_search_jobs" DROP CONSTRAINT IF EXISTS "web_search_jobs_user_id_user_id_fk"',
    );
    await pgClient.query('DROP TABLE IF EXISTS "verification" CASCADE');
    await pgClient.query('DROP TABLE IF EXISTS "account" CASCADE');
    await pgClient.query('DROP TABLE IF EXISTS "session" CASCADE');
    await pgClient.query('DROP TABLE IF EXISTS "user" CASCADE');
    await pgClient.query(
      'ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "gateway_api_key" text',
    );
    await pgClient.query(
      'ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "deepseek_api_key" text',
    );
    await pgClient.query(
      'ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "anthropic_api_key" text',
    );
    await pgClient.query(
      'ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "gemini_api_key" text',
    );
    await pgClient.query(
      'ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "kimi_api_key" text',
    );
    await pgClient.query(`DO $$ BEGIN
      CREATE TYPE "web_search_job_status" AS ENUM('pending', 'processing', 'ready', 'failed');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`);
    await pgClient.query(`CREATE TABLE IF NOT EXISTS "web_search_jobs" (
      "id" varchar PRIMARY KEY,
      "notebook_id" varchar NOT NULL,
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
      CONSTRAINT "web_search_jobs_notebook_id_notebooks_id_fk" FOREIGN KEY ("notebook_id") REFERENCES "notebooks"("id") ON DELETE CASCADE
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

    await pgClient.query(`DO $$ BEGIN
      CREATE TYPE "source_upload_intent_status" AS ENUM('pending', 'uploaded', 'consuming', 'consumed', 'expired');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`);
    await pgClient.query(`CREATE TABLE IF NOT EXISTS "source_upload_intents" (
      "id" varchar PRIMARY KEY,
      "notebook_id" varchar NOT NULL,
      "storage_key" varchar(1000) NOT NULL,
      "filename" varchar(500) NOT NULL,
      "content_type" varchar(200) NOT NULL,
      "expected_bytes" integer NOT NULL,
      "expected_sha256" varchar(64),
      "uploaded_bytes" integer,
      "uploaded_sha256" varchar(64),
      "status" "source_upload_intent_status" DEFAULT 'pending' NOT NULL,
      "expires_at" timestamp NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "consumed_at" timestamp,
      CONSTRAINT "source_upload_intents_notebook_id_notebooks_id_fk" FOREIGN KEY ("notebook_id") REFERENCES "notebooks"("id") ON DELETE CASCADE
    )`);
    await pgClient.query(
      'CREATE INDEX IF NOT EXISTS "source_upload_intents_notebook_id_idx" ON "source_upload_intents" ("notebook_id")',
    );
    await pgClient.query(
      'CREATE INDEX IF NOT EXISTS "source_upload_intents_status_expires_at_idx" ON "source_upload_intents" ("status", "expires_at")',
    );
  } finally {
    await pgClient.end();
  }
}
