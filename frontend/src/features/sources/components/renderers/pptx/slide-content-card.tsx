import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/shared/utils/cn";
import type { ParsedSlideSegment } from "../../../utils/slide-segment-parser";

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function HighlightMatches({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, "gi"));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={`${part}-${index}`}
            className="bg-warning/30 text-foreground rounded-xs px-0.5 font-medium"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

export interface SlideContentCardProps {
  activeSlideNumber: number;
  currentSlideSegments: ParsedSlideSegment[];
  searchQuery: string;
  selectedSlideNumber?: number | null;
  slideRefs: RefObject<Map<number, HTMLDivElement>>;
}

export function SlideContentCard({
  activeSlideNumber,
  currentSlideSegments,
  searchQuery,
  selectedSlideNumber,
  slideRefs,
}: SlideContentCardProps) {
  const { t } = useTranslation("sourceRenderers");
  return (
    <div
      ref={(el) => {
        if (el) slideRefs.current?.set(activeSlideNumber, el);
        else slideRefs.current?.delete(activeSlideNumber);
      }}
      data-testid="slide-content"
      data-slide-number={activeSlideNumber}
      className="rounded-xl border border-border/60 bg-card/40 p-4 sm:p-5 shadow-xs"
    >
      <div className="mb-3 flex items-center justify-between">
        <Badge variant="outline" className="font-mono text-xs">
          {t("pptxSlideContent.slideLabel", { number: activeSlideNumber })}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {t("pptxSlideContent.blockCount", { count: currentSlideSegments.length })}
        </span>
      </div>
      {currentSlideSegments.length === 0 ? (
        <p className="text-xs text-muted-foreground py-8 text-center">
          {t("pptxSlideContent.noContentMatch", { query: searchQuery })}
        </p>
      ) : (
        <div className="space-y-3">
          {currentSlideSegments.map((seg) => {
            const isSelected = selectedSlideNumber === seg.slideNumber;
            return (
              <div
                key={seg.id}
                data-testid="slide-segment"
                data-slide-number={seg.slideNumber}
                className={cn(
                  "rounded-lg border p-3 transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border/40 bg-background",
                )}
              >
                {seg.kind === "heading" ? (
                  <h3 className="font-bold text-foreground text-base tracking-tight">
                    {searchQuery ? (
                      <HighlightMatches text={seg.content} query={searchQuery} />
                    ) : (
                      seg.content
                    )}
                  </h3>
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                    {searchQuery ? (
                      <HighlightMatches text={seg.content} query={searchQuery} />
                    ) : (
                      seg.content
                    )}
                  </p>
                )}
                <span className="mt-2 inline-flex text-xs font-mono text-muted-foreground">
                  {t("pptxSlideContent.slideRef", { number: seg.slideNumber })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
