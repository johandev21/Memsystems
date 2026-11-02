import type { PoolClient } from 'pg';

const SEED_LOCK = 173829104;

export async function prepareSeedState(client: PoolClient): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_advisory_xact_lock($1)', [SEED_LOCK]);
    const { rows } = await client.query<{
      state_exists: boolean;
      legacy: boolean;
    }>(
      `SELECT to_regclass('public.seed_state') IS NOT NULL AS state_exists,
              to_regclass('public.notebooks') IS NOT NULL AS legacy`,
    );
    if (!rows[0].state_exists) {
      await client.query(
        'CREATE TABLE public.seed_state (id text PRIMARY KEY, completed_at timestamptz NOT NULL DEFAULT now())',
      );
      if (rows[0].legacy) {
        await client.query(
          "INSERT INTO public.seed_state (id) VALUES ('initial')",
        );
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

export async function lockInitialSeed(client: PoolClient): Promise<boolean> {
  await client.query('SELECT pg_advisory_xact_lock($1)', [SEED_LOCK]);
  const result = await client.query(
    "SELECT 1 FROM public.seed_state WHERE id = 'initial'",
  );
  return result.rowCount === 0;
}
