import { useState } from "react";
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { canMoveFolder, descendantNotebooks } from "../model/folder-hierarchy";
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
  const [overId, setOverId] = useState<string | null>(null);
  const [hasOverEvent, setHasOverEvent] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );
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
    setHasOverEvent(false);
    setOverId(null);
    setDraggedItem(
      data?.kind === "folder" || data?.kind === "notebook"
        ? { kind: data.kind, id: String(data.folderId ?? data.notebookId) }
        : null,
    );
  }

  function handleDragOver(event: DragOverEvent) {
    setHasOverEvent(true);
    setOverId(event.over ? String(event.over.id) : null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDraggedItem(null);
    setHasOverEvent(false);
    setOverId(null);
    if (!over || !("folderId" in (over.data.current ?? {}))) return;
    const folderId = over.data.current?.folderId;
    if (folderId !== null && typeof folderId !== "string") return;
    const data = active.data.current;
    if (data?.kind === "folder") {
      if (!canMoveFolder(folders, String(data.folderId), folderId)) return;
      onMoveFolder(String(data.folderId), folderId);
    } else if (data?.kind === "notebook") {
      const notebook = notebooks.find((item) => item.id === data.notebookId);
      if (!notebook || notebook.folderId === folderId) return;
      onMoveNotebook(String(data.notebookId), folderId);
    }
  }

  const isOverMainArea =
    overId?.startsWith("library:") === true || overId?.startsWith("folder:") === true;

  return {
    sensors,
    draggedNotebook,
    draggedFolder,
    draggedFolderNotebooks,
    overId,
    isPreviewCompact: hasOverEvent && !isOverMainArea,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    cancelDrag: () => {
      setDraggedItem(null);
      setHasOverEvent(false);
      setOverId(null);
    },
  };
}
