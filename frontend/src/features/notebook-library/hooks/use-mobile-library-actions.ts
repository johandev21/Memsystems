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
  onCreateFolderNamed?: (name: string) => void | Promise<unknown>;
  onCreateNotebookNamed?: (title: string) => void | Promise<unknown>;
}

export function useMobileLibraryActions({
  onRenameFolder,
  onRemoveFolder,
  onRemoveNotebook,
  onUpdateNotebook,
  onCreateFolderNamed,
  onCreateNotebookNamed,
}: UseMobileLibraryActionsOptions) {
  const [activeItem, setActiveItem] = useState<LibraryItem | null>(null);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isCreateNotebookOpen, setIsCreateNotebookOpen] = useState(false);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

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

  const startCreateFolder = () => {
    setIsCreateOpen(false);
    setIsCreateFolderOpen(true);
  };

  const startCreateNotebook = () => {
    setIsCreateOpen(false);
    setIsCreateNotebookOpen(true);
  };

  const confirmCreateFolder = async (name: string) => {
    if (!name.trim()) return;
    setIsSubmittingCreate(true);
    try {
      await onCreateFolderNamed?.(name.trim());
      setIsCreateFolderOpen(false);
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const confirmCreateNotebook = async (title: string) => {
    if (!title.trim()) return;
    setIsSubmittingCreate(true);
    try {
      await onCreateNotebookNamed?.(title.trim());
      setIsCreateNotebookOpen(false);
    } finally {
      setIsSubmittingCreate(false);
    }
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
    isCreateFolderOpen,
    setIsCreateFolderOpen,
    isCreateNotebookOpen,
    setIsCreateNotebookOpen,
    isSubmittingCreate,
    startCreateFolder,
    startCreateNotebook,
    confirmCreateFolder,
    confirmCreateNotebook,
  };
}
