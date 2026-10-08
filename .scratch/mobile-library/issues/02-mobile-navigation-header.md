# 02: Mobile Navigation Stack Header with Folder Back Drill-Down

**What to build:**
A mobile-specific sticky header for the Library view that displays the current active folder's name, a prominent `< [Parent Folder]` back navigation button when viewing subfolders, and a compact sort selector. Synchronizes navigation via TanStack Router search parameters (`?folderId=...`).

**Blocked by:** 01: Mobile-Native Shell and Touch Baseline Prefactoring

**Status:** ready-for-agent

- [ ] Render a sticky mobile header for the library when viewport is below 640px.
- [ ] Display back button with the parent folder's title when `activeFolderId` is set, clearing or moving up the folder tree when tapped.
- [ ] Provide mobile-friendly sorting selector with touch-accessible targets.
- [ ] Respect top safe area insets via `env(safe-area-inset-top)`.
