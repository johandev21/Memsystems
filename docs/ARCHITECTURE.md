# Architecture and Behavior

This document describes how Memsystems is built and how it behaves. For the vocabulary, see [CONTEXT.md](../CONTEXT.md). For the test workflow, see [testing.md](testing.md).

## 1. What the app is

Memsystems is a single-user study workspace. There is no login and no user isolation. A person:

1. Organizes notebooks in a library.
2. Adds sources to a notebook: pasted text, a URL, an uploaded file, or a web search result.
3. Chats with an AI about the notebook's sources. Answers carry citations.
4. Generates study materials from selected sources: quiz, flashcards, roadmap, mind map, slides, study guide, practice problems, or case study.
5. Studies the materials in a viewer, and can hand off to chat from most viewers.

All AI features need an AI Gateway key. Indexing and retrieval also need a Voyage AI key. Both are stored encrypted in the database and are configured on the settings page.

## 2. Repository layout

pnpm workspace with two packages, orchestrated by Turborepo.

| Path | Contents |
| --- | --- |
| `frontend/` | Vite + React 19 + TypeScript. TanStack Router and Query, Zustand, dnd-kit, Tailwind CSS v4, shadcn/ui primitives on Base UI. |
| `backend/` | NestJS 11 + Express 5. Drizzle ORM on PostgreSQL with pgvector. Vercel AI Gateway through the AI SDK v7, Voyage AI embeddings, Firecrawl web ingestion. |
| `docs/` | This document, `testing.md`, and `retrieval-evaluation.md`. |
| `scripts/docker.mjs` | Docker stack control. Uses `.env.docker.dev` / `.env.docker.prod`. |
| `Dockerfile`, `compose.dev.yml`, `compose.prod.yml` | Dev and production-like stacks. |

Root commands: `pnpm run dev`, `build`, `lint`, `typecheck`, `test`, `format`. Per package: `pnpm --filter frontend run <cmd>` or `pnpm --filter backend run <cmd>`. The quality gate is lint, then typecheck, then test.

## 3. Runtime topology

```
browser
  └─ frontend (Vite dev :3000, or nginx in prod)
       └─ /api → backend (NestJS :4000, global prefix /api)
            ├─ PostgreSQL + pgvector (all state, including the job queue)
            ├─ storage: S3 when S3_ENDPOINT is set, otherwise local disk
            ├─ Vercel AI Gateway (models, chat, generation, vision, transcription)
            ├─ Voyage AI (contextualized chunk embeddings, voyage-context-4 at 1024 dimensions, with voyage-4 as the configured fallback; cross-encoder reranking, rerank-2.5)
            └─ Firecrawl (web search and URL acquisition, with a local fetch fallback)
```

The backend has no auth guards, sessions, or tokens. `assertNotebookOwner` only checks that the notebook row exists (`backend/src/modules/notebooks/notebooks.service.ts:127`). Upload intent tokens are bearer secrets. The database is UTC.

Main configuration lives in `backend/.env.example` (native) and `.env.docker.dev.example` / `.env.docker.prod.example` (Docker). Important variables: `DATABASE_URL`, `PORT`, `CLIENT_URL`, `DEV_STORAGE_*`, `S3_*`, `CREDENTIALS_ENCRYPTION_KEY`, `AI_GATEWAY_API_KEY`, `VOYAGE_API_KEY`, `FIRECRAWL_*`, `JOB_QUEUE_*`, `SOURCE_FETCH_TIMEOUT_MS`, `CHUNK_TARGET_TOKENS`, `CHUNK_MIN_TOKENS`, `CHUNK_OVERLAP_TOKENS`, `EMBEDDING_CONTEXTUAL_ENABLED`, `EMBEDDING_CONTEXTUAL_MODEL`, `RETRIEVAL_RELEVANCE_FLOOR`, `RETRIEVAL_RERANK_*`, `RETRIEVAL_CANDIDATE_DEPTH`, `RETRIEVAL_TOP_K`, `RETRIEVAL_HYBRID_ENABLED`, `RETRIEVAL_RRF_*`, `RETRIEVAL_*_CANDIDATE_DEPTH`, `RETRIEVAL_REWRITE_*`.

## 4. Data model

Single Drizzle schema: `backend/src/database/schema.ts`. Migrations live in `backend/drizzle/` and are applied by `pnpm --filter backend run db:migrate`.

| Table | Purpose and key relations |
| --- | --- |
| `notebook_folders` | Library folder tree. `parentId` is a self reference with cascade delete. |
| `notebooks` | Top-level workspace. `folderId` → library folder (set null). Holds banner key, banner variants, and banner focal point. |
| `sources` | Ingested material in a notebook (cascade). Tracks kind, modality, processing status and stage, current version, content hash, and acquisition metadata. |
| `source_versions` | Immutable interpretation of a source. Owns ordered `source_segments` and a content-quality assessment (score, reason, signals). |
| `source_chunks` | Embedding units with a 1024-dimension vector and an HNSW cosine index, plus a stored searchable text (document and section context header plus body) with a generated `tsvector` and a GIN index for lexical search. Each chunk carries its heading path, source kind, and context header as first-class metadata. Chunks point at their version and segments. |
| `source_upload_intents` | Two-phase upload records: token key, storage key, expected and uploaded size and hash, status, and expiry. |
| `study_material_folders` | Study material folder tree inside one notebook. Soft delete through `deletedAt`. |
| `study_materials` | Generated artifacts. One kind, JSON content and options, optional folder, soft delete. |
| `generation_requests` | Persisted generation streams with status, brief, selected source ids, and target folder. |
| `notebook_chat_messages` | Chat history with role, content, reasoning, parts, metadata, and citations. |
| `retrieval_traces` | One retrieval trace per Chat turn and per Study Material Generation retrieval pass: query, query-understanding decision and queries, ranked candidates per leg, fusion knobs and fused order, reranker model and scores, chosen chunks, thresholds, latency, and token cost. Correlation ids are not foreign keys so a trace survives a turn that failed before its row was written. |
| `jobs` | Generic Postgres job queue: type, group key, payload, status, attempts, backoff, and schedule. |
| `app_settings` | Singleton row with encrypted gateway and Voyage keys, and the indexing representation key last applied by a reindex-all run. |

Dead tables: `source_index_jobs` and `web_search_jobs` still exist in the schema but no code reads or writes them. All background work uses `jobs`.

## 5. Backend architecture

### Modules

`AppModule` (`backend/src/app.module.ts`) wires Database, Jobs, Storage, AI, Notebooks, Sources, Chat, and StudyMaterials. Crawler is imported by Sources only.

- **DatabaseModule** provides the Drizzle client and pg pool.
- **JobsModule** provides the Postgres-backed queue.
- **StorageModule** provides S3-or-local storage and signed local downloads.
- **AiModule** owns the gateway provider, model catalog and sync, embeddings, chunking, indexing, the retrieval pipeline and its trace persistence, and connection state.
- **NotebooksModule** owns notebooks, banners, and the library folder tree.
- **SourcesModule** owns ingestion, uploads, extraction, versioning, processing and indexing handlers, and web search.
- **ChatModule** owns RAG chat streaming, citations, and message persistence.
- **StudyMaterialsModule** owns generation, CRUD, folders, trash, slide previews, and PPTX export.

### Background jobs

`backend/src/modules/jobs/job-queue.service.ts` polls every 3 seconds. Global concurrency is 4 with per-handler caps. Claims use `FOR UPDATE SKIP LOCKED`. Retries use exponential backoff (`base * 2^(n-1)`, 3 attempts). A `groupKey` controls conflicts: cancel existing, replace, or enqueue always.

Handlers: `source_processing` (concurrency 1), `source_indexing` (2), `source_reindex_all` (1), `web_search` (2). The model catalog refreshes every 6 hours.

### Versioned reindex

`CHUNKING_VERSION` (2) and `INDEX_PROCESSING_VERSION` (2) describe the chunk and indexing representation. On startup, SourcesModule probes the configured embedding path (a capability failure flips the process to the fallback, so the key below reflects the model documents and queries will actually use) and then compares the chunking and indexing versions plus the effective embedding model and dimensions against the `app_settings.indexing_representation` bookmark. When they differ — and a Voyage key is configured, so the fan-out cannot only fail and mark Sources failed — it enqueues one `source_reindex_all` job; the job fans out one `source_indexing` job per eligible Source through the existing queue and records the new representation key only once the fan-out succeeds, so a failed fan-out is retried on the next startup. Degraded sources are skipped. Each per-Source job re-embeds and replaces its chunks atomically, and its `shouldSkip` check treats a stale processing version, chunking version, or embedding model as work to do, so a version bump rebuilds every Source without manual per-source reindexing and a repeated fan-out is idempotent. The settings page's re-embed action queues the same fan-out job.

### Streaming

- Chat: `POST /api/notebooks/:id/chat` streams AI SDK UI messages over SSE. A client disconnect aborts the model call, and partial text and reasoning are persisted.
- Generation: `POST /api/notebooks/:id/generate` streams NDJSON. The controller always writes a terminal `{done:true}` or `{error}` frame before it closes.

### Errors

Domain errors carry an HTTP status, a code, and a `messageKey` for frontend translation (`backend/src/common/errors/`). The exception filter renders them. Only English and Spanish are supported. Job failures store a `messageKey`, not a raw message.

### Invariants

- Chunk replacement is atomic. Old chunks are deleted only after embeddings succeed, inside a transaction fenced on job status, source version, content hash, and raw text.
- Indexing is idempotent through a `shouldSkip` check on content hash, processing version, and embedding model and dimensions.
- Chunking is structure-aware and token-based: `CHUNK_TARGET_TOKENS` (default 320) is the size packing aims for, `CHUNK_MIN_TOKENS` (default 96) is the floor below which a fragment merges into its neighbour, and `CHUNK_OVERLAP_TOKENS` (default 48) is repeated from the previous chunk. Boundaries follow paragraphs, then sentences, then words; a section (source segment) never merges into another. Fragments below the minimum merge within their section; a whole sub-minimum section (a slide title, a short transcript line) stays its own chunk so the citation keeps its heading path and locator. Every chunk stores the document and section context header derived from the source title, the source kind, and the segment heading path. The searchable text is that header plus the body; the stored body remains the text shown to the model and used for citations.
- Documents are embedded with contextualized chunk embeddings (`voyage-context-4`, 1024 dimensions): one Source's ordered chunks go to the provider as one group, so each chunk encodes its document context. Before the reindex-all check, a boot-time capability probe tries the contextual endpoint; if the key or plan cannot use the model (HTTP 400/403), the probe flips the whole process to the pre-contextual `voyage-4` path, and the changed representation key rebuilds the corpus with it. Transient probe failures (rate limit, outage, invalid key) keep the configured path, and the settings save flow verifies a new key against the active path. `EMBEDDING_CONTEXTUAL_ENABLED=false` selects the fallback explicitly. Documents and queries always switch together. All supported models share 1024 dimensions, so the HNSW index and the idempotency keys stay valid.
- Ingestion runs a content-quality gate after normalization. A version whose text is mostly links, repeated boilerplate, or a paywall interstitial is marked degraded with a reason and is not indexed. Retrieval excludes degraded sources, so they are never presented as Evidence.
- Web extraction retries with a looser main-content heuristic when the first extraction is link-dense or below the length floor, choosing the least link-dense candidate.
- Retrieval is a single pipeline entry point shared by Chat and Study Material Generation. It returns the Evidence together with a structured trace (query, query-understanding decision, ranked candidates per leg, fusion knobs and fused order, reranker model and scores, chosen chunks, applied thresholds, latency, and token cost), and it never stores provider keys or the query embedding. Every retrieval a Chat turn or a Generation performs persists its trace in `retrieval_traces`; a turn with no text to embed and a Generation with no selected sources retrieve nothing and record no trace. Before the legs run, query understanding rewrites the message into a search query (`RETRIEVAL_REWRITE_MODEL`, default `openai/gpt-4o-mini`): it strips tone, length, and format instructions, resolves follow-up references such as "expand on the second chapter" from the recent chat turns the Chat passes with the request, and, for short or ambiguous messages, can fuse up to `RETRIEVAL_REWRITE_VARIANT_COUNT` paraphrases through the same Reciprocal Rank Fusion and embed a hypothetical answer instead of the query (`RETRIEVAL_REWRITE_HYPOTHETICAL_ANSWER`, default off). The stage is skipped when the message already reads as a search query, runs within `RETRIEVAL_REWRITE_TIMEOUT_MS` (default 1200 ms), and degrades to a deterministic heuristic on timeout, failure, or an unconnected gateway, so a rewrite never fails the turn; the decision, the queries that ran, and the reason are recorded in the trace's `rewrite` block (trace version 4). Each leg over-fetches `RETRIEVAL_CANDIDATE_DEPTH` chunks (default 32, overridable per leg with `RETRIEVAL_DENSE_CANDIDATE_DEPTH` / `RETRIEVAL_LEXICAL_CANDIDATE_DEPTH`): the dense leg is a pgvector cosine search, and the lexical leg is a full-text search over the chunk's generated `tsvector`, built with the `simple` configuration so no stemming corrupts identifiers or mixed-language terms. The legs are fused with Reciprocal Rank Fusion (`RETRIEVAL_RRF_K`, default 60; per-leg weights `RETRIEVAL_RRF_DENSE_WEIGHT` / `RETRIEVAL_RRF_LEXICAL_WEIGHT`; each query variant contributes equally), near-duplicate candidates are removed, and the survivors are reranked with the Voyage cross-encoder (`RETRIEVAL_RERANK_MODEL`, default `rerank-2.5`) over the chunk's contextual searchable text. A reranked Evidence set is gated by `RETRIEVAL_RERANK_THRESHOLD` (default 0.4) and bounded by `RETRIEVAL_TOP_K` (default 8); when reranking is disabled, unavailable, fails, or the deduplicated candidate set exceeds the provider's per-request document limit, the pipeline falls back to the fused order gated by the cosine floor (`RETRIEVAL_RELEVANCE_FLOOR`, default 0.3) and still answers. The reranker score is trace-only: the score shown in the Evidence block stays the retrieval score. Chunks below the applied threshold are dropped; when nothing clears it, retrieval returns an explicit below-threshold or empty abstention result instead of weak Evidence. The Chat then answers with a deterministic no-evidence reply — no model call — that names the degraded or unhelpful sources, suggests a corrective action, and is persisted with metadata that drives a visually distinct, citation-free UI state. General knowledge is never presented as grounded in Sources. Chat sends at most the last 6 history messages and 80,000 characters of evidence.
- Study Material Generation grounds on the retrieval pipeline over the selected sources. Retrieval is planned per section: every distinct heading path of a selected source gets a pass (capped per source, and grouped into contiguous buckets when a source has more sections than the cap, so no section is dropped from the plan), and the pass query names the brief, the source title, and the bucket's headings. A source without heading paths is one section. Each source's evidence budget is spent round robin across its passes, so a long source's evidence spans its range instead of clustering at the head, and each selected source keeps its own budget, so a multi-source Generation does not lose the tail of the selection order. The relevance floor and rerank threshold do not apply because the selection defines the scope. A Generation with no selected sources does not retrieve and generates from the brief alone. The prompt budget is split fairly across the selected sources, so a source at the end of the selection order is never dropped wholesale. A Generation persists one retrieval trace per pass, all correlated by the generation request. Generated materials carry the citations the model actually emitted, mapped to retrieved chunks by the same extractor the Chat uses; an unresolvable or invented key is dropped, and the citations are attached by the server, never authored by the model. A selected source that contributes no evidence (deleted, failed, degraded, or not indexed) is reported with the selected-sources-unavailable error for every material kind, not only study guides.
- Citations only match evidence keys emitted in the same reply. Display numbers follow first appearance. Excerpts are capped at 500 characters and URLs are forced to http(s).
- Model substitution is forbidden. If the gateway serves a different canonical slug, the request fails with `model_substituted`. There is no fallback-model chain.
- `structuredOutput` is a hint only. Generation first tries native structured output, then a strict-JSON prompt with staged repair.
- Generation limits: quiz ≤ 50 questions, practice problems 1–30, case study 1–10 questions, slides ≤ 20, roadmap phases ≤ 50, mind map nodes ≤ 100. Each selected source contributes at most 16 chunks to the prompt, and the 100,000-character prompt budget is split fairly across the selected sources.
- Upload intents expire after 15 minutes. Finalize is exactly-once through a `consuming` claim, and the byte count is mandatory.
- SSRF protection blocks private, loopback, link-local, CGNAT, and metadata addresses; only ports 80 and 443 are allowed; embedded credentials are rejected; DNS failure is fail-closed.

### Storage

Keys are content-addressed: `sources/<sha256><ext>`, `banners/<sha256><ext>`, and staging keys `pending-sources/<token>`. Local mode serves files through HMAC-signed `/api/dev-storage/:key` links. S3 mode uses presigned URLs.

## 6. Frontend architecture

### Layers

| Layer | Rule |
| --- | --- |
| `src/routes/` | Thin TanStack file routes. Only `createFileRoute` plus a page component re-export. |
| `src/pages/` | Route-level screens that compose layout and features. |
| `src/features/` | Domain modules with `api/`, `components/`, `hooks/`, `model/`, `context/`, `schemas/`, `shapes/`, `types/`, `utils/`, and an `index.ts` barrel. |
| `src/components/` | `ui/` shadcn primitives, `layout/` app shell, `feedback/` shared states. |
| `src/shared/` | Cross-feature API client, i18n, and utilities. |
| `src/app/` | Composition root: providers, router, app shell. |

Features: `ai`, `language`, `notebook-chat`, `notebook-library`, `notebooks`, `settings`, `sources`, `study-material-generation`, `study-material-tree`, `study-material-viewer`, `theme`.

### Routing

TanStack Router with file-based routes and automatic code splitting. `/` is the library, `/notebooks/$notebookId` is the workspace, and `/settings` holds the settings pages. There is no auth route, no 404 route, and no error component.

### State and data

- Server state: TanStack Query, `staleTime` 30 seconds, no refetch on window focus.
- API client: `frontend/src/shared/api/api-client.ts` always sends credentials and maps backend error keys to localized `ApiError`s.
- Zustand stores: pending uploads (`features/sources/hooks/upload-store.ts`) and background generations (`features/study-material-generation/hooks/use-generation-store.ts`).
- Contexts: notebook model, palette, prompt input, reasoning, and message branches.
- Persistence: localStorage for the selected model, palette, scheme, expanded tree folders, and case study progress.
- Streaming: chat uses the AI SDK `useChat` with a default transport. Generation uses a raw NDJSON reader with an abort controller. Sources poll every 1.5 seconds while processing, web search every 2.5 seconds, and the connection check every 15 seconds.

### i18n

i18next with 11 namespaces in English and Spanish under `frontend/src/shared/i18n/locales/`. Only `common` is preloaded; the rest load lazily. Keys are extracted with `pnpm --filter frontend run i18n:extract`; types are generated into `frontend/src/@types/`. The interface language also sets the base language for chat and generation prompts.

### Styling and theming

Tailwind CSS v4 with no config file. `frontend/src/styles/globals.css` holds the import order, the `@theme inline` token mapping, and the default light and dark variables. The other files in `src/styles/` hold app tokens, the five extra palettes, element defaults, custom utilities, component styles, dark overrides, reduced-motion rules, fonts, and typography styles.

Appearance has two independent axes: the scheme (light, dark, system) and the accent palette (default, tide, grove, dune, ember, plum). Custom one-off styles are declared as `@utility` rules in `src/styles/utilities.css`.

The shadcn lint plugin runs in oxlint (`frontend/.oxlintrc.json`) with five rules: `no-raw-colors`, `no-arbitrary-values`, `no-inline-styles`, `no-unknown-classes`, and `require-static-classes`. The policy: appearance values must use theme tokens or named utilities; `no-arbitrary-values` allows the `layout` category; `no-inline-styles` allows only the dynamic `--scheme-*` and `--tg-*` properties. Two rules are disabled inside `src/components/ui/**` per the plugin docs.

## 7. End-to-end behavior

### Library

`GET /api/library` returns folders and notebooks with presigned banner URLs. The UI shows one folder level at a time with breadcrumbs. Sorting is by name, update time, or creation time, with folders first. Drag and drop moves notebooks and folders, and blocks self or descendant drops. Inline rename commits on Enter or Cmd/Ctrl+Enter and cancels on Escape. Create, rename, move, and delete are optimistic with rollback and toasts.

### Notebook workspace

Desktop shows three resizable panes: sources, chat, and studio. Mobile shows tabs and full-screen overlays. Opening a source replaces the sources pane body with the content viewer. Reviewing a material collapses the sources pane and expands the studio. The header edits the title, description, icon, and banner. Banner variants are generated in the browser and stored with the focal point.

### Adding sources

- **Text**: up to 5 MB, indexed after synchronous normalization.
- **URL**: acquired with Firecrawl or a direct fetch, with SSRF checks and a 15-second timeout. YouTube is handled as video.
- **File**: two-phase upload. The client creates an upload intent, uploads the file, then finalizes. Limits: image 20 MB, audio 500 MB, video 1 GB, PPTX and EPUB 200 MB, tabular 100 MB, default 50 MB.
- **Web search**: candidates are discovered with Firecrawl and imported one by one. Import requires at least 1000 characters of scraped text and deduplicates by URL.

Processing stages are uploading, extracting (or transcribing for audio and video, then analyzing visuals), and indexing. Failures retry up to 3 times, then the source is marked failed. The user can retry, cancel, or reindex. Transcripts can be replaced, which creates a new version and reindexes. After extraction, every prose source passes a content-quality gate: a source that is mostly links, repeated boilerplate, or a paywall message is marked degraded instead of ready, the reason is shown in the Sources pane with a corrective action, and it is not indexed as Evidence. Retrying a degraded source re-runs extraction so the gate can re-evaluate it.

### Chat

The composer sends the message list, the selected model, and the base language. The backend rewrites the message into a search query with the recent turns as context, over-fetches candidate chunks from the dense and lexical legs, fuses their ranks, reranks the fused set with the cross-encoder, selects the top `RETRIEVAL_TOP_K`, builds evidence keys, persists the retrieval trace for the turn, and streams the reply with reasoning. When nothing clears the applied threshold, it skips the model and streams the no-evidence reply instead. The assistant message is persisted with its citations. The UI renders citation markers as popovers with a locator, an excerpt, and an action to open the source. Unused citations appear as a chip row. History is stored per notebook and can be cleared; clearing it also clears the notebook's Chat traces.

### Generation

The generate dialog asks for options and a brief, then streams NDJSON. Grounding comes from the retrieval pipeline over the selected sources: retrieval is planned per section of every selected source (one pass per heading path, capped and bucketed), each source's evidence budget is spent round robin across its passes, and the Generation persists one retrieval trace per pass. Every selected source that contributes no evidence is reported with the selected-sources-unavailable error before the stream starts. The model is shown each retrieved passage with an evidence key and is asked to end source-backed sentences with `[ref:Rn]`; the server then attaches the citations that resolve to retrieved chunks, so an invented key never reaches the material. Generations continue in the background store if the dialog closes. A 5-minute stall timeout and a cancel action are available. When a generation completes, the tree refreshes and a toast offers to view the material. Disconnecting aborts the server generation.

### Study material tree and studio

Folders come first, then materials, both by creation time. Drag and drop moves items and auto-expands folders on hover. Keyboard navigation supports arrows, Home, End, Enter, and F2. Duplicate appends " copy". Delete moves items to the trash; the backend supports restore and permanent delete. Quizzes can be shuffled. Slides export to PPTX.

### Material viewer

Each kind has its own view: flashcards flip and navigate, quizzes run active → summary → review with a retake, roadmaps show a timeline and copy topics to chat, mind maps pan and zoom, slides show previews and notes, study guides render markdown sections with a table of contents, case studies persist progress in localStorage, and practice problems evaluate answers through the AI. Most viewers can hand off to chat with a prefilled prompt. Only case study progress is persisted by design.

### Settings

The gateway card verifies and stores the key, shows credits, and refreshes the model catalog. The embeddings card verifies and stores the Voyage key and can re-embed all sources. Appearance selects the scheme and palette. Language selects English or Spanish.

## 8. Limits and edge cases

- `SOURCE_LIMIT = 300` per notebook is enforced only on web-search import. Direct creation does not check it; the UI only meters it.
- Chat keeps the last 6 history messages and 80,000 characters of evidence.
- Study material folders cannot be deleted while active materials exist in the subtree. Delete soft-deletes the whole subtree, but restore only undeletes the folder itself.
- Library folder delete is a hard delete. Children are re-parented to the grandparent, and cycles are rejected.
- Moving a material into a trashed folder is rejected.
- Slide previews are derived on read and self-healed, and are stripped before PPTX export.
- Upload intent rows and orphan objects have no sweeper. They are cleaned lazily when a token is used.
- The `web_search` job has `maxAttempts = 1`, so transient search failures are terminal.
- The `ai` npm package is pinned exactly to `7.0.91` on purpose (7.0.92 was republished broken).

## 9. Known rough edges

These are real gaps, not plans:

- No library search UI, even though `GET /api/notebooks?search=` exists.
- No trash UI. Trash is fully implemented on the backend, but the user cannot restore or permanently delete from the app.
- Speaker rename is broken end to end: the UI sends `{from, to}` while the backend expects `{speakerMap}`. The UI swallows the error and keeps local state (`frontend/src/features/sources/components/renderers/audio/use-audio-segments.ts:104`).
- `AiService.searchWeb` (an LLM web-search tool) is dead code; notebook web search uses Firecrawl.
- The shared `use-brief-wizard` hook is used by only four of the nine per-kind brief forms; the others manage their own step state.
- Library folder delete is optimistic in the UI with re-parenting, but the server sets notebooks' folder to null and cascades subfolders. The cache can diverge until the next fetch.
- The React Doctor workflow at `frontend/.github/workflows/react-doctor.yml` does not run: GitHub only reads workflows from the root `.github/workflows`, which holds the `Quality` gate.
- No pre-commit hooks. The quality gate is manual or agent-driven.
- No React error boundaries.

## 10. Testing and quality gates

- Frontend: Vitest with jsdom. Tests are colocated as `src/**/*.test.ts(x)`. `frontend/src/test/setup.ts` preloads all English namespaces and polyfills browser APIs. Do not remove the preload; components suspend without it.
- Backend: Vitest with a disposable pgvector database on port 5499 (`.env.test`). On a fresh database, run `db:migrate` with the test `DATABASE_URL`, then `test:db:setup`. Never point `.env.test` at the development database; tests truncate tables.
- Gate: `pnpm run lint` → `pnpm run typecheck` → `pnpm run test`. Test only what changed.
- Retrieval evaluation: `backend/tests/retrieval-eval.test.ts` runs the labeled golden set against the test database through the real pipeline, including a keyless deterministic rewrite model, and fails when a metric drops beyond the documented tolerance, when the lexical leg or reranker is disabled, or when query understanding is disabled. See [retrieval-evaluation.md](retrieval-evaluation.md).

## 11. Conventions

- Conventional Commits with lowercase imperative subjects. Scopes seen: `frontend`, `ai`, `study-materials`, `study-material-generation`, `notebook-library`, `notebook-folders`, `build`, `env`, `lint`, `agents`, `plans`.
- Generated files: `frontend/src/routeTree.gen.ts` (TanStack Router), `frontend/src/@types/i18next.d.ts` and `resources.d.ts` (i18next-cli), and `backend/drizzle/*.sql` with `meta/` (Drizzle). Do not hand-edit migrations without updating the journal.
- `frontend/components.json` is the shadcn CLI metadata: style `base-rhea`, Base UI primitives, `@/components/ui` alias.
- `frontend/.visual-harness/` is a standalone visual harness. It is not a workspace package.
