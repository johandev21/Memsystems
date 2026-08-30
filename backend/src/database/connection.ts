import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as appSchema from './schema';

export const fullSchema = { ...appSchema };
export type AppDatabase = NodePgDatabase<typeof appSchema>;

export function createDatabaseConnection(connectionString?: string) {
  const pool = new Pool({
    connectionString: connectionString || process.env.DATABASE_URL,
    onConnect: (client) => {
      void client.query("SET timezone = 'UTC'");
    },
  });

  const db = drizzle(pool, { schema: fullSchema });
  return { db, pool };
}
