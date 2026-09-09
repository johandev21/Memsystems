import { Layers, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ImageZoomBarProps {
  zoom: number;
  showOverlaysToggle: boolean;
  showOverlays: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onToggleOverlays: () => void;
}

export function ImageZoomBar({
  zoom,
  showOverlaysToggle,
  showOverlays,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onToggleOverlays,
}: ImageZoomBarProps) {
  return (
    <div className="absolute top-2 right-2 z-20 flex items-center gap-1 rounded-lg border border-border/80 bg-background/90 p-1 shadow-md backdrop-blur-xs">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onZoomOut}
        disabled={zoom <= 0.5}
        className="size-7 cursor-pointer text-muted-foreground hover:text-foreground"
        title="Zoom Out"
      >
        <ZoomOut className="size-3.5" />
      </Button>
      <span className="min-w-[36px] text-center text-[11px] font-medium text-muted-foreground">
        {Math.round(zoom * 100)}%
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onZoomIn}
        disabled={zoom >= 3}
        className="size-7 cursor-pointer text-muted-foreground hover:text-foreground"
        title="Zoom In"
      >
        <ZoomIn className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onResetZoom}
        className="size-7 cursor-pointer text-muted-foreground hover:text-foreground"
        title="Reset Zoom (100%)"
      >
        <RotateCcw className="size-3.5" />
      </Button>
      {showOverlaysToggle && (
        <Button
          type="button"
          variant={showOverlays ? "secondary" : "ghost"}
          size="icon"
          onClick={onToggleOverlays}
          className="size-7 cursor-pointer"
          title={showOverlays ? "Hide Region Highlights" : "Show Region Highlights"}
        >
          <Layers className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
