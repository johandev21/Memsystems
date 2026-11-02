# Backend modularity and readability plan

Status: approved for implementation. GPT-6 Luna workers at medium reasoning effort perform scoped changes under orchestrator integration and verification.

For the current working tree, verification state and executable continuation steps, read [the refactor handoff](backend-refactor-handoff.md).

Reviewed against commit `1900d04` on 2026-11-02. Source and test inspection only; no tests were run.

## Implementation progress

- First integrated batch: file classification, per-kind content normalization, document normalization adapters, grounding budgets/filtering/brief interpretation, slide design resolution, and preview text/legacy layouts extracted.
- Incremental file-size/comment guard added with a baseline from the original commit and strict mode for completion. Its self-check covers comment-like literals and comments inside empty objects, arrays and calls.
- First batch validation passed: repository lint, frontend/backend typecheck, and 17 mapped backend test files (196 tests), including retrieval and generation evaluation gates. Existing frontend lint warnings remain.
- The broad refactor is incomplete. Grounding and preview rendering still exceed the size target; chat, streaming, remaining source responsibilities, capability ownership, lifecycle/archive/schema organization, large tests, final comment cleanup and final application verification remain.

## Objectives and constraints

The requested scope is a broader backend redesign with behavior preservation. The user requires approachable file size, no comments in maintained code, and a clean, intuitive folder structure that other developers can navigate and maintain.

Proposed acceptance rules:

- Every maintained TypeScript file in `backend/src/` and `backend/tests/` stays below 500 physical lines, including blanks. Most implementation files should be approximately 150–300 lines; smaller files are fine when their responsibility is complete.
- Split by responsibility and domain vocabulary. Do not compress formatting, hide large implementations in strings, or create numbered continuation files to satisfy the limit.
- Maintained backend source, tests, scripts and configuration contain no explanatory comments, JSDoc, TODOs, commented-out code or section dividers. Names, types, explicit control flow and focused tests communicate intent; architectural rationale and operating instructions live in linked Markdown documentation.
- Resolve comment-based compiler/linter directives through appropriate typing or equivalent configuration before removing them. Do not weaken checks globally. Preserve OpenAPI descriptions and other generated contract metadata through explicit declarations when removing documentation comments.
- Folder names identify a domain capability or recognizable operation. A developer should be able to locate a behavior without knowing an abstract layering scheme.
- A coordinator reveals the operation's consequential steps. Extracted details have specific names, live with their owner, and can be understood without following a chain of pass-through wrappers.
- Feature dependencies are explicit and acyclic. Ordinary callers use the owner's public capabilities rather than its private persistence implementation.
- HTTP contracts, streaming protocols, persisted data, transaction boundaries, cancellation, failure behavior, model prompts, and retrieval results remain equivalent.
- Keep a single process and database. No framework replacement, new messaging system, universal repository hierarchy, or database migration is required by this plan.

Generated artifacts and historical migrations are outside the file-size rule. Hand-maintained fixtures, templates, and policy tables remain in scope: group them by meaningful kind or scenario. A temporary size baseline permits incremental delivery but must reach zero violations at completion.

## Current findings

The existing `modules/` feature organization is useful. The problem is both oversized responsibilities within features and ownership leaking between them.

- `ChatService.sendMessage` starts at `backend/src/modules/chat/chat.service.ts:411` and spans approximately 690 lines: branch decisions, transactional writes, retrieval, input mapping, streaming, and final persistence.
- `generation/stream-handler.ts:275` and `:450` duplicate the successful finalization pipeline in native output and JSON fallback. The same class also synthesizes and persists audio.
- `generation/generation-grounding.ts` combines source queries, brief interpretation, budgets, sampling, retrieval passes, deduplication, citations, and formatting.
- Generation imports evidence/citation logic from `chat/chat-citations.ts`; reusable evidence behavior currently has a consumer as its owner.
- `SourcesService` repeats file classification with upload creation. Processing routing has different historical precedence, so these policies cannot simply be merged.
- Global retention runs inside `study-materials/trash.service.ts:38`, while `trash/` coordinates global restore and permanent deletion.
- Notebook archive import crosses feature data intentionally, but parsing, remapping, storage effects, and transactional persistence are mixed. Export also owns Express response handling.
- `AiModule` is global and exports many capabilities. Some consumers therefore omit the dependencies from their module imports.
- Existing tests cover substantial branch, source lifecycle, grounding, generation, archive, and trash behavior. Test presence does not establish that they currently pass.

## Proposed ownership model

Retain feature-first organization under `backend/src/modules/`. The following names describe intended capabilities; directory names can be finalized during discussion.

| Owner | Responsibility | Boundary |
| --- | --- | --- |
| `notebooks` | Notebook settings, library folders, banner behavior, notebook access checks | Does not import its higher-level consumers |
| `sources` | Sources, versions, segments, upload intents, acquisition/extraction, source jobs and index writes | Owns current-version and cancellation checks for chunk replacement |
| `gateway` | Gateway connection, model catalog/capabilities, request options, Gateway error translation, model execution integrations | Extracted from the current AI umbrella; consumers keep their own workflow policy |
| `embeddings` | Embeddings connection and Voyage integration, shared embedding/chunk preparation capabilities | Explicit dependency of indexing and evidence retrieval; no dependency on source workflows |
| `evidence` | Retrieval, query understanding, ranking, Evidence Assembly, traces and reusable citation verification | Reads the source/index projection without importing `SourcesModule`; does not mutate source lifecycle |
| `chat` | Branch model, turns, message persistence, chat stream lifecycle, chat citation presentation | Uses notebook/source reads, evidence and Gateway capabilities |
| `study-materials` | Material tree, per-kind content, generation, audio/slides completion | Generation remains a cohesive subfeature here; uses evidence and Gateway capabilities |
| `notebook-transfer` | Portable `.memsys` import/export | Aggregate coordinator with an explicitly permitted transaction across notebook data |
| `notebook-lifecycle` | Notebook-wide deletion/restoration spanning sources and materials | Higher-level coordinator importing feature owners; retains a shared transaction for each existing atomic operation |
| `trash` | Global trash listing, retention, permanent deletion and restore coordination | Uses feature lifecycle capabilities and notebook-wide coordination; features do not import it |
| Infrastructure | Database, storage, job scheduling, application configuration | Retains established homes; contains no feature decisions |

The key dependency direction is composition → feature owners → lower-level capabilities/infrastructure. Sources and evidence can share an index data contract without importing each other's runtime modules. An index read projection is a deliberate exception to exclusive table access, not permission for callers to modify another owner's rows.

Keep physical table declarations grouped centrally under `database/schema/`, with a stable export entry point. Logical ownership does not require moving every table into a feature directory.

For notebook transfer and notebook lifecycle, do not replace existing atomic operations with serial calls to independently committing services. Pass the same transaction executor to the few participating persistence operations, or retain a dedicated aggregate writer with cross-table access documented in Markdown. Keep remote storage and job effects in their current order relative to commits.

`AiModule` can temporarily re-export extracted capabilities to keep migration slices small. Remove the compatibility module once consumers use explicit imports. Do not register the same stateful service again in each consumer. Keep database/configuration globally available initially if useful; removing every global infrastructure module is not a goal.

## Folder navigation and comment-free implementation

Use a stable feature entry point and introduce subfolders only for cohesive groups. Proposed shape:

```text
backend/src/
  app.module.ts
  database/
    connection.ts
    schema.ts
    schema/
  common/
  modules/
    notebooks/
      banners/
      dto/
    sources/
      acquisition/
      extraction/
        normalization/
      indexing/
      uploads/
      jobs/
    gateway/
    embeddings/
    evidence/
      retrieval/
      citations/
    chat/
      branches/
      history/
      streaming/
      dto/
    study-materials/
      generation/
        grounding/
        streaming/
      content/
      audio/
      slides/
    notebook-transfer/
      import/
      export/
    notebook-lifecycle/
    trash/
    database/
    jobs/
    storage/
```

This illustrates ownership and navigation, not a requirement to create empty folders. Keep the existing distinction between database declarations/connection and the Nest database wiring module. Keep small features flat. Within a feature, keep entry points easy to identify; use domain-based filenames and consistent suffixes such as `.controller.ts`, `.service.ts`, `.types.ts` and `.schema.ts` where accurate. Avoid generic `utils`, `helpers`, `managers`, `impl` or global `services` buckets. Do not impose `domain/application/infrastructure` folders on every capability. Tests mirror feature names and split by behavior; implementation and tests for a responsibility should be easy to find together.

Apply the no-comments policy during each extraction, then sweep the remaining maintained backend code. Before removing a comment that describes a non-obvious invariant, make the invariant visible in the operation name, type, control flow or behavioral test; retain supporting rationale in Markdown when useful. Test names remain descriptive executable strings. Prompts, URLs, regular expressions and literal HTML/SVG or source-text fixtures are data and must not be altered by a naive comment-removal regex.

Use syntax-aware detection for enforcement. Existing parser files contain lint directives and `eslint.config.mjs` uses `@ts-check`; replace those mechanisms deliberately before deleting their comments. File-size enforcement is independent: deleting comments alone does not complete a responsibility split. Vendored dependencies and generated outputs are outside maintained-code cleanup; frontend changes are outside this backend refactor.

## Complete oversized-source backlog

These are all 20 source files above 500 lines at inspection. Counts are physical lines and will change during implementation. Each row can require several reviewable changes.

| Current file under `backend/src/` | Lines | Cohesive destinations |
| --- | ---: | --- |
| `modules/study-materials/generation/generation-grounding.ts` | 2,315 | Grounding coordinator, source read projection, budgets, brief intent, section targeting, sampling, evidence deduplication, prompt formatting |
| `modules/study-materials/slides/slides-preview.ts` | 1,384 | SVG text/layout primitives, element rendering, scene rendering, legacy rendering, preview assembly |
| `modules/chat/chat.service.ts` | 1,356 | Branch planning, branch persistence, history projection, model input mapping, stream execution/finalization, coordinator |
| `modules/ai/retrieval/retrieval.service.ts` | 1,032 | Retrieval coordinator, candidate SQL access, config/types, row mapping and trace construction; reuse existing ranking/assembly modules |
| `modules/study-materials/generation/stream-handler.ts` | 993 | Prompt assembly, native/fallback execution, finalization, stream framing/guard lifecycle, audio completion |
| `modules/sources/sources.service.ts` | 968 | Source reads, creation, transcript/speaker operations, lifecycle commands; keep simple operations direct |
| `modules/trash/trash-ledger.service.ts` | 927 | Root selection/list projection, pagination, restore coordinator, permanent-delete coordinator, feature-owned cleanup operations |
| `modules/sources/extraction/document-normalizer.service.ts` | 915 | Normalized document types, text/web normalization, document-format adapters, media/transcript adapters, common hashing/assembly |
| `modules/study-materials/slides/slides-design-resolver.ts` | 852 | Design presets, token validation, legacy conversion, element normalization, scene/deck resolution |
| `database/schema.ts` | 830 | Tables grouped by capability, dependency-safe enum/types, stable schema export entry point |
| `modules/ai/retrieval/query-understanding.ts` | 790 | Query policy/config, instruction cleanup, follow-up resolution, variant/hypothetical-answer planning, coordinator |
| `modules/chat/chat-citations.ts` | 773 | Shared evidence/citation verification under evidence; chat-specific stored citation and display mapping remain with chat |
| `modules/study-materials/content/content-normalizer.ts` | 770 | Per-kind content normalization plus a small dispatcher; shared sanitization only where actually reused |
| `modules/sources/extraction/video-inspector.service.ts` | 727 | Media probing, frame selection/extraction, video inspection coordinator, process cleanup |
| `modules/notebooks/notebook-import.service.ts` | 657 | Archive reader/types, compatibility interpretation, ID/hierarchy remapping, blob upload, transactional graph writer |
| `modules/sources/extraction/audio-inspector.service.ts` | 656 | Audio probing, conversion/segmentation, process/file lifecycle, inspection coordinator |
| `modules/notebooks/notebooks.service.ts` | 610 | Notebook core operations, response mapping, banner handling; aggregate lifecycle moves to its coordinator |
| `modules/sources/acquisition/youtube-acquisition.service.ts` | 567 | Acquisition coordinator, caption retrieval/parsing, media download, metadata mapping and fallbacks |
| `modules/study-materials/study-materials.controller.ts` | 542 | Route groups for CRUD/tree, generation, audio delivery and legacy trash; preserve paths/decorators/headers |
| `modules/sources/uploads/source-uploads.service.ts` | 527 | Intent persistence/claiming, upload verification, local upload handling, finalization coordinator |

Also inspect near-limit files when touching their feature: job queue (498), slide builder (489), caption parser (480), material service (463), AI service (450), tabular parser (443), processing handler (442), source policy (439), Voyage client (426), stream schemas (416), and sources controller (408). They must not absorb extracted responsibilities and become the next oversized files.

Test files need the same treatment: retrieval tests currently reach 2,641 lines and chat service tests 1,593. Split suites by behavior such as branch selection, cancellation, citations, retrieval policy, and provider fallback. Share only useful fixtures/setup; do not split assertions that explain the same scenario.

## Delivery sequence

Each phase is a sequence of small PRs. First move an intact responsibility with unchanged logic; reshape its flow in a subsequent diff when that makes preservation easier to review. No phase should leave production composition broken.

### 1. Establish the safety baseline and navigation rules

- Record current routes, response/errors, stream frame contracts, persisted formats and key lifecycle invariants.
- Associate each backlog row with its existing suites and the specific characterization gaps below. Add missing tests immediately before the corresponding extraction, rather than writing a speculative full new suite.
- Add a file-size check using the repository's existing tooling: no new oversized files; baseline existing violations; require each migrated area to leave the baseline. Count physical lines without formatting exclusions.
- Establish allowed feature dependency directions and a small import check that rejects private cross-feature imports and new cycles. Allow documented aggregate writers and evidence read projections explicitly.
- Establish the folder conventions and a comment inventory, including directives and any documentation used by tooling. Introduce declining comment violations alongside the size baseline, reaching zero in maintained backend code at completion.
- Preserve existing public exports during migration. Make module-composition validation possible without external model calls or duplicate background workers.

Exit: agreed architecture, folder and no-comments policies, known baseline, mapped tests, and independently enforceable incremental rules.

### 2. Extract pure policies and per-kind implementations

- Split grounding policy/formatting, content normalization, slide design and SVG rendering, document normalization, file classification and query-understanding helpers.
- Start with file classification as a small pilot, then complete the grounding split early: it is the largest readability obstacle.
- Use plain functions/types for deterministic policies. Injectable services are for dependencies or state, not every extracted function.
- Preserve policy constants, ordering, prompt text, XML escaping, legacy formats, errors and provenance.
- Split corresponding large tests by scenario as each capability moves.

Exit: the new files meet the cap; representative fixed inputs retain the same selected evidence/order, citation keys, formatted prompts, normalized content and SVG output.

### 3. Split persistence declarations and clarify transaction contracts

- Group schema declarations without changing table names, columns, enums, defaults, indexes, foreign keys, exports, or schema discovery.
- Keep the `schema.ts` import contract initially to avoid a repository-wide import rewrite in the same slice.
- Verify equivalent schema metadata and migration generation on disposable state; expected result is no DDL migration. Never apply a migration just to reorganize files.
- Reuse the existing `AppDatabase` type and introduce transaction executor typing only where extraction needs it. Replace casts and optional-transaction test accommodations after verifying their actual callers.

Exit: identical database schema/export behavior, no unintended migrations, and preservation of existing transaction scope.

### 4. Replace the AI umbrella with explicit capabilities

- Extract Gateway and embeddings ownership, then evidence retrieval/citation ownership. Keep existing connection caching, model sync schedules, default configuration and SDK call behavior.
- Move shared citation primitives out of chat, separating chat presentation policy from evidence verification.
- Move source index mutation into the sources capability. Keep embedding/chunk preparation available through the lower-level embeddings capability.
- Extract candidate SQL access from retrieval without changing search, fusion, thresholds or Evidence Assembly.
- Add explicit consumer module imports, audit exports and remove unused public implementations. Register scheduling once at application composition and preserve lifecycle ordering.
- Remove transitional AI re-exports after the final consumer migration. Do not combine this phase with provider/library upgrades.

Exit: runtime dependencies resolve through explicit imports; no dependency cycles, duplicate singleton state, worker registration, timers or cron jobs.

### 5. Rebuild chat around its operation boundaries

- Move HTTP payload interpretation beside controller/DTO code.
- Extract pure branch planning and a cohesive transaction-owning branch mutation operation. Keep conditional selection, preferred-child changes and losing-race cleanup together.
- Separate history projection/model input construction from stream execution and assistant finalization.
- Keep completion and abort persistence visible; preserve predetermined message IDs, trace association and endpoint-selection guards.

Exit: the main send flow is readable as accept → claim branch → ground → stream/abstain → persist; all chat files and touched tests meet the size cap.

### 6. Rebuild generation around one completion pipeline

- Extract prompt construction, stream framing/guard handling and native/fallback execution.
- Share successful content finalization after either output path: normalize → validate → quiz shuffle if applicable → prepare storage → check cancellation → save → finish.
- Keep fallback eligibility explicit and identical to the existing implementation. Audio synthesis failures are terminal; some unknown native-path persistence failures currently enter JSON fallback. Preserve that distinction during structural work and discuss changing it separately.
- Extract audio completion with existing synthesis, WAV checks, replacement and request locks intact.
- Keep per-kind policy with its kind and generation request lifecycle with generation. Do not introduce a generic strategy/plugin framework.

Exit: native and fallback paths retain equivalent behavior; valid audio exists before completion; cancellation/replacement guarantees remain intact.

### 7. Make source ingestion and upload workflows explicit

- Make processing read as load/check → resolve/extract → recheck → assess quality → persist version → conditionally hand off indexing → translate failure.
- Group media integration details into their source-owned adapters. Keep format precedence and quality exemptions visible in the extraction result.
- Separate upload intent locking, metadata reconciliation, finalization and release after failure. Preserve separate transactions/side effects.
- Keep `SourceVersionService` as the version/segment/current-version transaction owner. Keep chunk replacement, source/version locks and active-job validation together.
- Extract source creation and transcript/speaker operations; retain direct readable CRUD and existing queue retry/concurrency policy.

Exit: no superseded work can overwrite valid chunks through the extraction; modality, upload and cancellation behavior remain equivalent.

### 8. Move notebook transfer and lifecycle to their proper owners

- Move archive coordination into `notebook-transfer`; preserve existing endpoint URLs by relocating route handlers or using temporary adapters without introducing reverse dependencies.
- Separate archive interpretation/remapping, remote blob effects and atomic graph writing. Move Express streaming/headers to the transport boundary while preserving disconnect/error behavior.
- Move notebook-wide lifecycle coordination into `notebook-lifecycle`, above the participating feature modules, to avoid sources ↔ notebooks dependencies.
- Split global trash reads/pagination from mutation coordination; extract feature cleanup operations one entity kind at a time.
- Move global retention scheduling from study materials to trash. Verify exactly one scheduled execution and unchanged cutoff/cleanup behavior.
- Preserve the legacy study-material trash endpoints as distinct contracts; do not route them to global deletion blindly.

Exit: transfer and global trash no longer masquerade as unrelated feature responsibilities; atomic graph operations remain atomic.

### 9. Finish the size backlog and enforce the completed design

- Finish remaining oversized source/tests, including hand-maintained evaluation helpers and fixtures. Split near-limit files where a clear responsibility still warrants it.
- Remove temporary re-exports, compatibility adapters and outdated imports. Do not remove optional behavior until its actual callers are understood.
- Switch the size check from a declining baseline to the complete below-500 rule. No permanent blanket exemption for a difficult handwritten module.
- Complete the comment cleanup and enforce zero comments in maintained backend code. Preserve directive effects through types/configuration and verify generated contract metadata is unchanged.
- Document each feature's public capability and dependency direction concisely; link detailed behavior where needed.
- Review representative workflows from controller through side effects with the extracted modules open together. Check navigation cost as well as file size: can a developer locate branch selection, upload finalization, evidence budgeting and retention from the folder names, then read the operation without unexplained indirection?

Exit: zero oversized maintained TS files, zero comments in maintained backend code, intuitive folder navigation, enforced dependencies, passing mapped checks, no public contract or schema drift.

## Behavior preservation ledger

These details need tests or explicit review before the related move:

- **Chat:** explicit `null` means a root; retry IDs require equivalent payload/branch intent; branch claims use conditional writes; losing claims clean up; late replies cannot steal selection; partial text/reasoning survives abort; traces use the predetermined assistant ID; unsupported attachments fail at the same stage; model routing checks and stream error envelopes remain; chat verification does not add phantom citations.
- **Generation:** capability checks precede request creation; unavailable selected sources retain trace behavior; broad/focused source selection, budgets, pass ordering and concurrency stay unchanged; native/JSON recovery and no-output guard retain eligibility/timing; quizzes shuffle at the same stage; audio retry count, WAV validation, replacement IDs/folders and atomic persistence remain; completion/failure only transition eligible requests. Existing fire-and-forget callbacks must not become awaited accidentally.
- **Sources/jobs:** source versions remain immutable/idempotent; degraded sources persist their interpretation but do not become evidence; preserve tabular quality exemptions, filename/MIME precedence, limits and processing stages; video transcription/visual sequencing and frame deduplication remain; cancellation is checked around costly work and handoff; chunk replacement remains transactional; queue retries/backoff/group keys/concurrency/shutdown semantics remain.
- **Uploads:** finalization's row claim remains locked and single-use under its current contract; source creation, enqueueing and intent consumption are separate effects. Do not describe or implement stronger atomicity as part of a move.
- **Trash:** global versus legacy folder hard deletion differs; notebook restore currently revives independently deleted descendants too; nearest-live-ancestor placement, root filtering, timestamp/ID sort and missing-cursor behavior remain; preserve strict 30-day expiry and swallowed storage cleanup errors; cancel source job groups before row deletion.
- **Archives:** preserve `.memsys` layout, defaults, regenerated IDs/relations, chat exclusion, audio inclusion/validation, malformed optional collection fallback, missing-blob tolerance, invalid folder fallback, version selection, and hierarchy repair. Blobs upload before the graph transaction; rollback must not silently gain new compensation behavior.
- **Composition:** preserve initialization, source representation checks, model sync scheduling, queue startup and shutdown. Direct constructor tests do not prove Nest module wiring.

Suspected bugs and surprising behaviors go into a separate decision list. Structural PRs preserve them; a behavior correction gets its own proposal and tests.

## Verification and rollback

For each implementation slice follow repository order:

1. `pnpm run lint`
2. `pnpm run typecheck`
3. Targeted `pnpm --filter backend exec vitest run <mapped test paths>`

Mapped tests include consumers and integration paths, not just the file moved. Relevant existing suites cover chat branches/controller/citations, generation/grounding/audio, source processing/uploads/versions/indexing, jobs, notebook round trips, trash, and OpenAPI. Run the OpenAPI contract test when route/module/DTO composition changes and assert the committed document is unchanged.

For evidence/grounding changes run the existing deterministic retrieval and generation evaluation gates against their current baselines. Compare stable output semantics while controlling clocks/randomness where needed; elapsed timings need not be identical. Never refresh baselines to make a behavior-preserving refactor pass.

Use only the dedicated disposable test database at `localhost:5499/memsystems_test`; setup truncates tables. Follow `docs/testing.md` if provisioning is needed. Keep database-mutating test execution serial unless separate databases are provisioned.

Before risky extractions, add focused characterization for native/fallback finalization parity, terminal-event/cancellation races, late branch completion, upload failure release, legacy/global trash differences, restoration of independently deleted children, archive rollback, and singleton/scheduler composition where existing coverage is insufficient.

Keep each PR independently deployable/revertible. Prefer small coherent dependency migrations with temporary adapters over an all-at-once directory move. Because no data-format migration is intended, rollback should be a code revert; any slice requiring a data migration needs separate discussion.

## Decisions for agreement

1. Adopt the below-500 physical-line rule for maintained backend source and tests, with a 150–300 line working target and a temporary declining baseline?
2. Accept a modular monolith with explicit Gateway/embeddings/evidence capabilities and higher-level notebook transfer/lifecycle coordination?
3. Preserve current observable quirks during structural work and discuss fixes separately?
4. Start with the safety/size rules, a small source-classification pilot, and decomposition of generation grounding, then proceed through the staged ownership changes?

User-confirmed requirements: broader structural redesign, modular files, no code comments, intuitive folders, and maintainability for other developers. The user authorized implementation of this plan, including the below-500-line target and proposed ownership destinations. Comment cleanup applies to the backend scope of this plan, including its maintained tests/configuration/scripts.

## Documentation checked

- Requested skills: `backend-feature-architecture` (including boundary guidance) and `readable-backend`.
- Repository/backend guidance, domain vocabulary, testing and multi-agent guidance.
- [NestJS 11 modules](https://github.com/nestjs/docs.nestjs.com/blob/11.0.0/content/modules.md), fetched through Context7: imports/exports, encapsulation and shared provider instances.
- [Drizzle PostgreSQL schema organization](https://orm.drizzle.team/docs/sql-schema-declaration), fetched through Context7: grouping exported declarations across files.

Implementation and verification progress is tracked by the orchestrator. Initial inspection did not establish runtime health or current test pass status.
