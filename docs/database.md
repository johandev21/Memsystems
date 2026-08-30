# Database

**PostgreSQL** + **Drizzle ORM** (node-postgres `Pool`, timezone UTC).

## Schema
Application schema is defined in:
- `src/database/schema.ts` — application tables with direct Clerk `user_id` text columns

## Migrations
```bash
pnpm exec drizzle-kit generate
pnpm exec drizzle-kit migrate
```
Reads `.env.local` for the connection string.

## Connection
Backend creates a connection pool in `src/database/connection.ts` (via `createDatabaseConnection`). Re-exported as a NestJS module in `modules/database/`.

## Test database
Separate DB at `postgresql://postgres:superuser@localhost:5432/memsystems_test`. See [testing.md](testing.md).
