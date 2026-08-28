import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline'

const [mode, action, ...extraArgs] = process.argv.slice(2)
const force = extraArgs.includes('--force') || extraArgs.includes('-f')
const validModes = new Set(['dev', 'prod'])
const validActions = new Set(['up', 'down', 'logs', 'ps', 'migrate', 'reset'])

if (!validModes.has(mode) || !validActions.has(action)) {
  console.error('Usage: node scripts/docker.mjs <dev|prod> <up|down|logs|ps|migrate|reset> [--force]')
  process.exit(1)
}

const privateEnvPath = resolve(`.env.docker.${mode}`)
const exampleEnvPath = resolve(`.env.docker.${mode}.example`)
const envPath = existsSync(privateEnvPath) ? privateEnvPath : exampleEnvPath

if (mode === 'prod' && !existsSync(privateEnvPath)) {
  console.error('Missing .env.docker.prod.')
  console.error('Copy .env.docker.prod.example to .env.docker.prod and set the required secrets.')
  process.exit(1)
}

if (!existsSync(envPath)) {
  console.error(`Missing Docker environment file: ${envPath}`)
  process.exit(1)
}

function parseEnv(path) {
  const values = new Map()
  for (const sourceLine of readFileSync(path, 'utf8').split(/\r?\n/u)) {
    const line = sourceLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator < 1) continue
    const key = line.slice(0, separator).trim()
    let value = line.slice(separator + 1).trim()
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1)
    }
    values.set(key, value)
  }
  return values
}

if (mode === 'prod') {
  const values = parseEnv(envPath)
  const required = ['APP_ORIGIN', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB']
  const secretKeys = ['BETTER_AUTH_SECRET', 'DEV_STORAGE_TOKEN_SECRET']
  const missing = required.filter((key) => !values.get(key))
  const weakSecrets = secretKeys.filter((key) => {
    const value = values.get(key) || ''
    return value.length < 32 || /change.?me|replace|example/iu.test(value)
  })

  if (missing.length || weakSecrets.length) {
    if (missing.length) console.error(`Missing production-like values: ${missing.join(', ')}`)
    if (weakSecrets.length) {
      console.error(`Secrets must be at least 32 characters and non-placeholder: ${weakSecrets.join(', ')}`)
    }
    process.exit(1)
  }

  try {
    new URL(values.get('APP_ORIGIN'))
  } catch {
    console.error('APP_ORIGIN must be a valid absolute URL.')
    process.exit(1)
  }
}

const isWslAvailable = process.platform === 'win32'
function toWslPath(winPath) {
  const p = winPath.replaceAll('\\', '/')
  const m = p.match(/^([A-Za-z]):\/(.*)/u)
  if (!m) return p
  return `/mnt/${m[1].toLowerCase()}/${m[2]}`
}
const composeArgs = ['compose', '--env-file', envPath, '-f', `compose.${mode}.yml`]
const useWsl = isWslAvailable && existsSync('\\\\wsl$\\Ubuntu-24.04')

function runDockerCapture(args) {
  let cmd = 'docker'
  let cmdArgs = args
  if (useWsl) {
    const wslProjectDir = toWslPath(process.cwd())
    const inner = `cd ${JSON.stringify(wslProjectDir)} && docker ${args.map((a) => JSON.stringify(a)).join(' ')}`
    cmd = 'wsl'
    cmdArgs = ['-d', 'Ubuntu-24.04', 'bash', '-c', inner]
  }
  const r = spawnSync(cmd, cmdArgs, { encoding: 'utf8', shell: false })
  return (r.stdout || '').trim()
}

function getRunningProjectContainers(project) {
  const out = runDockerCapture(['ps', '--filter', `label=com.docker.compose.project=${project}`, '--format', '{{.Names}}'])
  return out ? out.split('\n').filter(Boolean) : []
}

async function promptConfirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(/^y(es)?$/iu.test(answer.trim()))
    })
  })
}

function runComposeDown(otherMode) {
  const otherEnvPath = resolve(`.env.docker.${otherMode}`)
  const otherExamplePath = resolve(`.env.docker.${otherMode}.example`)
  const otherPath = existsSync(otherEnvPath) ? otherEnvPath : otherExamplePath
  // Use same useWsl logic for down
  let cmd = 'docker'
  let args = ['compose', '--env-file', otherPath, '-f', `compose.${otherMode}.yml`, 'down', '--remove-orphans']
  if (useWsl) {
    const wslProjectDir = toWslPath(process.cwd())
    const inner = `cd ${JSON.stringify(wslProjectDir)} && docker compose --env-file ${JSON.stringify(`.env.docker.${otherMode}`)} -f ${JSON.stringify(`compose.${otherMode}.yml`)} down --remove-orphans`
    cmd = 'wsl'
    args = ['-d', 'Ubuntu-24.04', 'bash', '-c', inner]
  }
  console.log(`\nStopping ${otherMode} stack...`)
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: false })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

// Port collision guard: dev and prod share same host ports (3000/4000) via mirrored WSL networking
// DB ports are now isolated (dev 5433, prod 5434, host 5432) but still check host postgres
if (action === 'up') {
  const otherMode = mode === 'dev' ? 'prod' : 'dev'
  const otherProject = `memsystems-${otherMode}`
  const running = getRunningProjectContainers(otherProject)
  if (running.length > 0) {
    console.error(`\nPort conflict: ${otherMode} stack is already running (${running.join(', ')})`)
    console.error(`Both dev and prod use the same host ports 3000/4000 and cannot run together.`)
    console.error(`Stop the other stack first:`)
    console.error(`  pnpm docker:${otherMode}:down   (or: node scripts/docker.mjs ${otherMode} down)`)
    console.error(`Or auto-switch with --force:`)
    console.error(`  pnpm docker:${mode} -- --force   (or: node scripts/docker.mjs ${mode} up --force)`)

    if (force) {
      console.log(`\n--force detected: stopping ${otherMode} and starting ${mode}...`)
      runComposeDown(otherMode)
    } else {
      const isTTY = process.stdin.isTTY && process.stdout.isTTY
      if (isTTY) {
        const ok = await promptConfirm(`\nStop ${otherMode} and start ${mode}? (y/N) `)
        if (!ok) {
          console.error('Aborted. No changes made.')
          process.exit(1)
        }
        runComposeDown(otherMode)
      } else {
        process.exit(1)
      }
    }
  }

  // Host postgres check for DB_PORT (dev 5433, prod 5434, host 5432)
  const envVals = parseEnv(envPath)
  const dbPort = envVals.get('DB_PORT') || '5432'
  if (useWsl) {
    const ssCheck = spawnSync('wsl', ['-d', 'Ubuntu-24.04', 'bash', '-c', `ss -tlnp 2>/dev/null | grep -E ':\\${dbPort}\\b' || true`], { encoding: 'utf8', shell: false })
    const ssOut = (ssCheck.stdout || '').trim()
    const isDockerProxy = ssOut.includes('docker-proxy')
    const isListening = ssOut.length > 0
    // If listening and not docker-proxy, it's host postgres on same port
    if (isListening && !isDockerProxy) {
      console.error(`\nHost port conflict: host is already listening on ${dbPort} (likely host postgres on 5432)`)
      console.error(`Your ${mode} DB wants host port ${dbPort} but it's taken.`)
      if (dbPort === '5432') {
        console.error(`Fix: stop host postgres (Get-Service postgresql* | Stop-Service) or change DB_PORT to 5433/5434 in .env.docker.${mode}`)
      } else {
        console.error(`Fix: stop the process on ${dbPort} or change DB_PORT in .env.docker.${mode}`)
      }
      process.exit(1)
    }
  }
}

const actionCommands = {
  up: [
    mode === 'dev'
      ? ['up', '--build', '--remove-orphans']
      : ['up', '--build', '--detach', '--remove-orphans'],
  ],
  down: [['down', '--remove-orphans']],
  logs: [['logs', '--follow']],
  ps: [['ps']],
  migrate: [
    ['build', mode === 'dev' ? 'backend' : 'migrate'],
    ['run', '--rm', 'migrate'],
  ],
  reset: [['down', '--volumes', '--remove-orphans']],
}[action]

for (const actionArgs of actionCommands) {
  let cmd = 'docker'
  let args = [...composeArgs, ...actionArgs]
  if (useWsl) {
    const wslProjectDir = toWslPath(process.cwd())
    const inner = `cd ${JSON.stringify(wslProjectDir)} && docker compose --env-file ${JSON.stringify(`.env.docker.${mode}`)} -f ${JSON.stringify(`compose.${mode}.yml`)} ${actionArgs.map((a) => JSON.stringify(a)).join(' ')}`
    cmd = 'wsl'
    args = ['-d', 'Ubuntu-24.04', 'bash', '-c', inner]
  }
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: false,
  })

  if (result.error) {
    console.error(result.error.message)
    process.exit(1)
  }

  if (result.status !== 0) process.exit(result.status ?? 1)
}

process.exit(0)
