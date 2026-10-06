# syntax=docker/dockerfile:1.7

# ---------------------------------------------------------------------------
# Base: Node 24 + pnpm (version pinned by the packageManager field)
# ---------------------------------------------------------------------------
FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME/bin:$PATH
RUN npm install -g pnpm@12.5.1
WORKDIR /app

# ---------------------------------------------------------------------------
# deps: install the full monorepo (devDeps included, required for building)
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
RUN --mount=type=cache,id=memsystems-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# backend-prod-deps: extract production-only deps for the backend package
# (Branches directly from deps: 0s cache hit when dependencies haven't changed)
# ---------------------------------------------------------------------------
FROM deps AS backend-prod-deps
RUN --mount=type=cache,id=memsystems-pnpm-store,target=/pnpm/store \
    pnpm --filter=backend --prod deploy --legacy /prod/backend

# ---------------------------------------------------------------------------
# backend-build: compile the NestJS backend
# (Isolated from frontend: frontend changes never invalidate backend cache)
# ---------------------------------------------------------------------------
FROM deps AS backend-build
COPY backend ./backend
RUN --mount=type=cache,id=memsystems-turbo-cache,target=/app/.turbo \
    pnpm --filter=backend build

# ---------------------------------------------------------------------------
# frontend-build: compile the Vite + React frontend
# (Isolated from backend: backend changes never invalidate frontend cache)
# ---------------------------------------------------------------------------
FROM deps AS frontend-build
COPY frontend ./frontend
RUN --mount=type=cache,id=memsystems-turbo-cache,target=/app/.turbo \
    pnpm --filter=frontend build

# ---------------------------------------------------------------------------
# source: shared workspace source for dev targets (used by compose.dev.yml)
# ---------------------------------------------------------------------------
FROM deps AS source
COPY frontend ./frontend
COPY backend ./backend

# ---------------------------------------------------------------------------
# Development workspace: Compose runs separate services from this shared image
# ---------------------------------------------------------------------------
FROM source AS workspace-dev
ENV NODE_ENV=development
EXPOSE 3000 4000

# ---------------------------------------------------------------------------
# build: composite stage aggregating build outputs for backwards compatibility
# ---------------------------------------------------------------------------
FROM base AS build
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=backend-build /app/backend/drizzle ./backend/drizzle
COPY --from=backend-build /app/backend/seed ./backend/seed
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# ---------------------------------------------------------------------------
# backend runtime
# ---------------------------------------------------------------------------
FROM node:24-slim AS backend-prod
ENV NODE_ENV=production
WORKDIR /app/backend
COPY --from=backend-prod-deps /prod/backend/package.json ./package.json
COPY --from=backend-prod-deps /prod/backend/node_modules ./node_modules
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=backend-build /app/backend/drizzle ./drizzle
COPY --from=backend-build /app/backend/seed ./seed
EXPOSE 4000
CMD ["node", "dist/main.js"]

# ---------------------------------------------------------------------------
# frontend runtime: nginx serves the SPA and reverse-proxies /api -> backend
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS frontend-prod
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
