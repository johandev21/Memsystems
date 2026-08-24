import { useState, useEffect } from "react";
import { ArrowLeft, Maximize2, Minimize2, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import type {
  FlashcardEditorContentType,
  QuizEditorContentType,
  RoadmapEditorContentType,
} from "@/features/study-materials/editor-schemas";
import type { MindMapContentType } from "@/features/study-materials";
import type { StudyMaterialDTO } from "@/shared/api/study-materials";
import { FlashcardView } from "./FlashcardView";
import { MindMapView } from "./MindMapView";
import { QuizView } from "./QuizView";
import { RoadmapView } from "./RoadmapView";

export interface MaterialViewerProps {
  material: StudyMaterialDTO;
  onClose: () => void;
  showHeader?: boolean;
  defaultFullscreen?: boolean;
  forceFullscreen?: boolean;
}

export function MaterialViewer({
  material,
  onClose,
  showHeader = true,
  defaultFullscreen,
  forceFullscreen,
}: MaterialViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(() =>
    Boolean(defaultFullscreen || forceFullscreen),
  );
  const [isExitingFullscreen, setIsExitingFullscreen] = useState(false);
  const isEffectivelyFullscreen = forceFullscreen || isFullscreen;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isEffectivelyFullscreen) {
        if (forceFullscreen) {
          onClose();
        } else {
          setIsFullscreen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEffectivelyFullscreen, forceFullscreen, onClose]);

  useEffect(() => {
    let exitTimer: number | undefined;
    const handleChatNavigation = (event: Event) => {
      const detail = (event as CustomEvent<{ focusChat?: boolean }>).detail;
      if (detail?.focusChat && isEffectivelyFullscreen) {
        if (forceFullscreen) {
          onClose();
          return;
        }
        setIsExitingFullscreen(true);
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        exitTimer = window.setTimeout(
          () => {
            setIsFullscreen(false);
            setIsExitingFullscreen(false);
          },
          reducedMotion ? 0 : 150,
        );
      }
    };

    window.addEventListener("send-chat-prompt", handleChatNavigation);
    return () => {
      window.removeEventListener("send-chat-prompt", handleChatNavigation);
      if (exitTimer) window.clearTimeout(exitTimer);
    };
  }, [isEffectivelyFullscreen, forceFullscreen, onClose]);

  const renderContent = () => {
    switch (material.kind) {
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
      default:
        return (
          <div className="p-8 text-center text-text-tertiary">Unsupported material type</div>
        );
    }
  };

  const header = (
    <div className="flex items-center justify-between gap-2 p-1.5 bg-panel-header-bg min-h-[44px] shrink-0 select-none">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 px-2.5 text-xs text-text-secondary hover:text-text-primary cursor-pointer flex items-center gap-1.5 rounded-lg shrink-0"
          title="Return to Studio overview"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
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
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="h-8 w-8 text-text-secondary hover:text-text-primary cursor-pointer rounded-lg"
            title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen Mode"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        )}
        {isEffectivelyFullscreen && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-text-secondary hover:text-text-primary cursor-pointer rounded-lg"
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  if (isEffectivelyFullscreen || isExitingFullscreen) {
    return (
      <div
        className={`fixed inset-0 z-viewer flex h-[100dvh] w-screen flex-col overflow-hidden bg-surface-1 text-text-primary motion-reduce:animate-none ${
          isExitingFullscreen
            ? "animate-out fade-out duration-150"
            : "animate-in fade-in duration-150"
        }`}
      >
        {header}
        <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 md:p-8 max-w-7xl mx-auto w-full">
          {renderContent()}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-surface-1 text-text-primary overflow-hidden">
      {showHeader && header}
      <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 md:p-6">
        {renderContent()}
      </div>
    </div>
  );
}
