# Memsystems — Agent Instructions

Memsystems is a single-user study workspace for collecting sources, chatting with grounded citations, and generating study materials.
`pnpm` monorepo with two packages: `frontend/` (Vite + React 19) and `backend/` (NestJS 11 + Drizzle + PostgreSQL/pgvector).

## Verification & Quality Gate

- Run tests only after modifying code or when explicitly requested by the user.
- Verify code changes in order: `pnpm run lint` -> `pnpm run typecheck` -> targeted Vitest run on modified files only (`pnpm --filter <frontend|backend> exec vitest run <path>`).
- Native backend uses `backend/.env.local`; Docker uses `.env.docker.dev` or `.env.docker.prod`.

## Context Pointers

Load these files only when your task touches their branch:

- **Frontend UI, components, styling, or mobile work**: read [frontend/AGENTS.md](frontend/AGENTS.md).
- **Backend modules, Drizzle schema, or API routes**: read [backend/AGENTS.md](backend/AGENTS.md).
- **Writing, debugging, or running tests**: read [docs/testing.md](docs/testing.md).
- **Domain vocabulary and naming**: read [CONTEXT.md](CONTEXT.md).
- **Multi-agent environments, worktrees, or parallel ports**: read [docs/worktrees.md](docs/worktrees.md).
