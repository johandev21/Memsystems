# Backend Agent Instructions (`backend/`)

NestJS 11 + Drizzle ORM (`src/database/schema.ts`) + PostgreSQL (`pgvector`).

## Environment & Configuration

- Native development loads `backend/.env.local`.
- Docker stacks load `.env.docker.dev` or `.env.docker.prod` from the repo root.

## Database & Testing

- Backend Vitest suites (`tests/**/*.test.ts`) require the dedicated `pgvector` PostgreSQL test instance on `localhost:5499` configured in `backend/.env.test`.
- `tests/setup.ts` truncates tables before every test; keep `backend/.env.test` pointed exclusively at `memsystems_test` on `:5499`.
- On a new test database container, run `db:migrate` with the test `DATABASE_URL` before `pnpm --filter backend run test:db:setup`.
- For test setup and RAG evaluation gates (`retrieval-eval.test.ts`, `generation-eval.test.ts`), read [../docs/testing.md](../docs/testing.md).
