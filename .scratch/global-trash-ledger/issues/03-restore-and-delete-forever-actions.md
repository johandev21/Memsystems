# 03 — Restore and Delete forever row actions across all Trash item kinds

**Status**: Blocked
**Blocked by**: `02 — Global paginated Trash ledger in the Library toolbar (Pure Ledger UI + infinite scroll)`

## Goal
Connect always-visible, closely spaced (`gap-0.5`) icon-only row actions (`RotateCcw` and `Trash2`, `size-7`, wrapped in `Restore` and `Delete forever` tooltips) to `POST /api/trash/:kind/:id/restore` and `DELETE /api/trash/:kind/:id`.

## Scope & Requirements
1. **Restore API (`POST /api/trash/:kind/:id/restore`)**:
   - Handles all supported kinds:
     - `notebook_folder`
     - `notebook`
     - `source_folder`
     - `source`
     - `study_material_folder`
     - `study_material`
   - **Recursive restoration**: Restoring a folder or Notebook recursively restores its cascaded contents (`deletedAt = null`).
   - **Re-rooting / Orphan Handling**: If an item's former parent folder was deleted (or is still deleted), re-root the restored item to the top level (`folderId = null` or notebook root) so it is immediately accessible.
2. **Delete Forever API (`DELETE /api/trash/:kind/:id`)**:
   - Permanently deletes the database row(s) in a transaction.
   - Cleans up associated storage artifacts in S3 / MinIO (banner images, source uploads, raw text, etc.).
   - Cancels any zombie background jobs.
3. **Frontend Row Actions**:
   - Icon-only actions: `RotateCcw` and `Trash2` buttons styled with `size-7` and `gap-0.5`.
   - Tooltips: Wrapped in `Restore` and `Delete forever` tooltips.
   - Confirmation dialog before hard delete (`ConfirmDeleteDialog`).
   - Optimistic updates or invalidation of trash and active library queries on mutation.
4. **Verification**:
   - Tests covering restore re-rooting, recursive restore, and permanent deletion with S3 cleanup.
   - UI tests for action trigger and confirmation dialog.
