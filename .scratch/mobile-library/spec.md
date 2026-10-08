# Spec: Mobile Library Navigation and Touch Experience

## Problem Statement

Users accessing Memsystems on mobile devices encounter a desktop-optimized Library interface that degrades severely on mobile viewports. On screens under 640px, the desktop multi-column card grid collapses into an unergonomic horizontal-scrolling row of wide 239px cards. Furthermore, essential interactions depend on desktop hardware affordances: opening cards requires double-clicking (which triggers mobile browser zoom delay or fails completely), renaming and deletion rely on right-click context menus (`ContextMenu`) or keyboard shortcuts (`F2`), and reorganizing notebooks into folders requires drag-and-drop (`@dnd-kit`), which collides with vertical page scrolling. As a result, mobile users cannot comfortably browse their library, navigate folder hierarchies, organize content, or open notebooks.

## Solution

A mobile-native Library experience purpose-built for touchscreens and small viewports:
1. **Tactile Item Tiles**: Full-width list rows (minimum 48–56px height) with touch-friendly padding, thumbnail cover artwork badges, clear titles, item metadata (notebook counts, updated dates), and physical `:active` press feedback.
2. **Navigation Stack**: A hierarchical drill-down navigation pattern where tapping a folder opens that folder's contents with a sticky header and prominent `< [Parent Name]` back navigation.
3. **Action Drawer**: A swipeable bottom sheet anchored to the bottom safe area (`env(safe-area-inset-bottom)`), triggered via a dedicated 44px trailing `...` button on each item, providing access to Rename, Move to Folder, and Delete actions.
4. **Folder Picker Sheet**: A dedicated bottom sheet for selecting destination folders when moving notebooks, eliminating touch drag-and-drop while retaining full organization capability.
5. **Thumb-Zone Creation FAB**: A Floating Action Button positioned in the bottom safe area that triggers a creation sheet to easily add new Folders or Notebooks with one hand.
6. **Mobile-Native Ergonomics**: Safe area insets, removal of sticky hover states, `touch-action: manipulation`, `overscroll-behavior: contain`, and 16px input font sizes during renaming to prevent unwanted iOS auto-zoom.

## User Stories

1. As a mobile learner, I want to see my notebooks and folders listed in a clean vertical list, so that I can easily scan my study materials with one thumb without awkward horizontal scrolling.
2. As a mobile learner, I want to tap a folder once to enter it, so that I can access its contents immediately without unresponsive double-clicks.
3. As a mobile learner, I want to see a clear back button with the parent folder's name when inside a folder, so that I can return up the navigation stack without getting lost.
4. As a mobile learner, I want to tap a notebook once to open it, so that I can jump directly into my study workspace.
5. As a mobile learner, I want each item to have a dedicated action trigger (`...`), so that I can discover and perform management tasks without needing right-clicks or keyboard shortcuts.
6. As a mobile learner, I want tapping the action trigger to open a bottom sheet drawer, so that secondary actions are easily reachable within the lower thumb zone.
7. As a mobile learner, I want to rename a folder or notebook from the action drawer, so that I can keep my library organized directly from my phone.
8. As a mobile learner, I want the rename text field to be at least 16px in font size, so that iOS Safari does not zoom in and displace the screen layout.
9. As a mobile learner, I want to delete a folder or notebook from the action drawer with a clear confirmation prompt, so that I do not accidentally delete content.
10. As a mobile learner, I want to move a notebook to another folder via a dedicated folder picker drawer, so that I can organize content without struggling with touch drag-and-drop.
11. As a mobile learner, I want to see the count of contained notebooks on every folder tile, so that I know what is inside before opening it.
12. As a mobile learner, I want to see the last updated date on notebook tiles, so that I can quickly identify my most recent study material.
13. As a mobile learner, I want a floating action button in the bottom thumb zone, so that I can create new notebooks and folders with one hand.
14. As a mobile learner, I want tapping the floating action button to present options to create either a new notebook or a new folder, so that I can choose what to create.
15. As a mobile learner, I want to sort my library by name or date using a mobile-optimized control, so that I can order my items according to my current task.
16. As a mobile learner, I want tactile visual feedback (subtle press scale) whenever I press a tile or button, so that the app feels responsive and alive.
17. As a mobile learner, I want smooth, contained scrolling without rubber-band jitter, so that browsing my library feels stable and native.
18. As a mobile learner, I want all bottom-anchored sheets and buttons to respect the device safe area, so that controls are never obscured by the home bar or notch.

## Implementation Decisions

- **Layout Branching**: The library presents a dedicated mobile layout on viewports below 640px or under coarse pointer media conditions. The desktop multi-column binder grid remains untouched for desktop users.
- **Drag-and-Drop Bypass**: The `@dnd-kit` drag and drop context is conditionally bypassed or disabled for mobile list rows, ensuring touch events stream directly to native vertical scrolling without pointer capture latency.
- **Hierarchical Route Synchronization**: The navigation stack synchronizes directly with the existing router search parameters (`?folderId=...`). Navigating into a folder pushes the folder ID to URL search state, preserving browser back/forward history and shareable deep links.
- **Base-UI Drawer Integration**: All contextual operations (item actions, folder moving, and creation) use the project's native Base-UI `Drawer` primitive with backdrop blur, drag handle, and bottom safe-area insets.
- **Tactile Feedback & Touch Action**: Interactive list rows apply `touch-action: manipulation`, `user-select: none`, `-webkit-tap-highlight-color: transparent`, and an `:active` transform scale of `0.97` with a 120ms ease-out curve.
- **Rename Flow**: Renaming on mobile is invoked through the Action Drawer, opening an autofocus form input with clear Save and Cancel actions and an explicit minimum 16px font size.
- **Move Flow**: The "Move to Folder" action opens a secondary picker sheet listing the root library and available folders in a simple hierarchy, executing the existing library move mutation upon selection.

## Testing Decisions

- **What makes a good test**: Tests must verify user-observable behavior and touch interactions rather than internal styling classes or component implementation details.
- **Module Under Test**: The `NotebookLibrary` and `FolderLibrary` mobile views rendered within the standard test query and router harness.
- **Key Scenarios**:
  1. Single tap on folder triggers folder navigation (search params update).
  2. Single tap on notebook triggers notebook navigation.
  3. Tapping back button in header navigates to parent folder or root.
  4. Tapping `...` triggers the Action Drawer and renders Rename, Move, and Delete options.
  5. Moving a notebook via the Folder Picker Sheet fires the correct move mutation.
  6. Creating an item via the mobile creation flow fires the create mutation and commits the item.
- **Prior Art**: Existing tests in `folder-library.test.tsx` and `notebook-library.test.tsx` establish patterns for mocking library query options, mutation hooks, and asserting TanStack Router navigation calls.

## Out of Scope

- Redesigning the interior Notebook workspace (Sources viewer, Chat panel, and Studio tabbed views).
- Multi-select batch editing (e.g., bulk checkbox selection for mass delete/move), which will be addressed in a subsequent iteration.
- Offline persistence or service worker sync for mobile browsers.

## Further Notes

- Governed by [GLOSSARY.md](GLOSSARY.md) and [docs/adr/0002-mobile-library-navigation-and-touch-interaction.md](docs/adr/0002-mobile-library-navigation-and-touch-interaction.md).
