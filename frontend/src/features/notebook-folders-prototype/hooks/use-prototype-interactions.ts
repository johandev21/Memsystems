import { useState } from "react";
import {
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { descendantNotebooks } from "../model/folder-hierarchy";
import { useNotebookFoldersPrototype } from "../model/use-notebook-folders-prototype";

export function usePrototypeInteractions() {
  const library = useNotebookFoldersPrototype();
  const [draggedItem, setDraggedItem] = useState<{
    kind: "folder" | "notebook";
    id: string;
  } | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const draggedNotebook =
    draggedItem?.kind === "notebook"
      ? library.notebooks.find((notebook) => notebook.id === draggedItem.id)
      : undefined;
  const draggedFolder =
    draggedItem?.kind === "folder"
      ? library.folders.find((folder) => folder.id === draggedItem.id)
      : undefined;
  const draggedFolderNotebooks = draggedFolder
    ? descendantNotebooks(library.folders, library.notebooks, draggedFolder.id)
    : [];
  const previewNotebook = library.notebooks.find((notebook) => notebook.id === previewId);

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    setDraggedItem(
      data?.kind === "folder" || data?.kind === "notebook"
        ? { kind: data.kind, id: String(data.folderId ?? data.notebookId) }
        : null,
    );
    setSelectedKey(null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDraggedItem(null);
    if (!over || !("folderId" in (over.data.current ?? {}))) return;
    const folderId = over.data.current?.folderId;
    if (folderId === null || typeof folderId === "string") {
      const data = active.data.current;
      if (data?.kind === "folder") library.moveFolder(String(data.folderId), folderId);
      else if (data?.kind === "notebook") library.moveNotebook(String(data.notebookId), folderId);
    }
  }

  return {
    library,
    sensors,
    draggedNotebook,
    previewNotebook,
    draft: library.draft,
    selectedKey,
    selectItem: setSelectedKey,
    handleDragStart,
    handleDragEnd,
    cancelDrag: () => setDraggedItem(null),
    draggedFolder,
    draggedFolderNotebooks,
    openNotebook: setPreviewId,
    closePreview: () => setPreviewId(null),
    beginCreateFolder: library.beginCreateFolder,
    beginCreateNotebook: library.beginCreateNotebook,
    commitDraft: library.commitDraft,
    cancelDraft: library.cancelDraft,
  };
}
