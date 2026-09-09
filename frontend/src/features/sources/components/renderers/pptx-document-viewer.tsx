import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertTriangle } from "lucide-react";
import type { SourceSegmentLocator, SourceWithContent } from "../../types";
import { type ParsedSlideSegment, parseRawTextToSlideSegments } from "../../utils/slide-segment-parser";
import { PptxViewerHeader } from "./pptx/pptx-header";
import { SlideNavigator, MobileSlideNavigator } from "./pptx/slide-navigator";
import { PptxSearchBar } from "./pptx/pptx-search-bar";
import { SlideContentCard } from "./pptx/slide-content-card";
import { SegmentListPanel } from "./pptx/segment-list-panel";

export interface PptxDocumentViewerProps {
  source: SourceWithContent;
  selectedLocator?: SourceSegmentLocator | null;
  scrollElement?: HTMLDivElement | null;
}

export function PptxDocumentViewer({ source, selectedLocator }: PptxDocumentViewerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSlideNumber, setSelectedSlideNumber] = useState<number | null>(null);
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

  const activeSlideNumber =
    selectedSlideNumber !== null && slideNumbers.includes(selectedSlideNumber)
      ? selectedSlideNumber
      : (slideNumbers[0] ?? null);

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

  // Citation jump via selectedLocator.slideNumber
  useEffect(() => {
    if (typeof selectedLocator?.slideNumber === "number") {
      const target = selectedLocator.slideNumber;
      setSelectedSlideNumber(target);
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
    source.processingErrorMessage || (segments.length === 0 ? undefined : null);

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
    setSelectedSlideNumber(num);
    const el = slideRefs.current.get(num);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const handleSegmentClick = (seg: ParsedSlideSegment) => {
    setSelectedSlideNumber(seg.slideNumber);
    const el = slideRefs.current.get(seg.slideNumber);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
      <PptxViewerHeader title={source.title} totalSlides={totalSlides} />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <SlideNavigator
          slideNumbers={slideNumbers}
          activeSlideNumber={activeSlideNumber}
          selectedSlideNumber={selectedLocator?.slideNumber}
          onSelect={handleSlideSelect}
        />

        {/* Center: Current Slide Content */}
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
          <PptxSearchBar searchQuery={searchQuery} onChange={setSearchQuery} />

          {/* Slide content area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {activeSlideNumber !== null ? (
              <SlideContentCard
                activeSlideNumber={activeSlideNumber}
                currentSlideSegments={currentSlideSegments}
                searchQuery={searchQuery}
                selectedSlideNumber={selectedLocator?.slideNumber}
                slideRefs={slideRefs}
              />
            ) : null}

            <MobileSlideNavigator
              slideNumbers={slideNumbers}
              activeSlideNumber={activeSlideNumber}
              onSelect={handleSlideSelect}
            />
          </div>
        </div>

        {/* Right: Segment list */}
        <SegmentListPanel
          filteredSegments={filteredSegments}
          activeSlideNumber={activeSlideNumber}
          selectedSlideNumber={selectedLocator?.slideNumber}
          searchQuery={searchQuery}
          isVirtualized={isSegmentsVirtualized}
          virtualizer={segmentVirtualizer}
          containerRef={segmentContainerRef}
          segmentRefs={segmentRefs}
          onSegmentClick={handleSegmentClick}
        />
      </div>
    </div>
  );
}
