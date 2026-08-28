import { useEffect } from "react";

export function usePromptInputDropTarget(
  formRef: React.RefObject<HTMLFormElement | null>,
  globalDrop: boolean | undefined,
  onFiles: (files: FileList) => void,
) {
  useEffect(() => {
    const target: Document | HTMLFormElement | null = globalDrop ? document : formRef.current;
    if (!target) return;
    const preventFileDrag = (event: Event) => {
      const dragEvent = event as DragEvent;
      if (dragEvent.dataTransfer?.types?.includes("Files")) event.preventDefault();
    };
    const receiveFiles = (event: Event) => {
      const dragEvent = event as DragEvent;
      preventFileDrag(event);
      if (dragEvent.dataTransfer?.files?.length) onFiles(dragEvent.dataTransfer.files);
    };
    target.addEventListener("dragover", preventFileDrag);
    target.addEventListener("drop", receiveFiles);
    return () => {
      target.removeEventListener("dragover", preventFileDrag);
      target.removeEventListener("drop", receiveFiles);
    };
  }, [formRef, globalDrop, onFiles]);
}
