import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Maximize2, Minimize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  FlashcardEditorContentType,
  QuizEditorContentType,
  RoadmapEditorContentType,
  SlidesEditorContentType,
} from "@/features/study-material-generation";
import type { MindMapContentType } from "../shapes/mind-map";
import type { StudyMaterialDTO } from "../types";
import { CaseStudyView } from "./CaseStudyView";
import { FlashcardView } from "./FlashcardView";
import { MindMapView } from "./MindMapView";
import { PracticeProblemsView } from "./PracticeProblemsView";
import { QuizView } from "./QuizView";
import { RoadmapView } from "./RoadmapView";
import { SlidesView } from "./SlidesView";
import { StudyGuideView } from "./StudyGuideView";

export interface MaterialViewerProps {
  material: StudyMaterialDTO;
  onClose: () => void;
  showHeader?: boolean;
  defaultFullscreen?: boolean;
  forceFullscreen?: boolean;
}

function useMaterialViewerFullscreen(
  materialId: string,
  forceFullscreen: boolean | undefined,
  defaultFullscreen: boolean | undefined,
  onClose: () => void,
) {
  const [isFullscreen, setIsFullscreen] = useState(() =>
    Boolean(defaultFullscreen || forceFullscreen),
  );
  const [isExitingFullscreen, setIsExitingFullscreen] = useState(false);
  const [isChatSuspended, setIsChatSuspended] = useState(false);
  const [hasChatHandoff, setHasChatHandoff] = useState(false);
  const scrollPositionRef = useRef<{
    top: number;
    left: number;
    element: HTMLDivElement | null;
  }>({ top: 0, left: 0, element: null });
  const isEffectivelyFullscreen = !isChatSuspended && (Boolean(forceFullscreen) || isFullscreen);

  const isActiveViewer = useCallback(
    () =>
      window.matchMedia(forceFullscreen ? "(max-width: 1023px)" : "(min-width: 1024px)").matches,
    [forceFullscreen],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isEffectivelyFullscreen && isActiveViewer()) {
        if (forceFullscreen) onClose();
        else setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActiveViewer, isEffectivelyFullscreen, forceFullscreen, onClose]);

  useEffect(() => {
    let exitTimer: number | undefined;
    const handleChatNavigation = (event: Event) => {
      const detail = (event as CustomEvent<{ focusChat?: boolean; chatNavigationRetry?: boolean }>)
        .detail;
      if (!detail?.focusChat || !isEffectivelyFullscreen || detail.chatNavigationRetry) return;
      if (!isActiveViewer()) return;
      if (forceFullscreen) {
        const element = scrollPositionRef.current.element;
        if (element) {
          scrollPositionRef.current.top = element.scrollTop;
          scrollPositionRef.current.left = element.scrollLeft;
        }
        window.dispatchEvent(
          new CustomEvent("study-material-chat-handoff", {
            detail: { materialId, suspended: true },
          }),
        );
        setIsChatSuspended(true);
        return;
      }
      setHasChatHandoff(true);
      setIsExitingFullscreen(true);
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      exitTimer = window.setTimeout(
        () => {
          setIsFullscreen(false);
          setIsExitingFullscreen(false);
        },
        reducedMotion ? 0 : 150,
      );
    };
    window.addEventListener("send-chat-prompt", handleChatNavigation);
    return () => {
      window.removeEventListener("send-chat-prompt", handleChatNavigation);
      if (exitTimer) window.clearTimeout(exitTimer);
    };
  }, [isActiveViewer, isEffectivelyFullscreen, forceFullscreen, materialId]);

  useEffect(() => {
    if (!forceFullscreen) return;
    const handleRestore = (event: Event) => {
      const detail = (event as CustomEvent<{ materialId?: string }>).detail;
      if (detail?.materialId && detail.materialId !== materialId) return;
      setIsChatSuspended(false);
      requestAnimationFrame(() => {
        const element = scrollPositionRef.current.element;
        if (element) {
          element.scrollTop = scrollPositionRef.current.top;
          element.scrollLeft = scrollPositionRef.current.left;
        }
      });
      window.dispatchEvent(
        new CustomEvent("study-material-chat-handoff", {
          detail: { materialId, suspended: false },
        }),
      );
    };
    window.addEventListener("restore-study-material", handleRestore);
    return () => window.removeEventListener("restore-study-material", handleRestore);
  }, [forceFullscreen, materialId]);

  useEffect(() => {
    setIsChatSuspended(false);
    setHasChatHandoff(false);
  }, [materialId]);

  return {
    isFullscreen,
    setIsFullscreen,
    isExitingFullscreen,
    isEffectivelyFullscreen,
    isChatSuspended,
    hasChatHandoff,
    setHasChatHandoff,
    scrollPositionRef,
  };
}

export function MaterialViewer({
  material,
  onClose,
  showHeader = true,
  defaultFullscreen,
  forceFullscreen,
}: MaterialViewerProps) {
  const beforeCloseRef = useRef<(() => boolean) | null>(null);

  const handleClose = useCallback(() => {
    if (beforeCloseRef.current && !beforeCloseRef.current()) {
      return;
    }
    onClose();
  }, [onClose]);

  const {
    isFullscreen,
    setIsFullscreen,
    isExitingFullscreen,
    isEffectivelyFullscreen,
    isChatSuspended,
    hasChatHandoff,
    setHasChatHandoff,
    scrollPositionRef,
  } = useMaterialViewerFullscreen(material.id, forceFullscreen, defaultFullscreen, handleClose);

  const contentScrollRef = useRef<HTMLDivElement>(null);
  scrollPositionRef.current.element = contentScrollRef.current;

  const renderMaterialContent = () => {
    switch (material.kind) {
      case "case_study":
        return (
          <CaseStudyView
            materialId={material.id}
            content={material.content}
            notebookId={material.notebookId}
            onOpenSource={() => {
              if (forceFullscreen) handleClose();
              else setIsFullscreen(false);
            }}
          />
        );
      case "practice_problems":
        return (
          <PracticeProblemsView
            materialId={material.id}
            content={material.content}
            notebookId={material.notebookId}
            onClose={onClose}
            registerBeforeClose={(fn) => {
              beforeCloseRef.current = fn;
            }}
            onOpenSource={() => {
              if (forceFullscreen) handleClose();
              else setIsFullscreen(false);
            }}
          />
        );
      case "study_guide":
        return (
          <StudyGuideView
            content={material.content}
            notebookId={material.notebookId}
            onOpenSource={() => {
              if (forceFullscreen) onClose();
              else setIsFullscreen(false);
            }}
          />
        );
      case "quiz":
        return <QuizView content={material.content as QuizEditorContentType} />;
      case "simple_flashcard":
        return (
          <FlashcardView
            materialId={material.id}
            materialTitle={material.title}
            content={material.content as FlashcardEditorContentType}
          />
        );
      case "roadmap":
        return (
          <RoadmapView
            materialId={material.id}
            content={material.content as RoadmapEditorContentType}
          />
        );
      case "mind_map":
        return (
          <MindMapView
            materialId={material.id}
            materialTitle={material.title}
            content={material.content as MindMapContentType}
          />
        );
      case "slides":
        return (
          <SlidesView
            materialId={material.id}
            materialTitle={material.title}
            content={material.content as SlidesEditorContentType}
          />
        );
      default:
        return <div className="p-8 text-center text-text-tertiary">Unsupported material type</div>;
    }
  };

  const viewerHeader = (
    <div className="flex items-center justify-between gap-2 p-1.5 bg-panel-header-bg min-h-[44px] shrink-0 select-none">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {!isEffectivelyFullscreen && !hasChatHandoff && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-8 px-2.5 text-xs text-text-secondary hover:text-text-primary cursor-pointer flex items-center gap-1.5 rounded-lg shrink-0"
            title="Return to Studio overview"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
        )}
        <h3 className="text-sm font-semibold truncate text-text-primary ml-1 min-w-0 flex-1">
          {material.title}
        </h3>
      </div>

      <div className="flex items-center gap-1">
        {!forceFullscreen && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              setIsFullscreen(!isFullscreen);
              if (!isFullscreen) setHasChatHandoff(false);
            }}
            className="h-8 w-8 text-text-secondary hover:text-text-primary cursor-pointer rounded-lg"
            title={
              isFullscreen
                ? "Exit Fullscreen (Esc)"
                : hasChatHandoff
                  ? "Return to Fullscreen"
                  : "Fullscreen Mode"
            }
            aria-label={
              isFullscreen
                ? "Exit Fullscreen"
                : hasChatHandoff
                  ? "Return to Fullscreen"
                  : "Fullscreen Mode"
            }
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        )}
        {isEffectivelyFullscreen && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-8 w-8 text-text-secondary hover:text-text-primary cursor-pointer rounded-lg"
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div
      className={`flex h-full flex-col bg-surface-1 text-text-primary overflow-hidden ${
        isChatSuspended ? "hidden" : ""
      } ${
        isEffectivelyFullscreen || isExitingFullscreen
          ? "fixed inset-0 z-viewer h-[100dvh] w-screen motion-reduce:animate-none"
          : ""
      } ${isExitingFullscreen ? "animate-out fade-out duration-150" : ""}`}
    >
      {showHeader && viewerHeader}
      <div
        ref={contentScrollRef}
        className={`flex-1 overflow-y-auto overscroll-contain ${
          isEffectivelyFullscreen
            ? "p-3 sm:p-4 md:p-8 max-w-7xl mx-auto w-full"
            : "p-3 sm:p-4 md:p-6"
        }`}
      >
        {renderMaterialContent()}
      </div>
    </div>
  );
}
