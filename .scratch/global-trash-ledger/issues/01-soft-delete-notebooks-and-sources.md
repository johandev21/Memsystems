# 01 — Soft-delete individual Notebooks and Sources into 30-day Trash

**Status**: Ready
**Blocked by**: None

## Goal
Deleting an individual Notebook (`DELETE /api/notebooks/:id`) or an individual Source (`DELETE /api/notebooks/:notebookId/sources/:id`) performs a 30-day soft-delete (`deletedAt = now()`) instead of an immediate hard delete + S3 purge, matching existing folder and Study Material behavior.

## Scope & Requirements
1. **Notebook Deletion (`DELETE /api/notebooks/:id`)**:
   - Soft-delete the Notebook by setting `deletedAt = now()`.
   - Cascade `deletedAt` in a single transaction to:
     - Its Source Folders (`source_folders`)
     - Its Sources (`sources`)
     - Its Study Material Folders (`study_material_folders`)
     - Its Study Materials (`study_materials`)
   - Preserve banner images and S3 assets until permanent purge (30-day retention or manual hard delete).
   - Cancel active ingestion/processing jobs for sources within the notebook if applicable.
2. **Source Deletion (`DELETE /api/notebooks/:notebookId/sources/:id`)**:
   - Soft-delete the Source by setting `deletedAt = now()`.
   - Cancel any active ingestion / crawler / embedding jobs for that source.
   - Preserve S3 raw/parsed objects until permanent deletion or 30-day cron purge.
3. **Query Filtering**:
   - Ensure list/get queries across notebooks and sources filter out soft-deleted items (`isNull(deletedAt)`).
   - Verify retrieval/chat grounding ignores soft-deleted notebooks and sources.
4. **Verification**:
   - Unit & integration tests in backend (`pnpm --filter backend exec vitest run ...`).
   - Lint & typecheck verification across backend and frontend.
