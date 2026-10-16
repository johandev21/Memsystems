# 02 — Global paginated Trash ledger in the Library toolbar (Pure Ledger UI + infinite scroll)

**Status**: Blocked
**Blocked by**: `01 — Soft-delete individual Notebooks and Sources into 30-day Trash`

## Goal
Add `GET /api/trash?cursor=...&limit=30` returning top-level soft-deleted roots across all 6 tables and wire a **Trash** view toggle into the Library toolbar on `/` with infinite scroll, rendering the finalized **Pure Ledger (Variant A)** design.

## Scope & Requirements
1. **Backend Trash Endpoint (`GET /api/trash`)**:
   - Supports cursor-based pagination (`cursor=...&limit=30`).
   - Aggregates soft-deleted roots across all 6 tables:
     - `notebook_folders`
     - `notebooks`
     - `source_folders`
     - `sources`
     - `study_material_folders`
     - `study_materials`
   - **Root Filtering**: Filters out children whose parent folder or parent Notebook is also soft-deleted (only surface top-level deleted roots).
   - Returns uniform metadata per item: `id`, `name`, `kind` (`folder`, `notebook`, `source`, `study_material`, plus specific subkind like `pdf`, `quiz`, `flashcards`, etc.), `deletedAt`, `daysRemaining` (30 - days since deletion), `parentContext` (e.g. notebook name if applicable).
2. **Frontend Pure Ledger UI (`FolderLibrary` & `MobileLibraryHeader`)**:
   - Add a view toggle button for **Trash** in the Library toolbar on desktop [`FolderLibrary`](file:///home/jcarrasco21/Projects/memsystems-folder-deletion/frontend/src/features/notebook-library/components/folder-library.tsx) and mobile [`MobileLibraryHeader`](file:///home/jcarrasco21/Projects/memsystems-folder-deletion/frontend/src/features/notebook-library/components/mobile-library-header.tsx).
   - Render the finalized **Pure Ledger (Variant A)** specification from `variant-urgency-ledger.tsx`:
     - **No count badge** next to the `Trash` title or section headers.
     - **Collapsible sections**: `Expiring Within 7 Days` and `Recently Deleted` in Title Case with a rotating chevron and no red dot.
     - **Kind badge/label**: Only the element/file Kind label under the item name (`Folder`, `Notebook`, `PDF`, `Quiz`, `Flashcards`, etc.).
     - **Tabular countdown**: Normal-weight `Xd left` countdown (`text-destructive` when $\le 7$ days, `text-muted-foreground` otherwise).
     - **Infinite scroll**: `useInfiniteQuery` + `IntersectionObserver` sentinel loading 30 items per batch.
3. **Verification**:
   - Component rendering tests and API integration tests.
   - Lint and typecheck clean.
