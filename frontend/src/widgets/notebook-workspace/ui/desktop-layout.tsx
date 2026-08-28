import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { GroupImperativeHandle, PanelImperativeHandle } from "react-resizable-panels";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/shared/ui/resizable";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { ChatPanel, ChatPanelHeader } from "@/features/notebook-chat";
import { SourceContentViewer, SourcesPanel } from "@/features/sources";
import { GenerateBriefDialog, StudyMaterialsPanel } from "@/features/study-materials";
import { StudioResources, RightPane } from "@/features/notebooks";
import type { UseStudioDialogsReturn } from "@/features/notebooks";
import { SourcesPanelHeader } from "./sources-panel-header";
import { StudioPanelHeader } from "./studio-panel-header";

const COLLAPSED_PANEL_SIZE = "48px";
const SIDE_PANEL_MIN_SIZE = "220px";
const CHAT_PANEL_MIN_SIZE = 480;
const CHAT_PANEL_MAX_MIN_SIZE = 900;
const CHAT_PANEL_MIN_WIDTH_RATIO = 0.35;
const REVIEW_STUDIO_MIN_SIZE = "360px";
export const REVIEW_STUDIO_SIZE = "1000px";
const DEFAULT_WORKSPACE_LAYOUT = {
  sources: 20,
  chat: 60,
  studio: 20,
};

export interface DesktopLayoutProps {
  notebookId: string;
  sourcesRef: RefObject<PanelImperativeHandle | null>;
  chatRef: RefObject<PanelImperativeHandle | null>;
  studioRef: RefObject<PanelImperativeHandle | null>;
  sourcesCollapsed: boolean;
  studioCollapsed: boolean;
  onSyncSources: () => void;
  onSyncStudio: () => void;
  dialogs: UseStudioDialogsReturn;
  selectedSourceId: string | null;
  onSelectSource: (id: string | null) => void;
}

export function DesktopLayout({
  notebookId,
  sourcesRef,
  chatRef,
  studioRef,
  sourcesCollapsed,
  studioCollapsed,
  onSyncSources,
  onSyncStudio,
  dialogs,
  selectedSourceId,
  onSelectSource,
}: DesktopLayoutProps) {
  const isReviewingStudyMaterial = Boolean(dialogs.selectedStudyMaterialId);
  const panelGroupRef = useRef<HTMLDivElement>(null);
  const panelGroupApiRef = useRef<GroupImperativeHandle>(null);
  const responsiveChatMinSize = useResponsiveChatMinimum(panelGroupRef);

  const exitStudyMaterialReview = () => {
    dialogs.setSelectedStudyMaterialId(null);
    sourcesRef.current?.expand();
    requestAnimationFrame(() => {
      panelGroupApiRef.current?.setLayout(DEFAULT_WORKSPACE_LAYOUT);
    });
  };

  const toggleSourcesCollapse = () => {
    if (isReviewingStudyMaterial) {
      exitStudyMaterialReview();
      return;
    }

    if (sourcesCollapsed) {
      sourcesRef.current?.expand();
    } else {
      sourcesRef.current?.collapse();
    }
  };

  const toggleStudioCollapse = () => {
    if (studioCollapsed) {
      studioRef.current?.expand();
    } else {
      studioRef.current?.collapse();
    }
  };

  const handleSyncSources = () => {
    onSyncSources();
    if (sourcesRef.current?.isCollapsed() && selectedSourceId) {
      onSelectSource(null);
    }
  };

  const handleSyncStudio = () => {
    onSyncStudio();
    if (studioRef.current?.isCollapsed() && dialogs.selectedStudyMaterialId) {
      exitStudyMaterialReview();
    }
  };

  return (
    <div className="hidden lg:block h-full scrollbar-none">
      <ResizablePanelGroup
        id="notebook-workspace"
        orientation="horizontal"
        elementRef={panelGroupRef}
        groupRef={panelGroupApiRef}
        defaultLayout={DEFAULT_WORKSPACE_LAYOUT}
        className="max-w-full h-full"
      >
        <ResizablePanel
          id="sources"
          collapsible
          collapsedSize={COLLAPSED_PANEL_SIZE}
          minSize={SIDE_PANEL_MIN_SIZE}
          groupResizeBehavior="preserve-relative-size"
          panelRef={sourcesRef}
          onResize={handleSyncSources}
          className="overflow-hidden shadow-sm dark:shadow-none rounded-[min(var(--radius-4xl),24px)] border border-border/80 bg-card"
        >
          <div className="flex flex-col h-full min-w-0 overflow-hidden bg-panel-bg">
            {selectedSourceId ? (
              <SourceContentViewer
                sourceId={selectedSourceId}
                onClose={() => onSelectSource(null)}
              />
            ) : (
              <>
                <SourcesPanelHeader
                  collapsed={sourcesCollapsed}
                  notebookId={notebookId}
                  onToggleCollapse={toggleSourcesCollapse}
                />
                <div className="flex-1 min-h-0">
                  <SourcesPanel
                    notebookId={notebookId}
                    collapsed={sourcesCollapsed}
                    onSelectSource={onSelectSource}
                  />
                </div>
              </>
            )}
          </div>
        </ResizablePanel>
        <WorkspaceResizeHandle disabled={isReviewingStudyMaterial} />
        <ResizablePanel
          id="chat"
          minSize={isReviewingStudyMaterial ? `${CHAT_PANEL_MIN_SIZE}px` : responsiveChatMinSize}
          groupResizeBehavior="preserve-relative-size"
          panelRef={chatRef}
          className="overflow-hidden shadow-sm dark:shadow-none rounded-[min(var(--radius-4xl),24px)] border border-border/80 bg-card"
        >
          <div className="flex flex-col h-full min-w-0 overflow-hidden bg-panel-bg">
            <ChatPanelHeader notebookId={notebookId} />
            <div className="flex-1 flex flex-col min-h-0">
              <ChatPanel key={notebookId} notebookId={notebookId} />
            </div>
          </div>
        </ResizablePanel>
        <WorkspaceResizeHandle disabled={isReviewingStudyMaterial} />
        <ResizablePanel
          id="studio"
          collapsible
          collapsedSize={COLLAPSED_PANEL_SIZE}
          minSize={isReviewingStudyMaterial ? REVIEW_STUDIO_MIN_SIZE : SIDE_PANEL_MIN_SIZE}
          maxSize={isReviewingStudyMaterial ? REVIEW_STUDIO_SIZE : undefined}
          groupResizeBehavior={
            isReviewingStudyMaterial ? "preserve-pixel-size" : "preserve-relative-size"
          }
          disabled={isReviewingStudyMaterial}
          panelRef={studioRef}
          onResize={handleSyncStudio}
          className="overflow-hidden shadow-sm dark:shadow-none rounded-[min(var(--radius-4xl),24px)] border border-border/80 bg-card"
        >
          <div className="flex flex-col h-full min-w-0 overflow-hidden bg-panel-bg">
            {dialogs.selectedStudyMaterialId ? (
              <RightPane
                notebookId={notebookId}
                mode={{
                  kind: "viewer",
                  materialId: dialogs.selectedStudyMaterialId,
                }}
                onModeChange={(mode) => {
                  if (mode.kind === "select") {
                    exitStudyMaterialReview();
                  }
                }}
              />
            ) : (
              <>
                <StudioPanelHeader
                  collapsed={studioCollapsed}
                  onToggleCollapse={toggleStudioCollapse}
                />
                <ScrollArea className="flex-1">
                  <StudioResources
                    notebookId={notebookId}
                    collapsed={studioCollapsed}
                    onGenerate={dialogs.handleGenerate}
                  />
                </ScrollArea>
                {!studioCollapsed && (
                  <div className="p-1.5 pt-0">
                    <StudyMaterialsPanel
                      notebookId={notebookId}
                      onSelectMaterial={dialogs.setSelectedStudyMaterialId}
                    />
                  </div>
                )}
              </>
            )}
          </div>
          {dialogs.dialogOpen && (
            <GenerateBriefDialog
              notebookId={notebookId}
              kind={dialogs.generateKind}
              models={dialogs.models}
              open={dialogs.dialogOpen}
              onOpenChange={dialogs.setDialogOpen}
              onComplete={dialogs.handleGenerateComplete}
            />
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function useResponsiveChatMinimum(panelGroupRef: RefObject<HTMLDivElement | null>) {
  const [panelGroupWidth, setPanelGroupWidth] = useState(0);

  useEffect(() => {
    const panelGroup = panelGroupRef.current;
    if (!panelGroup) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setPanelGroupWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(panelGroup);
    return () => observer.disconnect();
  }, [panelGroupRef]);

  return `${Math.min(
    CHAT_PANEL_MAX_MIN_SIZE,
    Math.max(CHAT_PANEL_MIN_SIZE, Math.round(panelGroupWidth * CHAT_PANEL_MIN_WIDTH_RATIO)),
  )}px`;
}

function WorkspaceResizeHandle({ disabled }: { disabled: boolean }) {
  return (
    <ResizableHandle
      disabled={disabled}
      withHandle
      className="w-2.5 bg-transparent hover:bg-border/20 active:bg-border/40 transition-colors my-[48px] rounded-xl"
    />
  );
}
