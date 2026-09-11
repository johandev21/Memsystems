import { lazy, Suspense, useEffect } from "react";
import { DesktopLayout, REVIEW_STUDIO_SIZE } from "./desktop-layout";
import { MobileNotebookLayout } from "./mobile-notebook-layout";
import { NotebookModelProvider } from "../../context/notebook-model-context";
import { useNotebookPanels } from "../../hooks/use-notebook-panels";
import { useSourcesPanel } from "../../hooks/use-sources-panel";
import { useStudioDialogs } from "../../hooks/use-studio-dialogs";

// Lazy: the generation dialog drags the brief forms, editor schemas and zod
// into its chunk — none of it is needed until the user opens the dialog.
const GenerateBriefDialog = lazy(() =>
  import("@/features/study-material-generation/components/GenerateBriefDialog").then(
    (m) => ({ default: m.GenerateBriefDialog }),
  ),
);

export interface NotebookWorkspaceContainerProps {
  notebookId: string;
}

export function NotebookWorkspaceContainer({ notebookId }: NotebookWorkspaceContainerProps) {
  return (
    <NotebookModelProvider notebookId={notebookId}>
      <NotebookWorkspaceInner notebookId={notebookId} />
    </NotebookModelProvider>
  );
}

function NotebookWorkspaceInner({ notebookId }: { notebookId: string }) {
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
        selectedLocator={sources.selectedLocator}
        onSelectSource={sources.setSelectedSourceId}
      />
      <MobileNotebookLayout
        notebookId={notebookId}
        dialogs={dialogs}
        selectedSourceId={sources.selectedSourceId}
        selectedLocator={sources.selectedLocator}
        onSelectSource={sources.setSelectedSourceId}
      />
      {/* Single instance: both layouts stay mounted (CSS-hidden), so mounting
          the dialog here avoids duplicate stacked dialogs with divergent state. */}
      {dialogs.dialogOpen && (
        <Suspense fallback={null}>
          <GenerateBriefDialog
            notebookId={notebookId}
            kind={dialogs.generateKind}
            open={dialogs.dialogOpen}
            onOpenChange={dialogs.setDialogOpen}
            onComplete={dialogs.handleGenerateComplete}
          />
        </Suspense>
      )}
    </>
  );
}
