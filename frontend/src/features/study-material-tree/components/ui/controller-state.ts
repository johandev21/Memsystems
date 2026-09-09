import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { TreeCommand, TreeCommandExecutor } from "../model/commands";
import {
  buildStudyMaterialTree,
  canMoveItem,
  flattenVisibleTree,
  getItemName,
  moveItem,
  type TreeNode,
  type TreeState,
} from "../model/tree";
import {
  useControllableFolderExpansion,
  usePendingTreeCommands,
  useTreeFocusRegistry,
} from "./controller-hooks";
import { getActiveFolderIds } from "../model/use-expanded";
import { getCommandPendingKey } from "../model/commands";
import { useTreeKeyboardNav } from "./use-tree-keyboard-nav";
import { type PendingDelete, useTreeMutations } from "./use-tree-mutations";

export * from "./controller-dnd";
export type { PendingDelete } from "./use-tree-mutations";

type ControllerParams = {
  folders: TreeState["folders"];
  materials: TreeState["materials"];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  onCommand?: TreeCommandExecutor;
  onMaterialActivate?: (materialId: string) => void;
  onInternalStateChange?: (updater: (prev: TreeState) => TreeState) => void;
  setLastAction?: (action: string) => void;
  size?: import("./tree/variants").StudyMaterialsTreeSize;
  expandedIds?: Set<string>;
  onExpandedChange?: (ids: Set<string>) => void;
};

export type TreeControllerState = {
  openFolderIds: Set<string>;
  focusedItemId: string | null;
  renamingItemId: string | null;
  pendingDelete: PendingDelete | null;
  activeDragItemId: string | null;
  treeHasFocus: boolean;
  pendingKeys: Set<string>;
};

export type TreeController = TreeControllerState & {
  tree: TreeNode[];
  visibleItems: TreeNode[];
  size: import("./tree/variants").StudyMaterialsTreeSize;
  isFolderOpen: (id: string) => boolean;
  isSelected: (id: string) => boolean;
  isFocused: (id: string) => boolean;
  isRenaming: (id: string) => boolean;
  canMove: (itemId: string, targetFolderId: string | null) => boolean;
  select: (node: TreeNode) => void;
  activate: (node: TreeNode) => void;
  focus: (id: string) => void;
  setFolderOpen: (folderId: string, open: boolean) => void;
  expandAll: () => void;
  collapseAll: () => void;
  beginRename: (id: string) => void;
  commitRename: (id: string, name: string) => Promise<void>;
  cancelRename: (id: string, originalName: string) => void;
  createFolder: (parentId: string | null) => Promise<void>;
  duplicateMaterial: (id: string) => Promise<void>;
  moveToRoot: (id: string) => Promise<void>;
  requestDelete: (node: TreeNode) => void;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
  beginDrag: (id: string, name: string) => void;
  endDrag: (dragId: string | null, dropId: string | null) => Promise<void>;
  cancelDrag: () => void;
  handleKeyDown: (event: ReactKeyboardEvent<HTMLElement>, node: TreeNode) => void;
  registerNode: (id: string, element: HTMLElement | null) => void;
  registerTreeSurface: (el: HTMLDivElement | null) => void;
};

export const TreeContext = createContext<TreeController | null>(null);

export function useTreeControllerContext(): TreeController {
  const ctx = useContext(TreeContext);
  if (!ctx) throw new Error("TreeController context not found");
  return ctx;
}

export function useStudyMaterialsTreeController(params: ControllerParams): TreeController {
  const {
    folders,
    materials,
    selectedId,
    setSelectedId,
    onCommand,
    onMaterialActivate,
    onInternalStateChange,
    setLastAction,
    size = "sm",
    expandedIds,
    onExpandedChange,
  } = params;

  const effectiveState = useMemo<TreeState>(
    () => ({ folders: [...folders], materials: [...materials] }),
    [folders, materials],
  );

  const { openFolderIds, setOpenFolderIds } = useControllableFolderExpansion(
    effectiveState.folders.map((folder) => folder.id),
    expandedIds,
    onExpandedChange,
  );
  const [focusedItemId, setFocusedItemId] = useState<string | null>(selectedId ?? null);
  const [activeDragItemId, setActiveDragItemId] = useState<string | null>(null);
  const { pendingKeys, isPending, setPending, runPendingCommand } =
    usePendingTreeCommands(onCommand);
  const { treeHasFocus, registerTreeSurface, registerNode, focus } =
    useTreeFocusRegistry(setFocusedItemId);

  const tree = useMemo(() => buildStudyMaterialTree(effectiveState), [effectiveState]);
  const visibleItems = useMemo(
    () => flattenVisibleTree(tree, openFolderIds),
    [openFolderIds, tree],
  );

  const [prevFolders, setPrevFolders] = useState(effectiveState.folders);
  const [prevMaterials, setPrevMaterials] = useState(effectiveState.materials);

  if (prevFolders !== effectiveState.folders || prevMaterials !== effectiveState.materials) {
    setPrevFolders(effectiveState.folders);
    setPrevMaterials(effectiveState.materials);
    if (focusedItemId != null && pendingKeys.size === 0) {
      const exists =
        effectiveState.folders.some((f) => f.id === focusedItemId) ||
        effectiveState.materials.some((m) => m.id === focusedItemId);
      if (!exists) {
        setFocusedItemId(null);
      }
    }
  }

  useEffect(() => {
    if (selectedId == null) return;
    if (pendingKeys.size > 0) return;
    const exists =
      effectiveState.folders.some((f) => f.id === selectedId) ||
      effectiveState.materials.some((m) => m.id === selectedId);
    if (!exists) {
      setSelectedId(null);
    }
  }, [effectiveState.folders, effectiveState.materials, pendingKeys, selectedId, setSelectedId]);

  const canMove = useCallback(
    (itemId: string, targetFolderId: string | null) =>
      canMoveItem(effectiveState, itemId, targetFolderId),
    [effectiveState],
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
    (node: TreeNode) => {
      setSelectedId(node.id);
      setFocusedItemId(node.id);
      setLastAction?.(`Selected ${node.name}.`);
    },
    [setLastAction, setSelectedId],
  );

  const activate = useCallback(
    (node: TreeNode) => {
      select(node);
      if (node.type === "folder") {
        const nextOpen = !openFolderIds.has(node.id);
        setFolderOpen(node.id, nextOpen);
        setLastAction?.(`${nextOpen ? "Expanded" : "Collapsed"} ${node.name}.`);
      } else {
        onMaterialActivate?.(node.id);
        setLastAction?.(`Activated ${node.name}.`);
      }
    },
    [openFolderIds, select, setFolderOpen, setLastAction, onMaterialActivate],
  );

  const expandAll = useCallback(() => {
    setOpenFolderIds(getActiveFolderIds(effectiveState.folders));
    setLastAction?.("Expanded all folders.");
  }, [effectiveState.folders, setLastAction, setOpenFolderIds]);

  const collapseAll = useCallback(() => {
    setOpenFolderIds(new Set());
    setLastAction?.("Collapsed all folders.");
  }, [setLastAction, setOpenFolderIds]);

  const mutations = useTreeMutations({
    effectiveState,
    setSelectedId,
    setFocusedItemId,
    onCommand,
    runPendingCommand,
    isPending,
    setPending,
    onInternalStateChange,
    setLastAction,
    setFolderOpen,
    focus,
  });

  const beginDrag = useCallback(
    (id: string, _name: string) => {
      mutations.setRenamingItemId(null);
      setActiveDragItemId(id);
      setSelectedId(id);
      const n = getItemName(effectiveState, id) ?? "item";
      setLastAction?.(`Moving ${n}.`);
    },
    [effectiveState, mutations, setLastAction, setSelectedId],
  );

  const endDrag = useCallback(
    async (dragId: string | null, dropId: string | null) => {
      setActiveDragItemId(null);
      if (!dragId || dropId === undefined) return;
      if (!dragId || !canMoveItem(effectiveState, dragId, dropId)) return;
      const itemName = getItemName(effectiveState, dragId) ?? "Item";
      const targetName =
        dropId === null ? "Study Materials" : (getItemName(effectiveState, dropId) ?? "folder");
      if (onCommand) {
        const command: TreeCommand = { type: "moveItem", id: dragId, targetFolderId: dropId };
        const key = getCommandPendingKey(command);
        if (isPending(key)) return;
        setPending(key, true);
        try {
          const result = await onCommand(command);
          if (!result.ok) {
            focus(dragId);
            return;
          }
          const exists =
            effectiveState.folders.some((f) => f.id === dragId) ||
            effectiveState.materials.some((m) => m.id === dragId);
          if (!exists) return;
          if (dropId) setFolderOpen(dropId, true);
          focus(dragId);
        } finally {
          setPending(key, false);
        }
        return;
      }
      const now = new Date().toISOString();
      onInternalStateChange?.((prev) => moveItem(prev, dragId, dropId, now));
      if (dropId) setFolderOpen(dropId, true);
      setLastAction?.(`Moved ${itemName} to ${targetName}.`);
      focus(dragId);
    },
    [
      effectiveState,
      focus,
      isPending,
      onCommand,
      onInternalStateChange,
      setFolderOpen,
      setLastAction,
      setPending,
    ],
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
    beginRename: mutations.beginRename,
  });

  return {
    size,
    openFolderIds,
    focusedItemId,
    renamingItemId: mutations.renamingItemId,
    pendingDelete: mutations.pendingDelete,
    activeDragItemId,
    treeHasFocus,
    pendingKeys,
    tree,
    visibleItems,
    isFolderOpen: (id: string) => openFolderIds.has(id),
    isSelected: (id: string) => selectedId === id,
    isFocused: (id: string) => focusedItemId === id,
    isRenaming: (id: string) => mutations.renamingItemId === id,
    canMove,
    select,
    activate,
    focus,
    setFolderOpen,
    expandAll,
    collapseAll,
    beginRename: mutations.beginRename,
    commitRename: mutations.commitRename,
    cancelRename: mutations.cancelRename,
    createFolder: mutations.createFolderInternal,
    duplicateMaterial: mutations.duplicateMaterialInternal,
    moveToRoot: mutations.moveToRoot,
    requestDelete: mutations.requestDelete,
    confirmDelete: mutations.confirmDelete,
    cancelDelete: mutations.cancelDelete,
    beginDrag,
    endDrag,
    cancelDrag,
    handleKeyDown,
    registerNode,
    registerTreeSurface,
  } as TreeController & { registerTreeSurface: (el: HTMLDivElement | null) => void };
}
