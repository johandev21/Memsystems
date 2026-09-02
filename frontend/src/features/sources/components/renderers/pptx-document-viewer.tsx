import { AlertTriangle, Presentation, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/shared/utils/cn";
import type { SourceSegmentLocator, SourceWithContent } from "../../types";

export interface PptxDocumentViewerProps {
  source: SourceWithContent;
  selectedLocator?: SourceSegmentLocator | null;
  scrollElement?: HTMLDivElement | null;
}

interface ParsedSlideSegment {
  id: string;
  ordinal: number;
  slideNumber: number;
  content: string;
  kind?: string;
  locator?: SourceSegmentLocator;
}

export function PptxDocumentViewer({ source, selectedLocator }: PptxDocumentViewerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSlideNumber, setActiveSlideNumber] = useState<number | null>(null);
  const segmentContainerRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const slideRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const segments = useMemo<ParsedSlideSegment[]>(() => {
    const srcSegments = source.segments;
    if (srcSegments && srcSegments.length > 0) {
      return srcSegments.map((seg, idx) => ({
        id: seg.id || `seg-${idx}`,
        ordinal: seg.ordinal ?? idx + 1,
        slideNumber: seg.locator?.slideNumber ?? idx + 1,
        content: seg.content,
        kind: seg.kind,
        locator: seg.locator,
      }));
    }
    return parseRawTextToSlideSegments(source.rawText || "");
  }, [source.segments, source.rawText]);

  const slideNumbers = useMemo(() => {
    const nums = Array.from(new Set(segments.map((s) => s.slideNumber))).sort((a, b) => a - b);
    if (nums.length === 0 && source.rawText) {
      return segments.map((s) => s.slideNumber);
    }
    return nums;
  }, [segments, source.rawText]);

  const totalSlides = slideNumbers.length > 0 ? Math.max(...slideNumbers) : segments.length;

  const filteredSegments = useMemo(() => {
    if (!searchQuery.trim()) return segments;
    const q = searchQuery.toLowerCase();
    return segments.filter((s) => s.content.toLowerCase().includes(q));
  }, [segments, searchQuery]);

  const isSegmentsVirtualized = filteredSegments.length > 25;

  const segmentVirtualizer = useVirtualizer({
    count: filteredSegments.length,
    getScrollElement: () => segmentContainerRef.current,
    estimateSize: () => 75,
    overscan: 5,
    getItemKey: (index) => filteredSegments[index]?.id ?? index,
    enabled: isSegmentsVirtualized,
    initialRect: { width: 800, height: 600 },
  });

  // Initialize active slide
  useEffect(() => {
    if (slideNumbers.length > 0 && activeSlideNumber === null) {
      setActiveSlideNumber(slideNumbers[0]);
    }
  }, [slideNumbers, activeSlideNumber]);

  // Citation jump via selectedLocator.slideNumber
  useEffect(() => {
    if (typeof selectedLocator?.slideNumber === "number") {
      const target = selectedLocator.slideNumber;
      setActiveSlideNumber(target);
      const el = slideRefs.current.get(target);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });

      if (isSegmentsVirtualized) {
        const segIdx = filteredSegments.findIndex((s) => s.slideNumber === target);
        if (segIdx !== -1) {
          segmentVirtualizer.scrollToIndex(segIdx, { align: "center", behavior: "smooth" });
        }
      } else {
        const segEl = segmentRefs.current.get(target);
        segEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [selectedLocator, isSegmentsVirtualized, filteredSegments, segmentVirtualizer]);

  const currentSlideSegments = useMemo(() => {
    if (activeSlideNumber === null) return filteredSegments;
    return filteredSegments.filter((s) => s.slideNumber === activeSlideNumber);
  }, [filteredSegments, activeSlideNumber]);

  const warningMessage =
    source.processingErrorMessage ||
    (segments.length === 0 ? undefined : null);

  if (segments.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-8 text-center bg-background">
        <div className="flex size-12 items-center justify-center rounded-full bg-warning/10 text-warning">
          <AlertTriangle className="size-6" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">No slides extracted</h3>
        <p className="max-w-sm text-xs text-muted-foreground">
          {warningMessage || "This presentation has no extractable slide content."}
        </p>
      </div>
    );
  }

  const handleSlideSelect = (num: number) => {
    setActiveSlideNumber(num);
    const el = slideRefs.current.get(num);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const handleSegmentClick = (seg: ParsedSlideSegment) => {
    setActiveSlideNumber(seg.slideNumber);
    const el = slideRefs.current.get(seg.slideNumber);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
      {/* Header */}
      <div className="shrink-0 border-b border-border/60 bg-card/60 backdrop-blur-md px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="outline" className="gap-1 font-normal text-muted-foreground shrink-0">
              <Presentation className="size-3 text-primary" />
              Presentation
            </Badge>
            <h2 className="truncate text-sm font-semibold text-foreground">{source.title}</h2>
          </div>
          <Badge variant="secondary" className="font-normal text-[11px] shrink-0">
            {totalSlides} {totalSlides === 1 ? "slide" : "slides"}
          </Badge>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Slide Navigator */}
        <div className="hidden sm:flex w-20 shrink-0 flex-col border-r border-border/40 bg-muted/20 overflow-y-auto p-2 gap-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground px-1 py-1">Slides</span>
          {slideNumbers.map((num) => {
            const isActive = activeSlideNumber === num;
            const isCitationTarget = selectedLocator?.slideNumber === num;
            return (
              <button
                key={num}
                type="button"
                data-testid="slide-nav-item"
                data-active={isActive ? "true" : undefined}
                onClick={() => handleSlideSelect(num)}
                className={cn(
                  "flex h-12 w-full items-center justify-center rounded-lg border text-xs font-semibold transition-colors cursor-pointer",
                  isActive || isCitationTarget
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border/60 bg-card hover:bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {num}
              </button>
            );
          })}
        </div>

        {/* Center: Current Slide Content */}
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
          {/* Search toolbar */}
          <div className="shrink-0 border-b border-border/40 bg-muted/10 px-4 py-2">
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                type="text"
                data-testid="pptx-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search slides…"
                className="h-8 w-full rounded-lg border border-border/60 bg-background pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Clear search"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          </div>

          {/* Slide content area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {activeSlideNumber !== null ? (
              <div
                ref={(el) => {
                  if (el) slideRefs.current.set(activeSlideNumber, el);
                  else slideRefs.current.delete(activeSlideNumber);
                }}
                data-testid="slide-content"
                data-slide-number={activeSlideNumber}
                className="rounded-xl border border-border/60 bg-card/40 p-4 sm:p-5 shadow-xs"
              >
                <div className="mb-3 flex items-center justify-between">
                  <Badge variant="outline" className="font-mono text-[11px]">
                    Slide {activeSlideNumber}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {currentSlideSegments.length} {currentSlideSegments.length === 1 ? "block" : "blocks"}
                  </span>
                </div>
                {currentSlideSegments.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-8 text-center">
                    No content matches &quot;{searchQuery}&quot; on this slide.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {currentSlideSegments.map((seg) => {
                      const isSelected = selectedLocator?.slideNumber === seg.slideNumber;
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
                              {searchQuery ? <HighlightMatches text={seg.content} query={searchQuery} /> : seg.content}
                            </h3>
                          ) : (
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                              {searchQuery ? <HighlightMatches text={seg.content} query={searchQuery} /> : seg.content}
                            </p>
                          )}
                          <span className="mt-2 inline-flex text-[10px] font-mono text-muted-foreground">
                            [Slide {seg.slideNumber}]
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

            {/* Mobile slide navigator horizontal */}
            <div className="flex sm:hidden gap-1.5 overflow-x-auto pb-2">
              {slideNumbers.map((num) => (
                <button
                  key={num}
                  type="button"
                  data-testid="slide-nav-item-mobile"
                  onClick={() => handleSlideSelect(num)}
                  className={cn(
                    "h-8 min-w-8 rounded-lg border px-3 text-xs font-semibold shrink-0 cursor-pointer",
                    activeSlideNumber === num
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/60 bg-card text-muted-foreground",
                  )}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Segment list */}
        <div className="hidden lg:flex w-72 shrink-0 flex-col border-l border-border/40 bg-muted/10 overflow-hidden">
          <div className="shrink-0 border-b border-border/40 px-3 py-2">
            <h3 className="text-xs font-semibold text-foreground">Slide Segments</h3>
            <p className="text-[11px] text-muted-foreground">{filteredSegments.length} segments</p>
          </div>
          <div
            ref={segmentContainerRef}
            className="flex-1 overflow-y-auto p-2"
          >
            {filteredSegments.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No segments match &quot;{searchQuery}&quot;.
              </p>
            ) : isSegmentsVirtualized ? (
              <div
                className="relative w-full"
                style={{ height: `${segmentVirtualizer.getTotalSize()}px` }}
              >
                {segmentVirtualizer.getVirtualItems().map((virtualRow) => {
                  const seg = filteredSegments[virtualRow.index];
                  if (!seg) return null;
                  const isActive = activeSlideNumber === seg.slideNumber;
                  const isCitation = selectedLocator?.slideNumber === seg.slideNumber;

                  return (
                    <div
                      key={seg.id}
                      data-index={virtualRow.index}
                      ref={segmentVirtualizer.measureElement}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      className="py-1"
                    >
                      <button
                        type="button"
                        data-testid="pptx-segment-item"
                        data-active={isActive ? "true" : undefined}
                        onClick={() => handleSegmentClick(seg)}
                        className={cn(
                          "w-full text-left rounded-lg border p-2.5 transition-colors cursor-pointer",
                          isActive || isCitation
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                            : "border-border/60 bg-card hover:bg-muted/50",
                        )}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
                            Slide {seg.slideNumber} · #{seg.ordinal}
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
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSegments.map((seg) => {
                  const isActive = activeSlideNumber === seg.slideNumber;
                  const isCitation = selectedLocator?.slideNumber === seg.slideNumber;
                  return (
                    <button
                      key={seg.id}
                      type="button"
                      data-testid="pptx-segment-item"
                      data-active={isActive ? "true" : undefined}
                      onClick={() => handleSegmentClick(seg)}
                      ref={(el) => {
                        if (el) segmentRefs.current.set(seg.slideNumber, el as unknown as HTMLDivElement);
                      }}
                      className={cn(
                        "w-full text-left rounded-lg border p-2.5 transition-colors cursor-pointer",
                        isActive || isCitation
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-border/60 bg-card hover:bg-muted/50",
                      )}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
                          Slide {seg.slideNumber} · #{seg.ordinal}
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
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function parseRawTextToSlideSegments(rawText: string): ParsedSlideSegment[] {
  if (!rawText || !rawText.trim()) return [];
  const chunks = rawText.split(/\n\n+/).filter(Boolean);
  return chunks.map((chunk, idx) => ({
    id: `raw-slide-${idx}`,
    ordinal: idx + 1,
    slideNumber: idx + 1,
    content: chunk.trim(),
    locator: { slideNumber: idx + 1 },
  }));
}

function HighlightMatches({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-warning/30 text-foreground rounded-xs px-0.5 font-medium">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type { ParsedSlideSegment };
