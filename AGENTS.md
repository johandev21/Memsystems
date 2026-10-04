# memsystems - Agent Instructions

pnpm workspace: `frontend/` (Vite + React 19) + `backend/` (NestJS 11). Turborepo.

Do not test until you modify some actual code or is explicitely requested by the user. 
And when you do modify some code and add tests just test the stuff you modifed do not run the full tests. 

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm run dev` | Parallel dev servers (frontend :3000, backend :4000) |
| `pnpm run dev:frontend` | `--filter frontend` |
| `pnpm run dev:backend` | `--filter backend` |
| `pnpm run build` | Build both packages |
| `pnpm run typecheck` | `tsc --noEmit` in both |
| `pnpm run lint` | oxlint (frontend) + ESLint (backend) |
| `pnpm run test` | Vitest (frontend + backend) |
| `pnpm docker:dev` | Docker dev stack with frontend HMR and backend watch mode |
| `pnpm docker:prod` | Detached local production-like Docker stack |
| `pnpm docker:<mode>:down` | Stop a Docker stack while preserving its data |
| `pnpm docker:<mode>:reset` | Delete a Docker stack and its database/uploads |

**Quality Gate**: `lint` -> `typecheck` -> `test`.

**Single-package**: `pnpm --filter <name> run <cmd>` (`frontend`, `backend`).

**PowerShell workaround**: `cmd /c "cd /d <pkg-dir> && pnpm run test"`.

**Docker environments**: native backend uses `backend/.env.local`; Docker uses `.env.docker.dev` or `.env.docker.prod`. Never use the root `.env` for Docker configuration.

## Pruebas

Antes de ejecutar pruebas, lee [docs/testing.md](docs/testing.md). Puntos críticos:

- `pnpm run test` ejecuta frontend y backend mediante Turborepo.
- El backend necesita su propia base PostgreSQL en `localhost:5499` (ver `backend/.env.test`). Si no está levantada, todos los archivos fallan con `ECONNREFUSED` y las pruebas aparecen como "skipped". En una base nueva, el orden es: `db:migrate` con el `DATABASE_URL` de prueba y después `test:db:setup`.
- Nunca apuntes `backend/.env.test` a la base de desarrollo: las pruebas truncan tablas.
- El frontend precarga todos los namespaces de i18n en `frontend/src/test/setup.ts`. No quites esa precarga: sin ella los componentes suspenden y las consultas sincrónicas ven el DOM vacío.

## Worktrees & Multi-Agent Workflows

When multiple agents or developers work simultaneously on different branches, use `git worktree` to isolate code changes without context switching or branch pollution.

### 1. Creating and Setting Up a Worktree

```bash
# Create a new branch in a separate worktree
git worktree add ../memsystems-<feature> -b feat/<feature>

# Enter the worktree and run the automated setup
cd ../memsystems-<feature>
pnpm run worktree:setup
```

`pnpm run worktree:setup` will:
- Copy required template env files (`backend/.env.test`, `.env.docker.dev`, `backend/.env.local`).
- Ensure `node_modules` are installed.
- Compile frontend i18n translation types.

### 2. Isolated Dev Servers (No Port Conflicts)

By default, dev runs on frontend `:3000` and backend `:4000`. To run dev servers concurrently with another agent:

```bash
PORT=4001 VITE_PORT=3001 NESTJS_BACKEND_URL=http://127.0.0.1:4001 pnpm run dev
```

Or for single package dev:
```bash
# Frontend on custom port
VITE_PORT=3001 NESTJS_BACKEND_URL=http://127.0.0.1:4001 pnpm run dev:frontend

# Backend on custom port
PORT=4001 pnpm run dev:backend
```

### 3. Isolated Docker Stacks

To run Docker without container name or port collisions with other worktrees:

```bash
COMPOSE_PROJECT_NAME=memsystems-agent2 APP_PORT=3002 API_PORT=4002 DB_PORT=5433 pnpm docker:dev
```

### 4. Running Tests in Parallel

- Adhere strictly to the quality gate: `lint` -> `typecheck` -> `test`.
- **Targeted testing only**: Run only tests for files you modified (`pnpm --filter <pkg> exec vitest run <path>`).
- If running backend tests, ensure `backend/.env.test` is configured and the test database (`localhost:5499`) is running.

### 5. Cleaning Up When Done

```bash
git worktree remove ../memsystems-<feature>
```
