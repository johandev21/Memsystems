import type { Virtualizer } from "@tanstack/react-virtual";
import type { ParsedAudioSegment } from "../../../utils/audio-transcript-parser";

export interface AudioTranscriptViewProps {
  filteredSegments: ParsedAudioSegment[];
  isVirtualized: boolean;
  searchQuery: string;
  transcriptContainerRef: React.RefObject<HTMLDivElement | null>;
  segmentElementsRef: React.RefObject<Map<string, HTMLDivElement>>;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  renderTranscriptCard: (segment: ParsedAudioSegment) => React.ReactNode;
}

export function AudioTranscriptView({
  filteredSegments,
  isVirtualized,
  searchQuery,
  transcriptContainerRef,
  segmentElementsRef,
  virtualizer,
  renderTranscriptCard,
}: AudioTranscriptViewProps) {
  return (
    <div
      ref={transcriptContainerRef}
      className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6"
    >
      {filteredSegments.length === 0 ? (
        <div className="py-16 text-center text-xs text-muted-foreground">
          {searchQuery
            ? `No transcript segments match "${searchQuery}".`
            : "No transcript segments available for this audio file."}
        </div>
      ) : isVirtualized ? (
        <div
          className="max-w-4xl mx-auto relative w-full"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const segment = filteredSegments[virtualRow.index];
            if (!segment) return null;
            return (
              <div
                key={segment.id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="py-1.5"
              >
                {renderTranscriptCard(segment)}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="max-w-4xl mx-auto space-y-3">
          {filteredSegments.map((segment) => (
            <div
              key={segment.id}
              ref={(el) => {
                if (el) segmentElementsRef.current.set(segment.id, el);
                else segmentElementsRef.current.delete(segment.id);
              }}
            >
              {renderTranscriptCard(segment)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
