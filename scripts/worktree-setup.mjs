import { resolve } from 'node:path';
import { fork } from 'node:child_process';

const agentEnvScript = resolve(import.meta.dirname, 'agent-env.mjs');
const child = fork(agentEnvScript, ['setup', ...process.argv.slice(2)], {
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
