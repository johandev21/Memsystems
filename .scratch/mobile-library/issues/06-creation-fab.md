# 06: Thumb-Zone Floating Creation FAB and Creation Sheet

**What to build:**
A mobile Floating Action Button (FAB) anchored to the bottom thumb zone above the safe area (`bottom: calc(1rem + env(safe-area-inset-bottom))`). Tapping the FAB opens a bottom `Drawer` with options to create a "New Notebook" or "New Folder", immediately creating the item inside the currently active folder.

**Blocked by:** 03: Tactile Item Tiles with Single-Tap Opening

**Status:** ready-for-agent

- [ ] Render a thumb-friendly Floating Action Button pinned to the bottom-right or center safe area.
- [ ] Tapping opens a creation drawer with options: "New Notebook" and "New Folder".
- [ ] Prompt for name/title (or create untitled default with immediate rename) inside the active folder.
- [ ] Invalidate library query cache and highlight the created item.
