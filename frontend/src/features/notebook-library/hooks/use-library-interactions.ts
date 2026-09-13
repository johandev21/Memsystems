import { useState } from "react";
import {
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { descendantNotebooks } from "../model/folder-hierarchy";
import type { LibraryFolder, LibraryNotebook } from "../model/types";

interface UseLibraryInteractionsParams {
  folders: LibraryFolder[];
  notebooks: LibraryNotebook[];
  onMoveFolder: (folderId: string, parentId: string | null) => void;
  onMoveNotebook: (notebookId: string, folderId: string | null) => void;
}

export function useLibraryInteractions({
  folders,
  notebooks,
  onMoveFolder,
  onMoveNotebook,
}: UseLibraryInteractionsParams) {
  const [draggedItem, setDraggedItem] = useState<{
    kind: "folder" | "notebook";
    id: string;
  } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const draggedNotebook =
    draggedItem?.kind === "notebook"
      ? notebooks.find((notebook) => notebook.id === draggedItem.id)
      : undefined;
  const draggedFolder =
    draggedItem?.kind === "folder"
      ? folders.find((folder) => folder.id === draggedItem.id)
      : undefined;
  const draggedFolderNotebooks = draggedFolder
    ? descendantNotebooks(folders, notebooks, draggedFolder.id)
    : [];

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    setDraggedItem(
      data?.kind === "folder" || data?.kind === "notebook"
        ? { kind: data.kind, id: String(data.folderId ?? data.notebookId) }
        : null,
    );
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDraggedItem(null);
    if (!over || !("folderId" in (over.data.current ?? {}))) return;
    const folderId = over.data.current?.folderId;
    if (folderId === null || typeof folderId === "string") {
      const data = active.data.current;
      if (data?.kind === "folder") onMoveFolder(String(data.folderId), folderId);
      else if (data?.kind === "notebook") onMoveNotebook(String(data.notebookId), folderId);
    }
  }

  return {
    sensors,
    draggedNotebook,
    draggedFolder,
    draggedFolderNotebooks,
    handleDragStart,
    handleDragEnd,
    cancelDrag: () => setDraggedItem(null),
  };
}
