import { existsSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const rootDir = process.cwd();

console.log('🔧 Initializing git worktree for memsystems...\n');

// 1. Setup required environment files if missing
const envCopies = [
  {
    target: 'backend/.env.test',
    source: 'backend/.env.test.example',
    description: 'Backend test database config (required for backend tests)',
  },
  {
    target: '.env.docker.dev',
    source: '.env.docker.dev.example',
    description: 'Docker dev environment template',
  },
  {
    target: 'backend/.env.local',
    source: 'backend/.env.example',
    description: 'Backend native dev environment config',
  },
];

for (const { target, source, description } of envCopies) {
  const targetPath = resolve(rootDir, target);
  const sourcePath = resolve(rootDir, source);

  if (!existsSync(targetPath)) {
    if (existsSync(sourcePath)) {
      copyFileSync(sourcePath, targetPath);
      console.log(`  ✓ Created ${target} from ${source} (${description})`);
    } else {
      console.warn(`  ⚠ Source template ${source} not found, skipping ${target}`);
    }
  } else {
    console.log(`  ✓ ${target} already exists`);
  }
}

// 2. Ensure node_modules exists
const nodeModulesExist = existsSync(resolve(rootDir, 'node_modules'));
if (!nodeModulesExist || process.argv.includes('--install')) {
  console.log('\n📦 Running pnpm install...');
  execSync('pnpm install', { stdio: 'inherit', cwd: rootDir });
} else {
  console.log('\n✓ node_modules found.');
}

// 3. Generate i18n types for frontend
console.log('\n🌐 Generating frontend i18n types...');
try {
  execSync('pnpm --filter frontend run i18n:types', { stdio: 'inherit', cwd: rootDir });
  console.log('✓ i18n types synchronized.');
} catch (err) {
  console.warn('⚠ Could not regenerate i18n types:', err.message);
}

console.log(`
🎉 Worktree setup complete!

Tips for concurrent agent development:
--------------------------------------
1. Isolated Dev Servers:
   PORT=4001 VITE_PORT=3001 NESTJS_BACKEND_URL=http://127.0.0.1:4001 pnpm run dev

2. Isolated Docker Compose (if using Docker):
   COMPOSE_PROJECT_NAME=memsystems-agent2 APP_PORT=3002 API_PORT=4002 DB_PORT=5433 pnpm docker:dev

3. Running Tests (Quality Gate):
   pnpm run lint
   pnpm run typecheck
   pnpm --filter <pkg> exec vitest run <test-path>

4. Cleaning up when done:
   git worktree remove <worktree-path>
`);
