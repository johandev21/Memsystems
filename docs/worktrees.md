# Git Worktrees for Multi-Agent & Parallel Development

This guide documents how to use `git worktree` in `memsystems` so multiple agents or engineers can develop, run tests, and spin up local dev environments simultaneously on different branches without interference.

---

## 1. Quick Start

### Create a new worktree
From the main repository directory:

```bash
# Add a worktree adjacent to the main repo
git worktree add ../memsystems-<branch-name> -b feat/<branch-name>
```

### Initialize the worktree
Switch to the new worktree and run the automated setup command:

```bash
cd ../memsystems-<branch-name>
pnpm run worktree:setup
```

The script `scripts/worktree-setup.mjs` will:
1. Copy template `.env` files if missing (`backend/.env.test`, `.env.docker.dev`, `backend/.env.local`).
2. Verify `node_modules` and run `pnpm install` if needed.
3. Synchronize frontend i18n TypeScript definitions (`pnpm --filter frontend run i18n:types`).

---

## 2. Dev Server Isolation (Port Configuration)

When multiple agents run dev servers concurrently, each agent must use a distinct set of ports to avoid collisions:

| Worktree / Agent | Frontend Port (`VITE_PORT`) | Backend Port (`PORT`) | Proxy Backend URL (`NESTJS_BACKEND_URL`) |
|------------------|-----------------------------|-----------------------|------------------------------------------|
| Main / Agent 1   | `3000` (default)            | `4000` (default)      | `http://127.0.0.1:4000` (default)       |
| Agent 2          | `3001`                      | `4001`                | `http://127.0.0.1:4001`                  |
| Agent 3          | `3002`                      | `4002`                | `http://127.0.0.1:4002`                  |

### Example: Starting dev on custom ports
```bash
PORT=4001 VITE_PORT=3001 NESTJS_BACKEND_URL=http://127.0.0.1:4001 pnpm run dev
```

---

## 3. Docker Isolation (Compose Configuration)

If running in Docker mode, Docker Compose requires a unique project name and unique host port bindings:

```bash
COMPOSE_PROJECT_NAME=memsystems-agent2 \
APP_PORT=3002 \
API_PORT=4002 \
DB_PORT=5433 \
pnpm docker:dev
```

---

## 4. Running Tests Concurrently

- **Frontend tests** run in `jsdom` via Vitest and do not use network ports. They can be executed concurrently in any worktree.
- **Backend tests** require the PostgreSQL test database (`localhost:5499`).
  - `backend/.env.test` is automatically populated during `pnpm run worktree:setup`.
  - Always run targeted tests rather than the entire test suite (`pnpm --filter <pkg> exec vitest run <path>`) as per repository instructions in `AGENTS.md`.

---

## 5. Cleaning Up Worktrees

When work on a branch is finished and merged:

```bash
# List all active worktrees
git worktree list

# Remove a worktree
git worktree remove ../memsystems-<branch-name>

# Prune stale worktree references
git worktree prune
```
