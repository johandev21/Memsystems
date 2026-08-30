import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

config();
config({ path: '.env.local' });

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

  await migrate(db, { migrationsFolder: 'drizzle' });
  await pool.end();
  console.log('Database migrations applied.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
