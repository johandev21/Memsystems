import { AlertTriangle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/cn";
import type { ImageRegion } from "../../../types";
import type { ParsedImageSection, ViewMode } from "./image-types";
import { ImageZoomBar } from "./image-zoom-bar";
import { ImageRegionOverlays } from "./image-region-overlays";

export interface ImagePreviewPanelProps {
  viewMode: ViewMode;
  zoom: number;
  segmentsWithRegions: ParsedImageSection[];
  showOverlays: boolean;
  isLoadingImage: boolean;
  isImageError: boolean;
  imageUrl: string | null;
  sourceTitle: string;
  activeSegmentId: string | null;
  hoveredSegmentId: string | null;
  selectedRegion?: ImageRegion | null;
  imageViewportRef: React.RefObject<HTMLDivElement | null>;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onToggleOverlays: () => void;
  onSelectSegment: (id: string) => void;
  onHoverSegment: (id: string | null) => void;
}

export function ImagePreviewPanel({
  viewMode,
  zoom,
  segmentsWithRegions,
  showOverlays,
  isLoadingImage,
  isImageError,
  imageUrl,
  sourceTitle,
  activeSegmentId,
  hoveredSegmentId,
  selectedRegion,
  imageViewportRef,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onToggleOverlays,
  onSelectSegment,
  onHoverSegment,
}: ImagePreviewPanelProps) {
  const { t } = useTranslation("sourceRenderers");
  return (
    <div
      className={cn(
        "flex flex-col border-r border-border/60 bg-muted/10 relative overflow-hidden",
        viewMode === "split" ? "w-full lg:w-1/2" : "w-full",
      )}
    >
      <ImageZoomBar
        zoom={zoom}
        showOverlaysToggle={segmentsWithRegions.length > 0}
        showOverlays={showOverlays}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onResetZoom={onResetZoom}
        onToggleOverlays={onToggleOverlays}
      />

      <div
        ref={imageViewportRef}
        className="flex flex-1 items-center justify-center overflow-auto p-4 select-none"
      >
        {isLoadingImage ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span className="text-xs">{t("imagePreview.loadingImage")}</span>
          </div>
        ) : isImageError || !imageUrl ? (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-muted-foreground">
            <AlertTriangle className="size-8 text-warning" />
            <span className="text-sm font-medium">{t("imagePreview.imagePreviewUnavailable")}</span>
            <span className="text-xs text-muted-foreground">
              {t("imagePreview.imageLoadFailed")}
            </span>
          </div>
        ) : (
          <div
            className="relative inline-block transition-transform duration-100 ease-out max-w-full"
            style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
          >
            <img
              src={imageUrl}
              alt={sourceTitle}
              className="max-h-[85vh] max-w-full rounded-md object-contain shadow-xs border border-border/40"
            />

            {showOverlays && (
              <ImageRegionOverlays
                segmentsWithRegions={segmentsWithRegions}
                activeSegmentId={activeSegmentId}
                hoveredSegmentId={hoveredSegmentId}
                selectedRegion={selectedRegion}
                onSelectSegment={onSelectSegment}
                onHoverSegment={onHoverSegment}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
