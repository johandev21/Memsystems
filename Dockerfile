# syntax=docker/dockerfile:1.7

# ---------------------------------------------------------------------------
# Base: Node 24 + pnpm (version pinned by the packageManager field via corepack)
# ---------------------------------------------------------------------------
FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME/bin:$PATH
RUN corepack enable
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
# source: shared workspace source for dev targets and production builds
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
# build: compile both applications; type errors must fail the image build
# ---------------------------------------------------------------------------
FROM source AS build
ARG VITE_CLERK_PUBLISHABLE_KEY=pk_test_sample_key
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
RUN cd backend && pnpm run build
RUN cd frontend && pnpm run build

# ---------------------------------------------------------------------------
# backend-prod: extract production-only deps for the backend package
# ---------------------------------------------------------------------------
FROM build AS backend-prod-deps
RUN --mount=type=cache,id=memsystems-pnpm-store,target=/pnpm/store \
    pnpm --filter=backend --prod deploy --legacy /prod/backend

# ---------------------------------------------------------------------------
# backend runtime
# ---------------------------------------------------------------------------
FROM node:24-slim AS backend-prod
ENV NODE_ENV=production
WORKDIR /app/backend
COPY --from=backend-prod-deps /prod/backend/package.json ./package.json
COPY --from=backend-prod-deps /prod/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/drizzle ./drizzle
COPY --from=build /app/backend/seed ./seed
EXPOSE 4000
CMD ["node", "dist/main.js"]

# ---------------------------------------------------------------------------
# frontend runtime: nginx serves the SPA and reverse-proxies /api -> backend
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS frontend-prod
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
