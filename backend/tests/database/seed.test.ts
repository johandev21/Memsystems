import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { Client, Pool } from 'pg';
import { expect, it } from 'vitest';
import { prepareSeedState } from '../../src/database/seed-state';

const run = promisify(execFile);

it('initializes once, retries failures, and preserves existing databases', async () => {
  const baseUrl = new URL(process.env.DATABASE_URL!);
  const databaseName = `seed_test_${process.pid}`;
  const legacyName = `${databaseName}_legacy`;
  const adminUrl = new URL(baseUrl);
  adminUrl.pathname = '/postgres';
  const admin = new Client({ connectionString: adminUrl.toString() });
  const tempDir = await mkdtemp(path.join(tmpdir(), 'memsystems-seed-'));
  await admin.connect();
  const createDb = async (name: string) => {
    await admin.query(`CREATE DATABASE "${name}"`);
    const url = new URL(baseUrl);
    url.pathname = `/${name}`;
    return url.toString();
  };
  try {
    const url = await createDb(databaseName);
    const env = {
      ...process.env,
      DATABASE_URL: url,
      DEV_STORAGE_DIR: path.join(tempDir, 'storage'),
      S3_ENDPOINT: '',
    };
    const command = (script: string, overrides = {}) =>
      run('pnpm', ['exec', 'ts-node', `src/database/${script}.ts`], {
        cwd: process.cwd(),
        env: { ...env, ...overrides },
        timeout: 60000,
      });
    await command('migrate');
    const db = new Client({ connectionString: url });
    await db.connect();
    try {
      await writeFile(path.join(tempDir, 'blocked'), 'file');
      await expect(
        command('seed', { DEV_STORAGE_DIR: path.join(tempDir, 'blocked') }),
      ).rejects.toThrow();
      expect(
        (await db.query('SELECT count(*)::int AS count FROM notebook_folders'))
          .rows[0].count,
      ).toBe(0);
      expect(
        (await db.query('SELECT count(*)::int AS count FROM seed_state'))
          .rows[0].count,
      ).toBe(0);
      await Promise.all([command('seed'), command('seed')]);
      expect(
        (await db.query('SELECT count(*)::int AS count FROM seed_state'))
          .rows[0].count,
      ).toBe(1);
      expect(
        (await db.query('SELECT count(*)::int AS count FROM notebook_folders'))
          .rows[0].count,
      ).toBe(4);
      await db.query(
        "UPDATE notebook_folders SET name = 'Renamed' WHERE name = 'Classical Philosophy'",
      );
      await command('migrate');
      await command('seed');
      expect(
        (
          await db.query(
            "SELECT count(*)::int AS count FROM notebook_folders WHERE name = 'Classical Philosophy'",
          )
        ).rows[0].count,
      ).toBe(0);
      expect(
        (await db.query('SELECT count(*)::int AS count FROM notebook_folders'))
          .rows[0].count,
      ).toBe(4);
    } finally {
      await db.end();
    }

    const legacyUrl = await createDb(legacyName);
    const legacy = new Pool({ connectionString: legacyUrl });
    const client = await legacy.connect();
    try {
      await client.query('CREATE TABLE notebooks (id text)');
      await prepareSeedState(client);
      expect(
        (await client.query('SELECT count(*)::int AS count FROM seed_state'))
          .rows[0].count,
      ).toBe(1);
    } finally {
      client.release();
      await legacy.end();
    }
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await admin.query(`DROP DATABASE IF EXISTS "${legacyName}" WITH (FORCE)`);
    await admin.end();
    await rm(tempDir, { recursive: true, force: true });
  }
}, 120000);
