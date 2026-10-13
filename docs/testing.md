# Testing Guide

## Targeted Execution

Run only the tests covering files you modified rather than the full suite:

```bash
pnpm --filter frontend exec vitest run <path>
pnpm --filter backend exec vitest run <path>
```

## Frontend (`frontend/`)

- **Runner**: Vitest (`jsdom`), configured in `frontend/vitest.config.ts` with setup in `frontend/src/test/setup.ts`.
- **i18n Preload**: Production (`frontend/src/shared/i18n/i18n.ts`) lazy-loads every namespace except `common`. To prevent components from suspending (`<body><div /></div>`) or returning raw keys during synchronous Testing Library queries, `frontend/src/test/setup.ts` preloads all English (`en`) namespaces from `frontend/src/shared/i18n/locales/en/*.json`. Keep this preload intact.
- **Language Switching in Tests**: Only `en` is preloaded automatically. When a test switches language (e.g. `es`), load the required namespaces explicitly:
  ```ts
  await i18n.changeLanguage("es");
  await i18n.loadNamespaces(["common", "sources"]);
  ```

## Backend (`backend/`)

- **Runner**: Vitest (`node`, `pool: "forks"`, single-file execution), configured in `backend/vitest.config.ts` and `backend/tests/setup.ts`.
- **Dedicated Test Database**: `backend/tests/setup.ts` truncates tables before every test. Always point `backend/.env.test` to the disposable `pgvector` database on `localhost:5499` (`postgresql://postgres:postgres@localhost:5499/memsystems_test`), never the development database.

### First-Time Test DB Setup

`backend/tests/ensure-test-db.ts` expects the base schema to exist before running `test:db:setup`. Follow this exact order on a new container:

```bash
# 1. Start disposable pgvector container on :5499
docker run -d --name memsystems-test-db -p 5499:5432 \
  -e POSTGRES_PASSWORD=postgres pgvector/pgvector:pg17

# 2. Apply Drizzle migrations first (prevents 'relation "app_settings" does not exist')
DATABASE_URL='postgresql://postgres:postgres@localhost:5499/memsystems_test' \
  pnpm --filter backend run db:migrate

# 3. Prepare test schema helpers
pnpm --filter backend run test:db:setup
```

If `connect ECONNREFUSED 127.0.0.1:5499` occurs later, start the existing container with `docker start memsystems-test-db`.

### Retrieval & Generation Evaluation Gates

`backend/tests/retrieval-eval.test.ts` and `backend/tests/generation-eval.test.ts` run against the golden corpus using deterministic keyless doubles and compare metrics against `backend/tests/eval/baseline.json`. After an intentional retrieval or grounding change, refresh both baselines together and inspect the diff:

```bash
RETRIEVAL_EVAL_UPDATE=1 pnpm --filter backend exec vitest run tests/retrieval-eval.test.ts tests/generation-eval.test.ts
```
