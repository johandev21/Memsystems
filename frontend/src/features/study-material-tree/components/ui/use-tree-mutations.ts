import { useCallback, useState } from "react";
import {
  getCommandPendingKey,
  type CommandResult,
  type TreeCommand,
  type TreeCommandExecutor,
} from "../model/commands";
import {
  canMoveItem,
  createFolder,
  duplicateMaterial,
  getItemName,
  moveItem,
  renameItem,
  softDeleteItem,
  type TreeNode,
  type TreeState,
} from "../model/tree";

export type PendingDelete = {
  id: string;
  name: string;
  type: "folder" | "material";
};

export interface UseTreeMutationsOptions {
  effectiveState: TreeState;
  setSelectedId: (id: string | null) => void;
  setFocusedItemId: (id: string | null) => void;
  onCommand?: TreeCommandExecutor;
  runPendingCommand: (key: string, command: TreeCommand) => Promise<CommandResult | null>;
  isPending: (key: string) => boolean;
  setPending: (key: string, pending: boolean) => void;
  onInternalStateChange?: (updater: (prev: TreeState) => TreeState) => void;
  setLastAction?: (action: string) => void;
  setFolderOpen: (folderId: string, open: boolean) => void;
  focus: (id: string) => void;
}

export function useTreeMutations({
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
}: UseTreeMutationsOptions) {
  const [renamingItemId, setRenamingItemId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const beginRename = useCallback(
    (id: string) => {
      setSelectedId(id);
      setRenamingItemId(id);
    },
    [setSelectedId],
  );

  const commitRename = useCallback(
    async (itemId: string, name: string) => {
      const previousName = getItemName(effectiveState, itemId) ?? "Item";
      const nextName = name.trim();
      if (!nextName || previousName === nextName) {
        setRenamingItemId(null);
        focus(itemId);
        return;
      }
      if (onCommand) {
        const command: TreeCommand = { type: "renameItem", id: itemId, name: nextName };
        const key = getCommandPendingKey(command);
        const result = await runPendingCommand(key, command);
        if (!result) return;
        if (!result.ok) {
          focus(itemId);
          return;
        }
        const exists =
          effectiveState.folders.some((f) => f.id === itemId) ||
          effectiveState.materials.some((m) => m.id === itemId);
        if (!exists) {
          setRenamingItemId(null);
          return;
        }
        setRenamingItemId(null);
        focus(itemId);
        return;
      }
      setRenamingItemId(null);
      const now = new Date().toISOString();
      onInternalStateChange?.((prev) => renameItem(prev, itemId, nextName, now));
      setLastAction?.(`Renamed ${previousName} to ${nextName}.`);
      focus(itemId);
    },
    [effectiveState, focus, onCommand, onInternalStateChange, runPendingCommand, setLastAction],
  );

  const cancelRename = useCallback(
    (id: string, originalName: string) => {
      setRenamingItemId(null);
      focus(id);
      void originalName;
    },
    [focus],
  );

  const createFolderInternal = useCallback(
    async (parentId: string | null) => {
      if (onCommand) {
        const command: TreeCommand = { type: "createFolder", parentId };
        const key = getCommandPendingKey(command);
        if (isPending(key)) return;
        setPending(key, true);
        try {
          const result = await onCommand(command);
          if (!result.ok) {
            if (parentId) focus(parentId);
            return;
          }
          const newId = result.newId;
          if (!newId) return;
          const parentExists =
            parentId === null ||
            effectiveState.folders.some((f) => f.id === parentId && !f.deletedAt);
          if (parentId && !parentExists) return;
          if (parentId) setFolderOpen(parentId, true);
          setSelectedId(newId);
          setFocusedItemId(newId);
          setRenamingItemId(newId);
        } finally {
          setPending(key, false);
        }
        return;
      }
      const now = new Date().toISOString();
      const id = `folder-${crypto.randomUUID()}`;
      const folder = createFolder(parentId, id, now);
      const notebookId = effectiveState.folders[0]?.notebookId ?? "notebook-placeholder";
      const folderWithNotebook = { ...folder, notebookId };
      onInternalStateChange?.((prev) => ({
        ...prev,
        folders: [...prev.folders, folderWithNotebook],
      }));
      if (parentId) setFolderOpen(parentId, true);
      setSelectedId(folderWithNotebook.id);
      setFocusedItemId(folderWithNotebook.id);
      setRenamingItemId(folderWithNotebook.id);
      setLastAction?.(`Created ${folderWithNotebook.name}.`);
    },
    [
      effectiveState.folders,
      focus,
      isPending,
      onCommand,
      onInternalStateChange,
      setFolderOpen,
      setFocusedItemId,
      setLastAction,
      setPending,
      setSelectedId,
    ],
  );

  const duplicateMaterialInternal = useCallback(
    async (id: string) => {
      const name = getItemName(effectiveState, id) ?? "Study material";
      if (onCommand) {
        const command: TreeCommand = { type: "duplicateMaterial", id };
        const key = getCommandPendingKey(command);
        if (isPending(key)) return;
        setPending(key, true);
        try {
          const result = await onCommand(command);
          if (!result.ok) return;
          const exists = effectiveState.materials.some((m) => m.id === id && !m.deletedAt);
          if (!exists) return;
        } finally {
          setPending(key, false);
        }
        return;
      }
      const now = new Date().toISOString();
      const newId = `material-${crypto.randomUUID()}`;
      onInternalStateChange?.((prev) => duplicateMaterial(prev, id, newId, now));
      setLastAction?.(`Duplicated ${name}.`);
    },
    [effectiveState, isPending, onCommand, onInternalStateChange, setLastAction, setPending],
  );

  const moveToRoot = useCallback(
    async (id: string) => {
      const name = getItemName(effectiveState, id) ?? "Item";
      if (!canMoveItem(effectiveState, id, null)) return;
      if (onCommand) {
        const command: TreeCommand = { type: "moveItem", id, targetFolderId: null };
        const key = getCommandPendingKey(command);
        if (isPending(key)) return;
        setPending(key, true);
        try {
          const result = await onCommand(command);
          if (!result.ok) {
            focus(id);
            return;
          }
          const exists =
            effectiveState.folders.some((f) => f.id === id) ||
            effectiveState.materials.some((m) => m.id === id);
          if (!exists) return;
          focus(id);
        } finally {
          setPending(key, false);
        }
        return;
      }
      const now = new Date().toISOString();
      onInternalStateChange?.((prev) => moveItem(prev, id, null, now));
      setLastAction?.(`Moved ${name} to Study Materials.`);
    },
    [effectiveState, focus, isPending, onCommand, onInternalStateChange, setLastAction, setPending],
  );

  const requestDelete = useCallback((node: TreeNode) => {
    setPendingDelete({ id: node.id, name: node.name, type: node.type });
  }, []);

  const confirmDelete = useCallback(async () => {
    const pending = pendingDelete;
    if (!pending) return;
    const deleteId = pending.id;
    if (onCommand) {
      const command: TreeCommand = { type: "deleteItem", id: deleteId };
      const key = getCommandPendingKey(command);
      if (isPending(key)) return;
      setPending(key, true);
      try {
        const result = await onCommand(command);
        if (!result.ok) {
          focus(deleteId);
          return;
        }
        const exists =
          effectiveState.folders.some((f) => f.id === deleteId) ||
          effectiveState.materials.some((m) => m.id === deleteId);
        if (!exists) {
          setPendingDelete(null);
          return;
        }
        setSelectedId(null);
        setFocusedItemId(null);
        setRenamingItemId(null);
        setPendingDelete(null);
      } finally {
        setPending(key, false);
      }
      return;
    }
    const now = new Date().toISOString();
    onInternalStateChange?.((prev) => softDeleteItem(prev, deleteId, now));
    setSelectedId(null);
    setFocusedItemId(null);
    setRenamingItemId(null);
    setLastAction?.(`Deleted ${pending.name} from the local prototype.`);
    setPendingDelete(null);
  }, [
    effectiveState,
    focus,
    isPending,
    onCommand,
    onInternalStateChange,
    pendingDelete,
    setFocusedItemId,
    setLastAction,
    setPending,
    setSelectedId,
  ]);

  const cancelDelete = useCallback(() => setPendingDelete(null), []);

  return {
    renamingItemId,
    setRenamingItemId,
    pendingDelete,
    beginRename,
    commitRename,
    cancelRename,
    createFolderInternal,
    duplicateMaterialInternal,
    moveToRoot,
    requestDelete,
    confirmDelete,
    cancelDelete,
  };
}
