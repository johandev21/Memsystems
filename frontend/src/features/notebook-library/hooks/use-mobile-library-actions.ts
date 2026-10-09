import { useState } from "react";
import type { LibraryItem } from "../model/library-sort";

export interface UseMobileLibraryActionsOptions {
  onRenameFolder: (id: string, name: string) => void;
  onRemoveFolder: (id: string) => void;
  onRemoveNotebook: (id: string) => void;
  onUpdateNotebook: (
    id: string,
    patch: { title?: string; description?: string; folderId?: string | null },
  ) => void;
}

export function useMobileLibraryActions({
  onRenameFolder,
  onRemoveFolder,
  onRemoveNotebook,
  onUpdateNotebook,
}: UseMobileLibraryActionsOptions) {
  const [activeItem, setActiveItem] = useState<LibraryItem | null>(null);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const openActionDrawer = (item: LibraryItem) => {
    setActiveItem(item);
  };

  const closeActionDrawer = () => {
    setActiveItem(null);
  };

  const startRename = () => {
    if (!activeItem) return;
    const currentName =
      activeItem.kind === "folder" ? activeItem.folder.name : activeItem.notebook.title;
    setRenameValue(currentName);
    setIsRenameOpen(true);
  };

  const confirmRename = () => {
    if (!activeItem || !renameValue.trim()) return;
    const trimmed = renameValue.trim();
    if (activeItem.kind === "folder") {
      onRenameFolder(activeItem.folder.id, trimmed);
    } else {
      onUpdateNotebook(activeItem.notebook.id, { title: trimmed });
    }
    setIsRenameOpen(false);
    setActiveItem(null);
  };

  const deleteItem = () => {
    if (!activeItem) return;
    if (activeItem.kind === "folder") {
      onRemoveFolder(activeItem.folder.id);
    } else {
      onRemoveNotebook(activeItem.notebook.id);
    }
    setActiveItem(null);
  };

  const moveNotebook = (targetFolderId: string | null) => {
    if (!activeItem || activeItem.kind !== "notebook") return;
    onUpdateNotebook(activeItem.notebook.id, { folderId: targetFolderId });
    setIsMoveOpen(false);
    setActiveItem(null);
  };

  return {
    activeItem,
    openActionDrawer,
    closeActionDrawer,
    isRenameOpen,
    setIsRenameOpen,
    renameValue,
    setRenameValue,
    startRename,
    confirmRename,
    isMoveOpen,
    setIsMoveOpen,
    moveNotebook,
    deleteItem,
    isCreateOpen,
    setIsCreateOpen,
  };
}
