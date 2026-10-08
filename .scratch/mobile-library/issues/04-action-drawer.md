# 04: Action Drawer for Item Management (Rename and Delete)

**What to build:**
A dedicated 44px trailing `...` button on each mobile item tile that triggers a Base-UI `Drawer` at the bottom of the screen. The drawer exposes "Rename" and "Delete" actions. Renaming opens a dedicated input form with >=16px font size; deleting connects to the existing deletion confirmation dialog.

**Blocked by:** 03: Tactile Item Tiles with Single-Tap Opening

**Status:** ready-for-agent

- [ ] Render a 44px `...` button on every mobile list tile.
- [ ] Tapping `...` opens an Action Drawer anchored to the bottom safe area (`env(safe-area-inset-bottom)`).
- [ ] Implement "Rename" action triggering an autofocus input dialog or drawer with >=16px font size.
- [ ] Implement "Delete" action invoking the existing deletion confirmation dialog.
