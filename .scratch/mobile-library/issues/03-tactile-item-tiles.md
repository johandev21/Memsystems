# 03: Tactile Item Tiles with Single-Tap Opening

**What to build:**
Replace the desktop 239px horizontal card overflow row on mobile with vertical full-width tactile Item Tiles (min 52px height) for folders and notebooks. Single-tapping a folder navigates into it; single-tapping a notebook opens that notebook. Applies `:active` scale(0.97) press feedback and bypasses `@dnd-kit` drag sensors on mobile viewports.

**Blocked by:** 02: Mobile Navigation Stack Header with Folder Back Drill-Down

**Status:** ready-for-agent

- [ ] Render folders and notebooks as full-width vertical list rows on screens below 640px.
- [ ] Show artwork thumbnail icon, title, item count (for folders), and updated date (for notebooks).
- [ ] Single tap on folder opens the folder.
- [ ] Single tap on notebook navigates to `/notebooks/$notebookId`.
- [ ] Add `:active` touch feedback (`transform: scale(0.97)` / 120ms ease-out) and disable pointer drag capture on touch.
