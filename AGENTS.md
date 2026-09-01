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
