# Testing

Only the backend has tests. No frontend tests exist.

## Backend (Vitest + real PostgreSQL)

### Prerequisites
- PostgreSQL running at `postgresql://postgres:superuser@localhost:5432/memsystems_test`
- Run `pnpm run test:db:setup` once to create the test database + `CREATE EXTENSION vector`

### How to run
```bash
pnpm run test                          # all tests
pnpm --filter backend run test         # backend only
cmd /c "cd /d backend && pnpm run test"  # PowerShell workaround
```

### Configuration
- `vitest.config.ts`: pool `forks`, `fileParallelism: false` (shared test DB), loads `.env.test` via `dotenv`.
- `.env.test`: `DATABASE_URL`, `LOG_LEVEL=ERROR`, `DEV_STORAGE_TOKEN_SECRET`.

### Setup lifecycle
- **`beforeAll`** (`tests/setup.ts`): `ensureTestDatabase()` — connects to `postgres`, creates DB if missing, runs `CREATE EXTENSION IF NOT EXISTS vector`.
- **`beforeEach`**: `resetDatabase()` — `TRUNCATE ... RESTART IDENTITY CASCADE` on all tables.
- Tables truncated: `notebook_chat_messages`, `generation_requests`, `source_chunks`, `source_index_jobs`, `web_search_jobs`, `jobs`, `study_materials`, `study_material_folders`, `sources`, `notebooks`, `user_settings`.

### Fixtures
`tests/fixtures.ts` provides:
- `seedUser(overrides?)` — returns an in-memory user identity
- `seedNotebook(userId, overrides?)` — inserts `notebooks` row
- `seedChatMessage(notebookId, {role, content, ...})` — inserts message
- `seedSource(notebookId, {kind, title, rawText, ...})` — inserts source
- `seedStudyMaterial(notebookId, {kind, title, ...})`

Import `db` from `tests/db.ts` for raw queries.

### Mocks
Only external services are mocked: S3, auth (via `RequestAuthenticator`), LLM, scraper, fetch. Never mock the DB.
