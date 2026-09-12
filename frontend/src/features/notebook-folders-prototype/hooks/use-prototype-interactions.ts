import { useState } from "react";
import {
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useNotebookFoldersPrototype } from "../model/use-notebook-folders-prototype";

export function usePrototypeInteractions() {
  const library = useNotebookFoldersPrototype();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const draggedNotebook = library.notebooks.find((notebook) => notebook.id === draggedId);
  const previewNotebook = library.notebooks.find((notebook) => notebook.id === previewId);

  function handleDragStart(event: DragStartEvent) {
    setDraggedId(String(event.active.id));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDraggedId(null);
    if (!over || !("folderId" in (over.data.current ?? {}))) return;
    const folderId = over.data.current?.folderId;
    if (folderId === null || typeof folderId === "string") {
      library.moveNotebook(String(active.id), folderId);
    }
  }

  return {
    library,
    sensors,
    draggedNotebook,
    previewNotebook,
    draft: library.draft,
    handleDragStart,
    handleDragEnd,
    cancelDrag: () => setDraggedId(null),
    openNotebook: setPreviewId,
    closePreview: () => setPreviewId(null),
    beginCreateFolder: library.beginCreateFolder,
    beginCreateNotebook: library.beginCreateNotebook,
    commitDraft: library.commitDraft,
    cancelDraft: library.cancelDraft,
  };
}
