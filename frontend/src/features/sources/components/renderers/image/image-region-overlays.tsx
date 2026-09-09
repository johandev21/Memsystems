import { cn } from "@/shared/utils/cn";
import type { ImageRegion } from "../../../types";
import type { ParsedImageSection } from "./image-types";
import { isMatchingRegion } from "./image-helpers";

export interface ImageRegionOverlaysProps {
  segmentsWithRegions: ParsedImageSection[];
  activeSegmentId: string | null;
  hoveredSegmentId: string | null;
  selectedRegion?: ImageRegion | null;
  onSelectSegment: (id: string) => void;
  onHoverSegment: (id: string | null) => void;
}

export function ImageRegionOverlays({
  segmentsWithRegions,
  activeSegmentId,
  hoveredSegmentId,
  selectedRegion,
  onSelectSegment,
  onHoverSegment,
}: ImageRegionOverlaysProps) {
  return (
    <>
      {segmentsWithRegions.map((section) => {
        const region = section.locator?.imageRegion;
        if (!region) return null;

        const isActive = activeSegmentId === section.id;
        const isHovered = hoveredSegmentId === section.id;
        const isCitationTarget = isMatchingRegion(region, selectedRegion);

        return (
          <button
            key={section.id}
            type="button"
            data-testid="image-region-box"
            onClick={() => onSelectSegment(section.id)}
            onMouseEnter={() => onHoverSegment(section.id)}
            onMouseLeave={() => onHoverSegment(null)}
            className={cn(
              "absolute rounded transition-all cursor-pointer pointer-events-auto",
              isActive || isCitationTarget
                ? "border-2 border-primary bg-primary/30 ring-2 ring-primary/60 shadow-lg z-30"
                : isHovered
                  ? "border-2 border-primary bg-primary/20 ring-1 ring-primary/40 z-20"
                  : "border border-primary/60 bg-primary/10 hover:border-primary hover:bg-primary/20 z-10",
            )}
            style={{
              left: `${Math.max(0, Math.min(100, region.x * 100))}%`,
              top: `${Math.max(0, Math.min(100, region.y * 100))}%`,
              width: `${Math.max(0, Math.min(100, region.width * 100))}%`,
              height: `${Math.max(0, Math.min(100, region.height * 100))}%`,
            }}
            aria-label={`Region #${section.ordinal}: ${section.kind}`}
          >
            <span
              className={cn(
                "absolute -top-3.5 -left-0.5 rounded px-1 py-0 text-[10px] font-bold shadow-xs whitespace-nowrap",
                isActive || isCitationTarget
                  ? "bg-primary text-primary-foreground"
                  : "bg-primary/80 text-primary-foreground",
              )}
            >
              #{section.ordinal}
            </span>
          </button>
        );
      })}
    </>
  );
}
