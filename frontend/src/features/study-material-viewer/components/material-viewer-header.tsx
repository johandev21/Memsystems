import { ArrowLeft, Maximize2, Minimize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface MaterialViewerHeaderProps {
  title: string;
  isEffectivelyFullscreen: boolean;
  hasChatHandoff: boolean;
  forceFullscreen?: boolean;
  isFullscreen: boolean;
  onClose: () => void;
  onToggleFullscreen: () => void;
}

export function MaterialViewerHeader({
  title,
  isEffectivelyFullscreen,
  hasChatHandoff,
  forceFullscreen,
  isFullscreen,
  onClose,
  onToggleFullscreen,
}: MaterialViewerHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-2 p-1.5 bg-panel-header-bg min-h-[44px] shrink-0 select-none">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {!isEffectivelyFullscreen && !hasChatHandoff && (
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
        )}
        <h3 className="text-sm font-semibold truncate text-text-primary ml-1 min-w-0 flex-1">
          {title}
        </h3>
      </div>

      <div className="flex items-center gap-1">
        {!forceFullscreen && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleFullscreen}
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
}
