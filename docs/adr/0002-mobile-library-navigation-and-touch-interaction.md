# Mobile library navigation and touch interaction architecture

The desktop Library interface relies on skeuomorphic 239px binder cards arranged in a multi-column CSS grid, opened via double-click (`onDoubleClick`), organized via drag-and-drop (`@dnd-kit`), and managed via right-click `<ContextMenu>` and keyboard shortcuts (`F2`, `Delete`). On mobile viewports (<640px), this layout previously degraded into an unergonomic single horizontal scroll strip where cards required unresponsive double-taps and drag-and-drop clashed directly with touch scrolling. We decided to branch the mobile Library view into a dedicated mobile experience featuring a hierarchical Navigation Stack with sticky back headers, full-width tactile Item Tiles with single-tap opening, a bottom-anchored Creation FAB, and swipeable Base-UI Action Drawers and Folder Picker Sheets to replace desktop context menus and drag-and-drop.

## Considered Options

- **Responsive fluid card grid (status quo adaptation):** keep the 239px card visuals and scale them to a 2-column mobile grid. Failed because cover artworks dominate the viewport, leaving titles truncated, metadata invisible, and requiring awkward tap targets for secondary actions.
- **Accordion tree view:** render folders inline as expandable collapsibles on a single page. Failed because deep nesting indents child items horizontally off-screen, creating cluttered visual noise and inconsistent thumb-reach targets.
- **Dedicated mobile list navigation stack with bottom drawers (chosen):** renders full-width list tiles with 48px+ touch targets, single-tap entry, a hierarchical drill-down stack, explicit `...` action triggers opening a bottom sheet drawer, and an explicit "Move to Folder" picker sheet.

## Consequences

- The Library view branches cleanly at mobile viewports (<640px) or coarse pointer environments without polluting desktop grid styling or keyboard workflows.
- `@dnd-kit` sensors are bypassed or deactivated on mobile viewports, eliminating scroll hijacking and unintentional drags.
- Mobile interactions strictly obey mobile-native ergonomics: `overscroll-behavior: contain` on scroll containers, `touch-action: manipulation` on tappables, safe area padding via `env(safe-area-inset-*)`, and minimum 16px input font sizes during renaming to prevent iOS viewport auto-zoom.
- Moving notebooks between folders is handled deterministically through the Folder Picker Sheet rather than touch drag-and-drop.
