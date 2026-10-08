# Domain Glossary

## Concepts

### Library
The top-level organization workspace where the user browses and manages Folders and Notebooks.

### Folder
An organizational container within the Library that groups Notebooks and nested subfolders. Has a title, color/artwork, and contains zero or more notebooks.

### Notebook
The primary working canvas and study unit. Contains sources, chat history, and generated study materials.

### Navigation Stack (Mobile)
A mobile-native drill-down mechanism where tapping a folder pushes a dedicated folder view with a sticky header and prominent back navigation target (`< Parent Folder`), replacing desktop horizontal card strips and deep breadcrumbs.

### Item Tile (Mobile)
A touch-optimized, full-width row element representing a folder or notebook with a minimum 48px touch target, `:active` press feedback (`scale(0.97)`), thumbnail artwork, metadata (count/date), and a trailing action trigger.

### Action Drawer (Mobile)
A swipeable bottom sheet modal anchored to the bottom safe area (`env(safe-area-inset-bottom)`), triggered via a dedicated 44px `...` button, replacing desktop right-click context menus (`ContextMenu`) and keyboard shortcuts (`F2`, `Delete`). Houses item actions: Rename, Move to Folder, and Delete.

### Folder Picker Sheet (Mobile)
A specialized bottom sheet that displays available folders for moving a notebook without drag-and-drop gestures, preventing collision with vertical scroll physics.

### Creation FAB (Mobile)
A Floating Action Button pinned to the bottom thumb zone above the safe area (`bottom: calc(1rem + env(safe-area-inset-bottom))`), triggering a creation sheet for quickly adding new Folders or Notebooks.
