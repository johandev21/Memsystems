import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import type { Virtualizer } from "@tanstack/react-virtual";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/shared/utils/cn";
import type { ParsedSlideSegment } from "../../../utils/slide-segment-parser";
import { HighlightMatches } from "./slide-content-card";

export interface PptxSegmentItemProps {
  seg: ParsedSlideSegment;
  isActive: boolean;
  isCitation: boolean;
  searchQuery: string;
  onSelect: (seg: ParsedSlideSegment) => void;
}

export function PptxSegmentItem({
  seg,
  isActive,
  isCitation,
  searchQuery,
  onSelect,
}: PptxSegmentItemProps) {
  const { t } = useTranslation("sourceRenderers");
  return (
    <button
      type="button"
      data-testid="pptx-segment-item"
      data-active={isActive ? "true" : undefined}
      onClick={() => onSelect(seg)}
      className={cn(
        "w-full text-left rounded-lg border p-2.5 transition-colors cursor-pointer",
        isActive || isCitation
          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
          : "border-border/60 bg-card hover:bg-muted/50",
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <Badge variant="secondary" className="text-xs font-mono px-1.5 py-0">
          {t("pptxSegmentList.segmentBadge", {
            number: seg.slideNumber,
            ordinal: seg.ordinal,
          })}
        </Badge>
      </div>
      <p className="line-clamp-3 text-xs leading-relaxed text-foreground/80">
        {searchQuery ? (
          <>
            ↳ <HighlightMatches text={seg.content.slice(0, 80)} query={searchQuery} />
          </>
        ) : (
          `↳ ${seg.content.slice(0, 80)}${seg.content.length > 80 ? "…" : ""}`
        )}
      </p>
    </button>
  );
}

export interface SegmentListPanelProps {
  filteredSegments: ParsedSlideSegment[];
  activeSlideNumber: number | null;
  selectedSlideNumber?: number | null;
  searchQuery: string;
  isVirtualized: boolean;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  containerRef: RefObject<HTMLDivElement | null>;
  segmentRefs: RefObject<Map<number, HTMLDivElement>>;
  onSegmentClick: (seg: ParsedSlideSegment) => void;
}

export function SegmentListPanel({
  filteredSegments,
  activeSlideNumber,
  selectedSlideNumber,
  searchQuery,
  isVirtualized,
  virtualizer,
  containerRef,
  segmentRefs,
  onSegmentClick,
}: SegmentListPanelProps) {
  const { t } = useTranslation("sourceRenderers");
  return (
    <div className="hidden lg:flex w-72 shrink-0 flex-col border-l border-border/40 bg-muted/10 overflow-hidden">
      <div className="shrink-0 border-b border-border/40 px-3 py-2">
        <h3 className="text-xs font-semibold text-foreground">{t("pptxSegmentList.title")}</h3>
        <p className="text-xs text-muted-foreground">
          {t("pptxSegmentList.segmentCount", { count: filteredSegments.length })}
        </p>
      </div>
      <div ref={containerRef} className="flex-1 overflow-y-auto p-2">
        {filteredSegments.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            {t("pptxSegmentList.noSegmentsMatch", { query: searchQuery })}
          </p>
        ) : isVirtualized ? (
          <div className="relative w-full h-(--virtual-total)" style={{ "--virtual-total": `${virtualizer.getTotalSize()}px` } as React.CSSProperties}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const seg = filteredSegments[virtualRow.index];
              if (!seg) return null;
              return (
                <div
                  key={seg.id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  className="absolute top-0 left-0 w-full translate-y-(--virtual-start) py-1"
                  style={{ "--virtual-start": `${virtualRow.start}px` } as React.CSSProperties}
                >
                  <PptxSegmentItem
                    seg={seg}
                    isActive={activeSlideNumber === seg.slideNumber}
                    isCitation={selectedSlideNumber === seg.slideNumber}
                    searchQuery={searchQuery}
                    onSelect={onSegmentClick}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredSegments.map((seg) => (
              <div
                key={seg.id}
                ref={(el) => {
                  if (el) segmentRefs.current?.set(seg.slideNumber, el as unknown as HTMLDivElement);
                }}
              >
                <PptxSegmentItem
                  seg={seg}
                  isActive={activeSlideNumber === seg.slideNumber}
                  isCitation={selectedSlideNumber === seg.slideNumber}
                  searchQuery={searchQuery}
                  onSelect={onSegmentClick}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
