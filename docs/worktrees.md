# Worktrees & Isolated Multi-Agent Environments

Use `git worktree` and `pnpm agent:*` when multiple agents, developers, or branches run concurrently.

## 1. Automated Agent Workflows (Recommended)

Provision an isolated branch, worktree directory, non-conflicting dev ports, isolated dev/test PostgreSQL databases, and inherited secrets with a single command:

```bash
# Create isolated environment for an agent
pnpm agent:create <agent-name>
```

This automatically:
1. Creates git branch `feat/<agent-name>` and worktree at `../memsystems-<agent-name>`.
2. Allocates collision-free ports for Frontend (`3000 + N`), Backend (`4000 + N`), and Docker DB (`5433 + N`).
3. Inherits real secrets (`AI_GATEWAY_API_KEY`, `VOYAGE_API_KEY`, `FIRECRAWL_API_KEY`, encryption keys) from the parent workspace.
4. Provisions isolated dev database (`memsystems_dev_<agent-name>`) and test database (`memsystems_test_<agent-name>`).
5. Applies Drizzle migrations and test schema helpers.
6. Generates frontend i18n types.

### List Active Agent Environments

```bash
pnpm agent:list
```

### Cleanup & Teardown

Drops the agent's isolated databases and cleanly removes the worktree:

```bash
pnpm agent:destroy <agent-name>

# Optionally also delete the git branch:
pnpm agent:destroy <agent-name> --delete-branch
```

---

## 2. Manual Worktree Setup

If you prefer adding a worktree manually:

```bash
git worktree add ../memsystems-<feature> -b feat/<feature>
cd ../memsystems-<feature>
pnpm run worktree:setup
```

`pnpm run worktree:setup` automatically detects the worktree name, configures isolated `.env.local` / `.env.test` / `.env.docker.dev` files, provisions test/dev databases, installs dependencies via `pnpm`, and generates frontend i18n types.

## 3. Isolated Native Dev Ports

Default dev servers bind to `:3000` (frontend) and `:4000` (backend). In worktrees configured by `agent:create`, ports are already configured in `.env.local`.

To override ports manually on the command line:

```bash
PORT=4001 VITE_PORT=3001 NESTJS_BACKEND_URL=http://127.0.0.1:4001 pnpm run dev
```

Single package:
```bash
VITE_PORT=3001 NESTJS_BACKEND_URL=http://127.0.0.1:4001 pnpm run dev:frontend
PORT=4001 pnpm run dev:backend
```

## 4. Isolated Docker Stack

Each agent can also run an isolated Docker stack if required:

```bash
COMPOSE_PROJECT_NAME=memsystems-agent2 APP_PORT=3002 API_PORT=4002 DB_PORT=5434 pnpm docker:dev
```
