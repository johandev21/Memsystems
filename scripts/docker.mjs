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
  const secretKeys = ['DEV_STORAGE_TOKEN_SECRET', 'CREDENTIALS_ENCRYPTION_KEY']
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

const dockerEnvVals = parseEnv(envPath)
const firecrawlApiUrlRaw = (dockerEnvVals.get('FIRECRAWL_API_URL') || '').trim()
if (firecrawlApiUrlRaw) {
  let parsedFirecrawlUrl
  try {
    parsedFirecrawlUrl = new URL(firecrawlApiUrlRaw)
  } catch {
    parsedFirecrawlUrl = undefined
  }
  if (
    !parsedFirecrawlUrl ||
    (parsedFirecrawlUrl.protocol !== 'http:' && parsedFirecrawlUrl.protocol !== 'https:')
  ) {
    console.error(`FIRECRAWL_API_URL must be a valid http(s) URL (got "${firecrawlApiUrlRaw}").`)
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

// Single compose file per mode: Firecrawl Cloud is the only provider.
const composeFiles = [`compose.${mode}.yml`]
const composeArgs = ['compose', '--env-file', envPath]
for (const f of composeFiles) composeArgs.push('-f', f)
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
  // No overlays: single compose file per mode.
  const otherFiles = [`compose.${otherMode}.yml`]
  // Use same useWsl logic for down
  let cmd = 'docker'
  let args = ['compose', '--env-file', otherPath]
  for (const f of otherFiles) args.push('-f', f)
  args.push('down', '--remove-orphans')
  if (useWsl) {
    const wslProjectDir = toWslPath(process.cwd())
    const fileFlags = otherFiles.map((f) => `-f ${JSON.stringify(f)}`).join(' ')
    const inner = `cd ${JSON.stringify(wslProjectDir)} && docker compose --env-file ${JSON.stringify(`.env.docker.${otherMode}`)} ${fileFlags} down --remove-orphans`
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
  function isHostPortTakenByNonDockerProxy(port) {
    const ssCheck = spawnSync('wsl', ['-d', 'Ubuntu-24.04', 'bash', '-c', `ss -tlnp 2>/dev/null | grep -E ':${port}\\b' || true`], { encoding: 'utf8', shell: false })
    const ssOut = (ssCheck.stdout || '').trim()
    const isDockerProxy = ssOut.includes('docker-proxy')
    const isListening = ssOut.length > 0
    return isListening && !isDockerProxy
  }
  if (useWsl) {
    // If listening and not docker-proxy, it's host postgres on same port
    if (isHostPortTakenByNonDockerProxy(dbPort)) {
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

  // Non-blocking Firecrawl reachability probe: warn only, never fail `up`.
  if (firecrawlApiUrlRaw) {
    try {
      const probeController = new AbortController()
      const probeTimer = setTimeout(() => probeController.abort(), 2000)
      try {
        await fetch(firecrawlApiUrlRaw, { signal: probeController.signal })
      } finally {
        clearTimeout(probeTimer)
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.warn(
        `Warning: FIRECRAWL_API_URL "${firecrawlApiUrlRaw}" appears unreachable (${detail}). Continuing 'up' — web ingestion will fail until Firecrawl is running.`,
      )
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
    const fileFlags = composeFiles.map((f) => `-f ${JSON.stringify(f)}`).join(' ')
    const inner = `cd ${JSON.stringify(wslProjectDir)} && docker compose --env-file ${JSON.stringify(`.env.docker.${mode}`)} ${fileFlags} ${actionArgs.map((a) => JSON.stringify(a)).join(' ')}`
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
