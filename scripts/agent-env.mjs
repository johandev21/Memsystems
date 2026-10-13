import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, basename, dirname, join } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import net from 'node:net';
import { createRequire } from 'node:module';

// ---------------------------------------------------------------------------
// Helpers: Git & Worktree Inspection
// ---------------------------------------------------------------------------

function runGit(args, cwd = process.cwd()) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (res.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${(res.stderr || res.stdout || '').trim()}`);
  }
  return (res.stdout || '').trim();
}

function getMainRepoRoot(startDir = process.cwd()) {
  try {
    const commonDir = runGit(['rev-parse', '--git-common-dir'], startDir);
    const absCommon = resolve(startDir, commonDir);
    return resolve(absCommon, '..');
  } catch {
    return resolve(startDir);
  }
}

function parseWorktreeList(mainRoot) {
  const output = runGit(['worktree', 'list', '--porcelain'], mainRoot);
  const worktrees = [];
  let current = {};

  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith('worktree ')) {
      if (current.path) worktrees.push(current);
      current = { path: line.slice(9).trim() };
    } else if (line.startsWith('branch ')) {
      current.branch = line.slice(7).trim().replace('refs/heads/', '');
    } else if (line.startsWith('HEAD ')) {
      current.head = line.slice(5).trim();
    } else if (line === 'bare') {
      current.bare = true;
    }
  }
  if (current.path) worktrees.push(current);
  return worktrees;
}

function sanitizeAgentName(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

// ---------------------------------------------------------------------------
// Helpers: Port Allocation & Networking
// ---------------------------------------------------------------------------

function isPortAvailable(port) {
  return new Promise((resolvePromise) => {
    const server = net.createServer();
    server.once('error', () => resolvePromise(false));
    server.once('listening', () => {
      server.close(() => resolvePromise(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

function parseEnvFile(filePath) {
  const map = new Map();
  if (!existsSync(filePath)) return map;
  const content = readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (
      val.length >= 2 &&
      ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
    ) {
      val = val.slice(1, -1);
    }
    map.set(key, val);
  }
  return map;
}

async function findNextAvailableSlot(mainRoot, existingWorktrees) {
  const usedPorts = new Set();

  for (const wt of existingWorktrees) {
    const localEnv = parseEnvFile(join(wt.path, 'backend/.env.local'));
    const dockerEnv = parseEnvFile(join(wt.path, '.env.docker.dev'));

    if (localEnv.get('PORT')) usedPorts.add(Number(localEnv.get('PORT')));
    if (dockerEnv.get('APP_PORT')) usedPorts.add(Number(dockerEnv.get('APP_PORT')));
    if (dockerEnv.get('API_PORT')) usedPorts.add(Number(dockerEnv.get('API_PORT')));
    if (dockerEnv.get('DB_PORT')) usedPorts.add(Number(dockerEnv.get('DB_PORT')));
  }

  for (let offset = 1; offset <= 50; offset++) {
    const appPort = 3000 + offset;
    const apiPort = 4000 + offset;
    const dbPort = 5433 + offset;

    if (usedPorts.has(appPort) || usedPorts.has(apiPort) || usedPorts.has(dbPort)) {
      continue;
    }

    const [appAvail, apiAvail, dbAvail] = await Promise.all([
      isPortAvailable(appPort),
      isPortAvailable(apiPort),
      isPortAvailable(dbPort),
    ]);

    if (appAvail && apiAvail && dbAvail) {
      return offset;
    }
  }

  throw new Error('Could not find an available port slot between 1 and 50.');
}

// ---------------------------------------------------------------------------
// Helpers: Secrets Extraction
// ---------------------------------------------------------------------------

function extractInheritedSecrets(mainRoot) {
  const sources = [
    join(mainRoot, '.env.docker.dev'),
    join(mainRoot, 'backend/.env.local'),
    join(mainRoot, '.env.docker.prod'),
  ];

  const secrets = {
    AI_GATEWAY_API_KEY: '',
    VOYAGE_API_KEY: '',
    FIRECRAWL_API_KEY: '',
    DEV_STORAGE_TOKEN_SECRET: '',
    CREDENTIALS_ENCRYPTION_KEY: '',
    S3_ENDPOINT: '',
    S3_BUCKET: '',
    S3_REGION: '',
    S3_ACCESS_KEY_ID: '',
    S3_SECRET_ACCESS_KEY: '',
  };

  for (const path of sources) {
    const env = parseEnvFile(path);
    for (const key of Object.keys(secrets)) {
      if (!secrets[key] && env.get(key)) {
        secrets[key] = env.get(key);
      }
    }
  }

  // Fallbacks if not found
  if (!secrets.DEV_STORAGE_TOKEN_SECRET) {
    secrets.DEV_STORAGE_TOKEN_SECRET = 'dev-only-storage-token-secret-change-me';
  }
  if (!secrets.CREDENTIALS_ENCRYPTION_KEY) {
    secrets.CREDENTIALS_ENCRYPTION_KEY = 'dev-only-encryption-secret-change-me';
  }

  return secrets;
}

// ---------------------------------------------------------------------------
// Helpers: Database Client & Operations
// ---------------------------------------------------------------------------

function getPgClientClass(repoRoot) {
  try {
    const require = createRequire(join(repoRoot, 'backend/package.json'));
    return require('pg').Client;
  } catch (err) {
    throw new Error(`Unable to load 'pg' from backend/node_modules: ${err.message}`);
  }
}

async function testConnection(Client, connectionString) {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
}

async function ensureDatabase(Client, baseUrl, dbName) {
  const url = new URL(baseUrl);
  url.pathname = '/postgres';
  const client = new Client({ connectionString: url.toString() });

  try {
    await client.connect();
    const check = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (check.rows.length === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`  ✓ Created database "${dbName}"`);
    } else {
      console.log(`  ✓ Database "${dbName}" already exists`);
    }
  } finally {
    try {
      await client.end();
    } catch {}
  }
}

async function dropDatabase(Client, baseUrl, dbName) {
  const url = new URL(baseUrl);
  url.pathname = '/postgres';
  const client = new Client({ connectionString: url.toString() });

  try {
    await client.connect();
    // Terminate existing connections first
    await client.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [dbName],
    );
    await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    console.log(`  ✓ Dropped database "${dbName}"`);
  } catch (err) {
    console.warn(`  ⚠ Warning: Could not drop database "${dbName}": ${err.message}`);
  } finally {
    try {
      await client.end();
    } catch {}
  }
}

// ---------------------------------------------------------------------------
// Subcommand: create
// ---------------------------------------------------------------------------

async function commandCreate(rawName, options) {
  if (!rawName) {
    console.error('Usage: pnpm agent:create <name> [--branch <bName>] [--port-offset <n>] [--force] [--no-db]');
    process.exit(1);
  }

  const sanitized = sanitizeAgentName(rawName);
  const branchName = options.branch || `feat/${rawName}`;
  const mainRoot = getMainRepoRoot();
  const targetDir = resolve(mainRoot, `../memsystems-${rawName}`);

  console.log(`🚀 Creating isolated agent environment for: ${rawName}\n`);

  // 1. Worktree Creation
  const existingWorktrees = parseWorktreeList(mainRoot);
  const alreadyExists = existingWorktrees.some((wt) => wt.path === targetDir);

  if (alreadyExists) {
    if (options.force) {
      console.log(`  ⚠ Worktree ${targetDir} already exists. Removing due to --force...`);
      await commandDestroy(rawName, { force: true, noDb: true });
    } else {
      console.error(`Error: Worktree already exists at ${targetDir}. Use --force to recreate or pick another name.`);
      process.exit(1);
    }
  }

  console.log(`📂 Setting up git worktree...`);
  console.log(`  Path:   ${targetDir}`);
  console.log(`  Branch: ${branchName}`);

  // Create worktree
  let gitArgs = ['worktree', 'add', targetDir, '-b', branchName];
  try {
    runGit(gitArgs, mainRoot);
  } catch (err) {
    // If branch already exists, try checking it out without -b
    if (err.message.includes('already exists')) {
      console.log(`  Branch ${branchName} already exists, checking out...`);
      gitArgs = ['worktree', 'add', targetDir, branchName];
      runGit(gitArgs, mainRoot);
    } else {
      throw err;
    }
  }

  // 2. Port Allocation
  const portOffset = options['port-offset']
    ? Number(options['port-offset'])
    : await findNextAvailableSlot(mainRoot, existingWorktrees);

  const appPort = 3000 + portOffset;
  const apiPort = 4000 + portOffset;
  const dockerDbPort = 5433 + portOffset;

  console.log(`\n🔌 Port Allocation (Slot #${portOffset}):`);
  console.log(`  Frontend:    ${appPort}`);
  console.log(`  Backend API: ${apiPort}`);
  console.log(`  Docker DB:   ${dockerDbPort}`);

  // 3. Secrets Extraction
  const secrets = extractInheritedSecrets(mainRoot);

  // 4. Scaffolding Environment Files
  console.log(`\n📝 Generating isolated environment files...`);

  const devDbName = `memsystems_dev_${sanitized}`;
  const testDbName = `memsystems_test_${sanitized}`;

  // Check which Postgres hosts are alive
  const Client = getPgClientClass(mainRoot);
  const testDbHost = 'postgresql://postgres:postgres@localhost:5499';
  const nativeDevHost = 'postgresql://postgres:postgres@localhost:5432';

  const isTestDbReachable = await testConnection(Client, `${testDbHost}/postgres`);
  const isNativeDevReachable = await testConnection(Client, `${nativeDevHost}/postgres`);

  // Target database URLs
  const devDbUrl = isNativeDevReachable
    ? `${nativeDevHost}/${devDbName}`
    : isTestDbReachable
      ? `${testDbHost}/${devDbName}`
      : `postgresql://postgres:postgres@localhost:5432/${devDbName}`;

  const testDbUrl = `${testDbHost}/${testDbName}`;

  // Write backend/.env.local
  const backendEnvLocal = `# Auto-generated by agent-env for agent: ${rawName}
PORT=${apiPort}
CLIENT_URL=http://localhost:${appPort}
DATABASE_URL=${devDbUrl}
DEV_STORAGE_DIR=./dev-storage
DEV_STORAGE_PUBLIC_URL=http://localhost:${apiPort}
DEV_STORAGE_TOKEN_SECRET=${secrets.DEV_STORAGE_TOKEN_SECRET}
CREDENTIALS_ENCRYPTION_KEY=${secrets.CREDENTIALS_ENCRYPTION_KEY}

# AI Providers (Inherited)
AI_GATEWAY_API_KEY=${secrets.AI_GATEWAY_API_KEY}
VOYAGE_API_KEY=${secrets.VOYAGE_API_KEY}

# Crawler (Inherited)
CRAWLER_PROVIDER=firecrawl
FIRECRAWL_API_URL=https://api.firecrawl.dev
FIRECRAWL_API_KEY=${secrets.FIRECRAWL_API_KEY}
FIRECRAWL_TIMEOUT_MS=30000
`;
  mkdirSync(join(targetDir, 'backend'), { recursive: true });
  writeFileSync(join(targetDir, 'backend/.env.local'), backendEnvLocal, 'utf8');
  console.log(`  ✓ Created backend/.env.local (Dev DB: ${devDbName}, Port: ${apiPort})`);

  // Write backend/.env.test
  const backendEnvTest = `# Auto-generated by agent-env for agent: ${rawName}
DATABASE_URL=${testDbUrl}
`;
  writeFileSync(join(targetDir, 'backend/.env.test'), backendEnvTest, 'utf8');
  console.log(`  ✓ Created backend/.env.test (Test DB: ${testDbName})`);

  // Write .env.docker.dev
  const dockerDevEnv = `# Auto-generated by agent-env for agent: ${rawName}
COMPOSE_PROJECT_NAME=memsystems-${sanitized}
APP_PORT=${appPort}
API_PORT=${apiPort}
DB_PORT=${dockerDbPort}
APP_ORIGIN=http://localhost:${appPort}

POSTGRES_USER=postgres
POSTGRES_PASSWORD=superuser
POSTGRES_DB=${devDbName}

DEV_STORAGE_TOKEN_SECRET=${secrets.DEV_STORAGE_TOKEN_SECRET}
CREDENTIALS_ENCRYPTION_KEY=${secrets.CREDENTIALS_ENCRYPTION_KEY}

AI_GATEWAY_API_KEY=${secrets.AI_GATEWAY_API_KEY}
VOYAGE_API_KEY=${secrets.VOYAGE_API_KEY}

CRAWLER_PROVIDER=firecrawl
FIRECRAWL_API_URL=https://api.firecrawl.dev
FIRECRAWL_API_KEY=${secrets.FIRECRAWL_API_KEY}
FIRECRAWL_TIMEOUT_MS=30000

VITE_POLLING_INTERVAL=500
`;
  writeFileSync(join(targetDir, '.env.docker.dev'), dockerDevEnv, 'utf8');
  console.log(`  ✓ Created .env.docker.dev (Project: memsystems-${sanitized})`);

  // 5. Ensure dependencies are linked
  const nodeModulesExist = existsSync(join(targetDir, 'node_modules'));
  if (!nodeModulesExist) {
    console.log(`\n📦 Linking dependencies with pnpm...`);
    execSync('pnpm install', { cwd: targetDir, stdio: 'inherit' });
  }

  // 6. Database Provisioning & Migrations
  if (!options['no-db']) {
    console.log(`\n🗄️ Provisioning isolated databases...`);

    // Test Database setup
    if (isTestDbReachable) {
      console.log(`  Setting up test database on port 5499...`);
      await ensureDatabase(Client, testDbHost, testDbName);

      try {
        execSync(`DATABASE_URL='${testDbUrl}' pnpm --filter backend run db:migrate`, {
          cwd: targetDir,
          stdio: 'pipe',
        });
        console.log(`  ✓ Applied migrations to ${testDbName}`);

        execSync(`DATABASE_URL='${testDbUrl}' pnpm --filter backend run test:db:setup`, {
          cwd: targetDir,
          stdio: 'pipe',
        });
        console.log(`  ✓ Applied test helpers to ${testDbName}`);
      } catch (err) {
        console.warn(`  ⚠ Warning applying test migrations: ${err.message}`);
      }
    } else {
      console.log(`  ⚠ Test database instance on :5499 is not running. Start with:`);
      console.log(`    docker start memsystems-test-db  (or docker run -d --name memsystems-test-db -p 5499:5432 -e POSTGRES_PASSWORD=postgres pgvector/pgvector:pg17)`);
    }

    // Dev Database setup
    if (isNativeDevReachable) {
      console.log(`  Setting up dev database on port 5432...`);
      await ensureDatabase(Client, nativeDevHost, devDbName);
      try {
        execSync(`DATABASE_URL='${devDbUrl}' pnpm --filter backend run db:migrate`, {
          cwd: targetDir,
          stdio: 'pipe',
        });
        console.log(`  ✓ Applied migrations to ${devDbName}`);
      } catch (err) {
        console.warn(`  ⚠ Warning applying dev migrations: ${err.message}`);
      }
    } else if (isTestDbReachable) {
      console.log(`  Setting up fallback dev database on port 5499...`);
      await ensureDatabase(Client, testDbHost, devDbName);
      try {
        execSync(`DATABASE_URL='${devDbUrl}' pnpm --filter backend run db:migrate`, {
          cwd: targetDir,
          stdio: 'pipe',
        });
        console.log(`  ✓ Applied migrations to ${devDbName}`);
      } catch (err) {
        console.warn(`  ⚠ Warning applying dev migrations: ${err.message}`);
      }
    }
  }

  // 7. Frontend i18n
  console.log(`\n🌐 Generating frontend i18n types...`);
  try {
    execSync('pnpm --filter frontend run i18n:types', { cwd: targetDir, stdio: 'pipe' });
    console.log(`  ✓ Frontend i18n types generated.`);
  } catch (err) {
    console.warn(`  ⚠ Warning generating i18n types: ${err.message}`);
  }

  // Summary
  console.log(`
🎉 Agent environment ready!
══════════════════════════════════════════════════════════════════════════
  Worktree Directory: ${targetDir}
  Git Branch:         ${branchName}
  Frontend App URL:   http://localhost:${appPort}
  Backend API URL:    http://localhost:${apiPort}/api
  Dev Database:       ${devDbName}
  Test Database:      ${testDbName}
══════════════════════════════════════════════════════════════════════════

Commands to run inside worktree:
  cd ${targetDir}
  pnpm run dev             # Start isolated frontend + backend
  pnpm run test            # Run Vitest against isolated test DB

Tear down when finished:
  pnpm agent:destroy ${rawName}
`);
}

// ---------------------------------------------------------------------------
// Subcommand: destroy
// ---------------------------------------------------------------------------

async function commandDestroy(rawName, options) {
  if (!rawName) {
    console.error('Usage: pnpm agent:destroy <name> [--force] [--delete-branch] [--no-db]');
    process.exit(1);
  }

  const sanitized = sanitizeAgentName(rawName);
  const mainRoot = getMainRepoRoot();
  const targetDir = resolve(mainRoot, `../memsystems-${rawName}`);
  const devDbName = `memsystems_dev_${sanitized}`;
  const testDbName = `memsystems_test_${sanitized}`;

  console.log(`🧹 Tearing down agent environment: ${rawName}\n`);

  // 1. Drop Databases
  if (!options['no-db']) {
    console.log(`🗄️ Dropping isolated databases...`);
    const Client = getPgClientClass(mainRoot);

    for (const host of [
      'postgresql://postgres:postgres@localhost:5499',
      'postgresql://postgres:postgres@localhost:5432',
    ]) {
      const isAlive = await testConnection(Client, `${host}/postgres`);
      if (isAlive) {
        await dropDatabase(Client, host, testDbName);
        await dropDatabase(Client, host, devDbName);
      }
    }
  }

  // 2. Remove Worktree
  console.log(`📂 Removing git worktree...`);
  try {
    const rmArgs = ['worktree', 'remove', targetDir];
    if (options.force) rmArgs.push('--force');
    runGit(rmArgs, mainRoot);
    console.log(`  ✓ Removed worktree directory ${targetDir}`);
  } catch (err) {
    console.warn(`  ⚠ Notice: ${err.message}`);
  }

  // 3. Delete Branch if requested
  if (options['delete-branch']) {
    const branchName = `feat/${rawName}`;
    console.log(`🌿 Deleting branch ${branchName}...`);
    try {
      runGit(['branch', '-D', branchName], mainRoot);
      console.log(`  ✓ Deleted branch ${branchName}`);
    } catch (err) {
      console.warn(`  ⚠ Notice deleting branch: ${err.message}`);
    }
  }

  console.log(`\n✓ Agent environment ${rawName} teardown complete.`);
}

// ---------------------------------------------------------------------------
// Subcommand: list
// ---------------------------------------------------------------------------

async function commandList() {
  const mainRoot = getMainRepoRoot();
  const worktrees = parseWorktreeList(mainRoot);

  console.log(`\n📋 Active Worktrees & Agent Environments (${worktrees.length}):\n`);
  console.log(
    `${'NAME / PATH'.padEnd(35)} ${'BRANCH'.padEnd(20)} ${'APP PORT'.padEnd(10)} ${'API PORT'.padEnd(10)} ${'DEV DB'.padEnd(25)} ${'TEST DB'.padEnd(25)}`
  );
  console.log(''.padEnd(125, '─'));

  for (const wt of worktrees) {
    const isMain = wt.path === mainRoot;
    const displayName = isMain ? `${basename(wt.path)} (main)` : basename(wt.path);
    const branch = wt.branch || '(detached)';

    const localEnv = parseEnvFile(join(wt.path, 'backend/.env.local'));
    const testEnv = parseEnvFile(join(wt.path, 'backend/.env.test'));
    const dockerEnv = parseEnvFile(join(wt.path, '.env.docker.dev'));

    let appPort = dockerEnv.get('APP_PORT') || '-';
    let apiPort = localEnv.get('PORT') || dockerEnv.get('API_PORT') || '-';

    let devDb = '-';
    const devDbUrl = localEnv.get('DATABASE_URL') || dockerEnv.get('POSTGRES_DB');
    if (devDbUrl) {
      try {
        devDb = new URL(devDbUrl).pathname.slice(1) || devDbUrl;
      } catch {
        devDb = devDbUrl;
      }
    }

    let testDb = '-';
    const testDbUrl = testEnv.get('DATABASE_URL');
    if (testDbUrl) {
      try {
        testDb = new URL(testDbUrl).pathname.slice(1) || testDbUrl;
      } catch {
        testDb = testDbUrl;
      }
    }

    console.log(
      `${displayName.padEnd(35)} ${branch.padEnd(20)} ${appPort.padEnd(10)} ${apiPort.padEnd(10)} ${devDb.padEnd(25)} ${testDb.padEnd(25)}`
    );
  }
  console.log();
}

// ---------------------------------------------------------------------------
// Subcommand: setup (run inside worktree)
// ---------------------------------------------------------------------------

async function commandSetup(options) {
  const currentDir = process.cwd();
  const mainRoot = getMainRepoRoot(currentDir);
  const dirName = basename(currentDir);

  if (currentDir === mainRoot) {
    console.log(`ℹ Running setup in main workspace root.`);
  }

  // Derive agent name from folder if memsystems-<name>
  const match = dirName.match(/^memsystems-(.+)$/);
  const agentName = match ? match[1] : dirName;

  console.log(`🔧 Running agent worktree setup for: ${agentName} (${currentDir})\n`);

  const existingWorktrees = parseWorktreeList(mainRoot);
  const secrets = extractInheritedSecrets(mainRoot);

  const localEnvPath = join(currentDir, 'backend/.env.local');
  const testEnvPath = join(currentDir, 'backend/.env.test');
  const dockerEnvPath = join(currentDir, '.env.docker.dev');

  let portOffset = 1;
  if (!existsSync(localEnvPath) && !existsSync(dockerEnvPath)) {
    portOffset = await findNextAvailableSlot(mainRoot, existingWorktrees);
  } else {
    const curEnv = parseEnvFile(localEnvPath);
    if (curEnv.get('PORT')) {
      const p = Number(curEnv.get('PORT'));
      if (p > 4000) portOffset = p - 4000;
    }
  }

  const appPort = 3000 + portOffset;
  const apiPort = 4000 + portOffset;
  const dockerDbPort = 5433 + portOffset;
  const sanitized = sanitizeAgentName(agentName);
  const devDbName = `memsystems_dev_${sanitized}`;
  const testDbName = `memsystems_test_${sanitized}`;

  // Create env files if missing or unconfigured
  if (!existsSync(localEnvPath)) {
    const localContent = `# Auto-generated by worktree:setup for agent: ${agentName}
PORT=${apiPort}
CLIENT_URL=http://localhost:${appPort}
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/${devDbName}
DEV_STORAGE_DIR=./dev-storage
DEV_STORAGE_PUBLIC_URL=http://localhost:${apiPort}
DEV_STORAGE_TOKEN_SECRET=${secrets.DEV_STORAGE_TOKEN_SECRET}
CREDENTIALS_ENCRYPTION_KEY=${secrets.CREDENTIALS_ENCRYPTION_KEY}

AI_GATEWAY_API_KEY=${secrets.AI_GATEWAY_API_KEY}
VOYAGE_API_KEY=${secrets.VOYAGE_API_KEY}

CRAWLER_PROVIDER=firecrawl
FIRECRAWL_API_URL=https://api.firecrawl.dev
FIRECRAWL_API_KEY=${secrets.FIRECRAWL_API_KEY}
FIRECRAWL_TIMEOUT_MS=30000
`;
    mkdirSync(join(currentDir, 'backend'), { recursive: true });
    writeFileSync(localEnvPath, localContent, 'utf8');
    console.log(`  ✓ Created backend/.env.local (Dev DB: ${devDbName})`);
  }

  if (!existsSync(testEnvPath)) {
    const testContent = `# Auto-generated by worktree:setup for agent: ${agentName}
DATABASE_URL=postgresql://postgres:postgres@localhost:5499/${testDbName}
`;
    writeFileSync(testEnvPath, testContent, 'utf8');
    console.log(`  ✓ Created backend/.env.test (Test DB: ${testDbName})`);
  }

  if (!existsSync(dockerEnvPath)) {
    const dockerContent = `# Auto-generated by worktree:setup for agent: ${agentName}
COMPOSE_PROJECT_NAME=memsystems-${sanitized}
APP_PORT=${appPort}
API_PORT=${apiPort}
DB_PORT=${dockerDbPort}
APP_ORIGIN=http://localhost:${appPort}

POSTGRES_USER=postgres
POSTGRES_PASSWORD=superuser
POSTGRES_DB=${devDbName}

DEV_STORAGE_TOKEN_SECRET=${secrets.DEV_STORAGE_TOKEN_SECRET}
CREDENTIALS_ENCRYPTION_KEY=${secrets.CREDENTIALS_ENCRYPTION_KEY}

AI_GATEWAY_API_KEY=${secrets.AI_GATEWAY_API_KEY}
VOYAGE_API_KEY=${secrets.VOYAGE_API_KEY}

CRAWLER_PROVIDER=firecrawl
FIRECRAWL_API_URL=https://api.firecrawl.dev
FIRECRAWL_API_KEY=${secrets.FIRECRAWL_API_KEY}
FIRECRAWL_TIMEOUT_MS=30000
VITE_POLLING_INTERVAL=500
`;
    writeFileSync(dockerEnvPath, dockerContent, 'utf8');
    console.log(`  ✓ Created .env.docker.dev`);
  }

  // Ensure node_modules
  if (!existsSync(join(currentDir, 'node_modules'))) {
    console.log(`\n📦 Running pnpm install...`);
    execSync('pnpm install', { cwd: currentDir, stdio: 'inherit' });
  }

  // Provision databases
  if (!options['no-db']) {
    const Client = getPgClientClass(mainRoot);
    const testDbHost = 'postgresql://postgres:postgres@localhost:5499';
    const isTestDbReachable = await testConnection(Client, `${testDbHost}/postgres`);

    if (isTestDbReachable) {
      await ensureDatabase(Client, testDbHost, testDbName);
      try {
        execSync(`DATABASE_URL='${testDbHost}/${testDbName}' pnpm --filter backend run db:migrate`, {
          cwd: currentDir,
          stdio: 'pipe',
        });
        execSync(`DATABASE_URL='${testDbHost}/${testDbName}' pnpm --filter backend run test:db:setup`, {
          cwd: currentDir,
          stdio: 'pipe',
        });
        console.log(`  ✓ Migrated test database ${testDbName}`);
      } catch (err) {
        console.warn(`  ⚠ Warning initializing test database: ${err.message}`);
      }
    }
  }

  // Frontend i18n
  console.log(`\n🌐 Generating frontend i18n types...`);
  try {
    execSync('pnpm --filter frontend run i18n:types', { cwd: currentDir, stdio: 'pipe' });
    console.log(`  ✓ Frontend i18n types generated.`);
  } catch (err) {
    console.warn(`  ⚠ Warning generating i18n types: ${err.message}`);
  }

  console.log(`\n✓ Worktree setup complete for ${agentName}!\n`);
}

// ---------------------------------------------------------------------------
// Main CLI Router
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const parsedOptions = {};
  const positional = [];

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        parsedOptions[key] = args[i + 1];
        i++;
      } else {
        parsedOptions[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  switch (command) {
    case 'create':
      await commandCreate(positional[0], parsedOptions);
      break;
    case 'destroy':
      await commandDestroy(positional[0], parsedOptions);
      break;
    case 'list':
      await commandList();
      break;
    case 'setup':
      await commandSetup(parsedOptions);
      break;
    default:
      console.log(`
Agent Environment CLI (memsystems)
──────────────────────────────────────────────────────────────────
Usage:
  node scripts/agent-env.mjs <command> [arguments] [options]

Commands:
  create <name>       Create an isolated git worktree, branch, ports & DBs
                      Options: --branch <bName>, --port-offset <n>, --force, --no-db
  destroy <name>      Remove worktree and drop associated isolated databases
                      Options: --force, --delete-branch, --no-db
  list                List all active agent environments and allocated ports
  setup               Initialize current worktree with isolated env & DBs
`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
