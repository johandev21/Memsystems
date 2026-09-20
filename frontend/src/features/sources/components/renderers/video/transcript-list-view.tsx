import type { Virtualizer } from "@tanstack/react-virtual";
import type { ParsedVideoSegment } from "../../../utils/video-transcript-parser";
import { TranscriptSegmentCard } from "./transcript-segment-card";

export interface TranscriptListViewProps {
  segments: ParsedVideoSegment[];
  activeSegmentId: string | null;
  selectedStartOffsetMs?: number | null;
  isVirtualized: boolean;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  segmentRefs: React.RefObject<Map<string, HTMLDivElement>>;
  onSeek: (segment: ParsedVideoSegment) => void;
}

export function TranscriptListView({
  segments,
  activeSegmentId,
  selectedStartOffsetMs,
  isVirtualized,
  virtualizer,
  containerRef,
  segmentRefs,
  onSeek,
}: TranscriptListViewProps) {
  const isSelected = (segment: ParsedVideoSegment) =>
    typeof selectedStartOffsetMs === "number" &&
    Math.abs(segment.startOffsetMs - selectedStartOffsetMs) < 1000;

  return (
    <div ref={containerRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 @min-[720px]:p-4">
      {isVirtualized ? (
        <div className="relative w-full h-(--virtual-total)" style={{ "--virtual-total": `${virtualizer.getTotalSize()}px` } as React.CSSProperties}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const segment = segments[virtualRow.index];
            if (!segment) return null;
            return (
              <div
                key={segment.id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className="absolute top-0 left-0 w-full translate-y-(--virtual-start) py-1"
                style={{ "--virtual-start": `${virtualRow.start}px` } as React.CSSProperties}
              >
                <TranscriptSegmentCard
                  segment={segment}
                  isActive={activeSegmentId === segment.id}
                  isSelectedCitation={isSelected(segment)}
                  onSeek={onSeek}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {segments.map((segment) => (
            <div
              key={segment.id}
              ref={(el) => {
                if (el) segmentRefs.current.set(segment.id, el);
                else segmentRefs.current.delete(segment.id);
              }}
            >
              <TranscriptSegmentCard
                segment={segment}
                isActive={activeSegmentId === segment.id}
                isSelectedCitation={isSelected(segment)}
                onSeek={onSeek}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
