import { useEffect } from "react";
import { DesktopLayout, REVIEW_STUDIO_SIZE } from "./desktop-layout";
import { MobileNotebookLayout } from "./mobile-notebook-layout";
import { useNotebookPanels, useSourcesPanel, useStudioDialogs } from "@/features/notebooks";

export interface NotebookWorkspaceContainerProps {
  notebookId: string;
}

export function NotebookWorkspaceContainer({ notebookId }: NotebookWorkspaceContainerProps) {
  const panels = useNotebookPanels();
  const dialogs = useStudioDialogs();
  const sources = useSourcesPanel();
  const sourcesRef = panels.sourcesRef;
  const chatRef = panels.chatRef;
  const studioRef = panels.studioRef;

  useEffect(() => {
    if (!dialogs.selectedStudyMaterialId) return;

    const frame = requestAnimationFrame(() => {
      sourcesRef.current?.collapse();
      studioRef.current?.resize(REVIEW_STUDIO_SIZE);
    });

    return () => cancelAnimationFrame(frame);
  }, [dialogs.selectedStudyMaterialId, sourcesRef, chatRef, studioRef]);

  return (
    <>
      <DesktopLayout
        notebookId={notebookId}
        sourcesRef={panels.sourcesRef}
        chatRef={panels.chatRef}
        studioRef={panels.studioRef}
        sourcesCollapsed={panels.sourcesCollapsed}
        studioCollapsed={panels.studioCollapsed}
        onSyncSources={panels.syncSources}
        onSyncStudio={panels.syncStudio}
        dialogs={dialogs}
        selectedSourceId={sources.selectedSourceId}
        onSelectSource={sources.setSelectedSourceId}
      />
      <MobileNotebookLayout
        notebookId={notebookId}
        dialogs={dialogs}
        selectedSourceId={sources.selectedSourceId}
        onSelectSource={sources.setSelectedSourceId}
      />
    </>
  );
}
