# 04 — Hold-to-Empty-Trash action and prototype cleanup

**Status**: Blocked
**Blocked by**: `03 — Restore and Delete forever row actions across all Trash item kinds`

## Goal
Connect the press-and-hold `Hold to Empty Trash` button with its fill animation to `DELETE /api/trash`, purging all soft-deleted items and their S3 artifacts, transition the ledger to its empty state, and remove temporary prototype code.

## Scope & Requirements
1. **Empty Trash API (`DELETE /api/trash`)**:
   - Hard deletes all soft-deleted items across all 6 tables.
   - Cleans up all orphaned S3 objects (source files, notebook banners, generated materials).
   - Aborts/cancels any remaining related background jobs.
2. **Hold-to-Empty-Trash UX**:
   - Press-and-hold interaction: `1400ms linear` fill animation (`clip-path: inset(0 100% 0 0)` -> `inset(0 0 0 0)`).
   - Release snap-back: `200ms cubic-bezier(0.23, 1, 0.32, 1)`.
   - On completion trigger: Call `DELETE /api/trash`, invalidate queries, and transition ledger view smoothly to EmptyState.
3. **Prototype Cleanup**:
   - Remove temporary route `/prototypes/trash` (`frontend/src/routes/prototypes.trash.tsx`).
   - Remove temporary prototype folder `frontend/src/features/trash-prototype/`.
   - Ensure clean TanStack router route tree generation (`pnpm --filter frontend exec tsr generate`).
4. **Verification & Quality Gate**:
   - `pnpm run lint` -> zero lint errors.
   - `pnpm run typecheck` -> zero TypeScript errors.
   - Vitest runs clean across backend and frontend.
