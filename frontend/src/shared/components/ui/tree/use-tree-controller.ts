import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import type {
  BaseTreeNode,
  TreeCommandExecutor,
  TreeControllerState,
  TreePendingDelete,
  TreeSize,
} from "./types";
import { flattenVisibleTree } from "./tree-utils";
import { useControllableFolderExpansion } from "./use-tree-expansion";
import { useTreeFocusRegistry } from "./use-tree-focus";
import { usePendingTreeCommands } from "./use-tree-pending-commands";
import { useTreeKeyboardNav } from "./use-tree-keyboard-nav";

export interface TreeController<TNode extends BaseTreeNode = BaseTreeNode>
  extends TreeControllerState {
  tree: readonly TNode[];
  visibleItems: readonly TNode[];
  size: TreeSize;
  isFolderOpen: (id: string) => boolean;
  isSelected: (id: string) => boolean;
  isFocused: (id: string) => boolean;
  isRenaming: (id: string) => boolean;
  canMove: (itemId: string, targetFolderId: string | null) => boolean;
  select: (node: TNode) => void;
  activate: (node: TNode) => void;
  focus: (id: string) => void;
  setFolderOpen: (folderId: string, open: boolean) => void;
  expandAll: () => void;
  collapseAll: () => void;
  beginRename: (id: string) => void;
  commitRename: (id: string, name: string) => Promise<void>;
  cancelRename: (id: string, originalName: string) => void;
  createFolder: (parentId: string | null) => Promise<void>;
  requestDelete: (node: TNode) => void;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
  beginDrag: (id: string, name: string) => void;
  endDrag: (dragId: string | null, dropId: string | null) => Promise<void>;
  cancelDrag: () => void;
  handleKeyDown: (event: ReactKeyboardEvent<HTMLElement>, node: TNode) => void;
  registerNode: (id: string, element: HTMLElement | null) => void;
  registerTreeSurface: (el: HTMLDivElement | null) => void;
}

export interface UseTreeControllerOptions<TNode extends BaseTreeNode = BaseTreeNode> {
  tree: readonly TNode[];
  allFolderIds?: readonly string[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  expandedIds?: Set<string>;
  onExpandedChange?: (ids: Set<string>) => void;
  size?: TreeSize;
  onActivate?: (node: TNode) => void;
  onSelect?: (node: TNode) => void;
  canMoveItem?: (itemId: string, targetFolderId: string | null) => boolean;
  onMoveItem?: (itemId: string, targetFolderId: string | null) => Promise<void> | void;
  onRenameItem?: (itemId: string, name: string) => Promise<void> | void;
  onCreateFolder?: (parentId: string | null) => Promise<string | void> | string | void;
  onDeleteItem?: (node: TreePendingDelete) => Promise<void> | void;
  getItemName?: (id: string) => string | null;
  setLastAction?: (action: string) => void;
  onCommand?: TreeCommandExecutor;
}

export function useTreeController<TNode extends BaseTreeNode = BaseTreeNode>({
  tree,
  allFolderIds = [],
  selectedId,
  setSelectedId,
  expandedIds,
  onExpandedChange,
  size = "sm",
  onActivate,
  onSelect,
  canMoveItem,
  onMoveItem,
  onRenameItem,
  onCreateFolder,
  onDeleteItem,
  getItemName,
  setLastAction,
  onCommand,
}: UseTreeControllerOptions<TNode>): TreeController<TNode> {
  const { openFolderIds, setOpenFolderIds } = useControllableFolderExpansion(
    allFolderIds,
    expandedIds,
    onExpandedChange,
  );

  const [focusedItemId, setFocusedItemId] = useState<string | null>(selectedId ?? null);
  const [activeDragItemId, setActiveDragItemId] = useState<string | null>(null);
  const [renamingItemId, setRenamingItemId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TreePendingDelete | null>(null);

  const { pendingKeys } = usePendingTreeCommands(onCommand);

  const { treeHasFocus, registerTreeSurface, registerNode, focus } =
    useTreeFocusRegistry(setFocusedItemId);

  const visibleItems = useMemo(
    () => flattenVisibleTree<TNode>(tree, openFolderIds),
    [openFolderIds, tree],
  );

  const canMove = useCallback(
    (itemId: string, targetFolderId: string | null) => {
      if (canMoveItem) return canMoveItem(itemId, targetFolderId);
      return true;
    },
    [canMoveItem],
  );

  const setFolderOpen = useCallback(
    (folderId: string, open: boolean) => {
      setOpenFolderIds((prev) => {
        const next = new Set(prev);
        if (open) next.add(folderId);
        else next.delete(folderId);
        return next;
      });
    },
    [setOpenFolderIds],
  );

  const select = useCallback(
    (node: TNode) => {
      setSelectedId(node.id);
      setFocusedItemId(node.id);
      onSelect?.(node);
      setLastAction?.(`Selected ${node.name}.`);
    },
    [onSelect, setLastAction, setSelectedId],
  );

  const activate = useCallback(
    (node: TNode) => {
      select(node);
      if (node.type === "folder") {
        const nextOpen = !openFolderIds.has(node.id);
        setFolderOpen(node.id, nextOpen);
        setLastAction?.(`${nextOpen ? "Expanded" : "Collapsed"} ${node.name}.`);
      } else {
        onActivate?.(node);
        setLastAction?.(`Activated ${node.name}.`);
      }
    },
    [openFolderIds, select, setFolderOpen, setLastAction, onActivate],
  );

  const expandAll = useCallback(() => {
    setOpenFolderIds(new Set(allFolderIds));
    setLastAction?.("Expanded all folders.");
  }, [allFolderIds, setLastAction, setOpenFolderIds]);

  const collapseAll = useCallback(() => {
    setOpenFolderIds(new Set());
    setLastAction?.("Collapsed all folders.");
  }, [setLastAction, setOpenFolderIds]);

  const beginRename = useCallback(
    (id: string) => {
      setSelectedId(id);
      setRenamingItemId(id);
    },
    [setSelectedId],
  );

  const commitRename = useCallback(
    async (id: string, name: string) => {
      const prevName = getItemName?.(id) ?? "Item";
      const nextName = name.trim();
      if (!nextName || prevName === nextName) {
        setRenamingItemId(null);
        focus(id);
        return;
      }
      setRenamingItemId(null);
      await onRenameItem?.(id, nextName);
      focus(id);
    },
    [focus, getItemName, onRenameItem],
  );

  const cancelRename = useCallback(
    (id: string, _originalName: string) => {
      setRenamingItemId(null);
      focus(id);
    },
    [focus],
  );

  const createFolder = useCallback(
    async (parentId: string | null) => {
      const createdId = await onCreateFolder?.(parentId);
      if (parentId) setFolderOpen(parentId, true);
      if (typeof createdId === "string") {
        setSelectedId(createdId);
        setFocusedItemId(createdId);
        setRenamingItemId(createdId);
      }
    },
    [onCreateFolder, setFolderOpen, setSelectedId],
  );

  const requestDelete = useCallback((node: TNode) => {
    setPendingDelete({ id: node.id, name: node.name, type: node.type });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const item = pendingDelete;
    await onDeleteItem?.(item);
    setSelectedId(null);
    setFocusedItemId(null);
    setRenamingItemId(null);
    setPendingDelete(null);
  }, [onDeleteItem, pendingDelete, setSelectedId]);

  const cancelDelete = useCallback(() => {
    setPendingDelete(null);
  }, []);

  const beginDrag = useCallback(
    (id: string, _name: string) => {
      setRenamingItemId(null);
      setActiveDragItemId(id);
      setSelectedId(id);
      const n = getItemName?.(id) ?? "item";
      setLastAction?.(`Moving ${n}.`);
    },
    [getItemName, setLastAction, setSelectedId],
  );

  const endDrag = useCallback(
    async (dragId: string | null, dropId: string | null) => {
      setActiveDragItemId(null);
      if (!dragId || dropId === undefined) return;
      if (!canMove(dragId, dropId)) return;
      await onMoveItem?.(dragId, dropId);
      if (dropId) setFolderOpen(dropId, true);
      focus(dragId);
    },
    [canMove, focus, onMoveItem, setFolderOpen],
  );

  const cancelDrag = useCallback(() => {
    setActiveDragItemId(null);
    setLastAction?.("Cancelled move.");
  }, [setLastAction]);

  const { handleKeyDown } = useTreeKeyboardNav({
    activeDragItemId,
    visibleItems,
    openFolderIds,
    setFolderOpen,
    focus,
    activate,
    beginRename,
    requestDelete,
  });

  return {
    size,
    tree,
    visibleItems,
    openFolderIds,
    focusedItemId,
    renamingItemId,
    pendingDelete,
    activeDragItemId,
    treeHasFocus,
    pendingKeys,
    isFolderOpen: (id: string) => openFolderIds.has(id),
    isSelected: (id: string) => selectedId === id,
    isFocused: (id: string) => focusedItemId === id,
    isRenaming: (id: string) => renamingItemId === id,
    canMove,
    select,
    activate,
    focus,
    setFolderOpen,
    expandAll,
    collapseAll,
    beginRename,
    commitRename,
    cancelRename,
    createFolder,
    requestDelete,
    confirmDelete,
    cancelDelete,
    beginDrag,
    endDrag,
    cancelDrag,
    handleKeyDown,
    registerNode,
    registerTreeSurface,
  };
}
