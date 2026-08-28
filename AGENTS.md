# memsystems - Agent Instructions

pnpm workspace: `frontend/` (Vite + React 19) + `backend/` (NestJS 11). Turborepo.

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm run dev` | Parallel dev servers (frontend :3000, backend :4000) |
| `pnpm run dev:frontend` | `--filter frontend` |
| `pnpm run dev:backend` | `--filter backend` |
| `pnpm run build` | Build both packages |
| `pnpm run typecheck` | `tsc --noEmit` in both |
| `pnpm run lint` | oxlint (frontend) + ESLint (backend) |
| `pnpm run test` | Vitest (backend only) |
| `pnpm docker:dev` | Docker dev stack with frontend HMR and backend watch mode |
| `pnpm docker:prod` | Detached local production-like Docker stack |
| `pnpm docker:<mode>:down` | Stop a Docker stack while preserving its data |
| `pnpm docker:<mode>:reset` | Delete a Docker stack and its database/uploads |

**Quality Gate**: `lint` -> `typecheck` -> `test`.

**Single-package**: `pnpm --filter <name> run <cmd>` (`frontend`, `backend`).

**PowerShell workaround**: `cmd /c "cd /d <pkg-dir> && pnpm run test"`.

**Docker environments**: native backend uses `backend/.env.local`; Docker uses `.env.docker.dev` or `.env.docker.prod`. Never use the root `.env` for Docker configuration.

## Docs

- [Architecture](docs/architecture.md) — package structure, entrypoints, key patterns
- [Testing](docs/testing.md) — backend test setup, fixtures, DB lifecycle
- [Database](docs/database.md) — schema, drizzle-kit, connections
- [Frontend Architecture](docs/frontend-architecture.md) — feature-first design rules for frontend

## Skills

Skills from `.agents/skills/` can be loaded via `skill` tool.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
