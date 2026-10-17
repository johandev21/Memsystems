import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { GroupImperativeHandle, PanelImperativeHandle } from "react-resizable-panels";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/shared/utils/cn";
import { ChatPanel, ChatPanelHeader } from "@/features/notebook-chat";
import { SourcesPanel } from "@/features/sources/components/sources-panel";
import { SourceReaderSkeleton } from "@/features/sources/components/skeletons/source-reader-skeleton";
import { StudyMaterialsPanel } from "@/features/study-material-tree";
import { StudioResources } from "../shared/studio-resources";
import { RightPane } from "../studio/right-pane";
import type { UseStudioDialogsReturn } from "../../hooks/use-studio-dialogs";
import type { SourceSegmentLocator } from "@/features/sources/types";

const SourceContentViewer = lazy(() =>
  import("@/features/sources/components/source-content-viewer").then(
    (m) => ({ default: m.SourceContentViewer }),
  ),
);
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
  selectedLocator?: SourceSegmentLocator | null;
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
  selectedLocator,
  onSelectSource,
}: DesktopLayoutProps) {
  const isReviewingStudyMaterial = Boolean(dialogs.selectedStudyMaterialId);
  const panelGroupRef = useRef<HTMLDivElement>(null);
  const panelGroupApiRef = useRef<GroupImperativeHandle>(null);
  const responsiveChatMinSize = useResponsiveChatMinimum(panelGroupRef);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isStudyMaterialsExpanded, setIsStudyMaterialsExpanded] = useState(false);
  const [studioSearchOpen, setStudioSearchOpen] = useState(false);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleStudyMaterialsExpand = useCallback(() => {
    setIsStudyMaterialsExpanded((prev) => !prev);
  }, []);

  const startTransition = useCallback(() => {
    setIsTransitioning(true);
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = setTimeout(() => {
      setIsTransitioning(false);
    }, 250);
  }, []);

  const exitStudyMaterialReview = useCallback(() => {
    startTransition();
    dialogs.setSelectedStudyMaterialId(null);
    sourcesRef.current?.expand();
    requestAnimationFrame(() => {
      panelGroupApiRef.current?.setLayout(DEFAULT_WORKSPACE_LAYOUT);
    });
  }, [dialogs, sourcesRef, startTransition]);

  const toggleSourcesCollapse = useCallback(() => {
    if (isReviewingStudyMaterial) {
      exitStudyMaterialReview();
      return;
    }

    startTransition();
    const panel = sourcesRef.current;
    if (panel?.isCollapsed()) {
      panel.expand();
    } else {
      panel?.collapse();
    }
  }, [isReviewingStudyMaterial, exitStudyMaterialReview, startTransition, sourcesRef]);

  const toggleStudioCollapse = useCallback(() => {
    startTransition();
    const panel = studioRef.current;
    if (panel?.isCollapsed()) {
      panel.expand();
    } else {
      panel?.collapse();
    }
  }, [startTransition, studioRef]);

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
          className={cn(
            "overflow-hidden shadow-sm dark:shadow-none rounded-panel border border-border/80 bg-card",
            isTransitioning && "transition-all duration-200 ease-out",
          )}
        >
          <div className="flex flex-col h-full min-w-0 overflow-hidden bg-panel-bg">
            {selectedSourceId ? (
              <Suspense
                fallback={<SourceReaderSkeleton onClose={() => onSelectSource(null)} />}
              >
                <SourceContentViewer
                  sourceId={selectedSourceId}
                  selectedLocator={selectedLocator}
                  onClose={() => onSelectSource(null)}
                />
              </Suspense>
            ) : (
              <SourcesPanel
                notebookId={notebookId}
                collapsed={sourcesCollapsed}
                onSelectSource={onSelectSource}
                onToggleCollapse={toggleSourcesCollapse}
              />
            )}
          </div>
        </ResizablePanel>
        <WorkspaceResizeHandle disabled={isReviewingStudyMaterial} />
        <ResizablePanel
          id="chat"
          minSize={isReviewingStudyMaterial ? `${CHAT_PANEL_MIN_SIZE}px` : responsiveChatMinSize}
          groupResizeBehavior="preserve-relative-size"
          panelRef={chatRef}
          className={cn(
            "overflow-hidden shadow-sm dark:shadow-none rounded-panel border border-border/80 bg-card",
            isTransitioning && "transition-all duration-200 ease-out",
          )}
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
          className={cn(
            "overflow-hidden shadow-sm dark:shadow-none rounded-panel border border-border/80 bg-card",
            isTransitioning && "transition-all duration-200 ease-out",
          )}
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
            ) : studioCollapsed ? (
              <>
                <StudioPanelHeader
                  collapsed={true}
                  onToggleCollapse={toggleStudioCollapse}
                />
                <ScrollArea className="flex-1">
                  <StudioResources
                    notebookId={notebookId}
                    collapsed={true}
                    onGenerate={dialogs.handleGenerate}
                  />
                </ScrollArea>
              </>
            ) : isStudyMaterialsExpanded ? (
              <div className="flex flex-col h-full min-h-0 min-w-0">
                <StudyMaterialsPanel
                  notebookId={notebookId}
                  onSelectMaterial={dialogs.setSelectedStudyMaterialId}
                  isExpanded={true}
                  onToggleExpand={toggleStudyMaterialsExpand}
                  isSearchOpen={studioSearchOpen}
                  onToggleSearch={() => setStudioSearchOpen((v) => !v)}
                />
              </div>
            ) : (
              <>
                <StudioPanelHeader
                  collapsed={false}
                  onToggleCollapse={toggleStudioCollapse}
                />
                <ScrollArea className="flex-1">
                  <StudioResources
                    notebookId={notebookId}
                    collapsed={false}
                    onGenerate={dialogs.handleGenerate}
                  />
                </ScrollArea>
                <div className="p-1.5 pt-0">
                  <StudyMaterialsPanel
                    notebookId={notebookId}
                    onSelectMaterial={dialogs.setSelectedStudyMaterialId}
                    isExpanded={false}
                    onToggleExpand={toggleStudyMaterialsExpand}
                    isSearchOpen={studioSearchOpen}
                    onToggleSearch={() => setStudioSearchOpen((v) => !v)}
                  />
                </div>
              </>
            )}
          </div>
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
      className="w-2.5 bg-transparent hover:bg-border/20 active:bg-border/40 transition-colors my-12 rounded-xl"
    />
  );
}
