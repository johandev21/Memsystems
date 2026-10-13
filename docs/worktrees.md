# Worktrees & Isolated Environments

Use `git worktree` when multiple agents or branches run concurrently.

## 1. Create & Initialize Worktree

```bash
git worktree add ../memsystems-<feature> -b feat/<feature>
cd ../memsystems-<feature>
pnpm run worktree:setup
```

`pnpm run worktree:setup` copies env templates (`backend/.env.test`, `.env.docker.dev`, `backend/.env.local`), installs dependencies, and generates frontend i18n types.

## 2. Isolated Native Dev Ports

Default dev servers bind to `:3000` (frontend) and `:4000` (backend). Override ports to run alongside another instance:

```bash
PORT=4001 VITE_PORT=3001 NESTJS_BACKEND_URL=http://127.0.0.1:4001 pnpm run dev
```

Single package:
```bash
VITE_PORT=3001 NESTJS_BACKEND_URL=http://127.0.0.1:4001 pnpm run dev:frontend
PORT=4001 pnpm run dev:backend
```

## 3. Isolated Docker Stack

```bash
COMPOSE_PROJECT_NAME=memsystems-agent2 APP_PORT=3002 API_PORT=4002 DB_PORT=5433 pnpm docker:dev
```

## 4. Cleanup

```bash
git worktree remove ../memsystems-<feature>
```
