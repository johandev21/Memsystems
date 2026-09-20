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
