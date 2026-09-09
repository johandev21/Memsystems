import { ImageIcon } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { formatTime, type ParsedVideoSegment } from "../../../utils/video-transcript-parser";

export interface TranscriptSegmentCardProps {
  segment: ParsedVideoSegment;
  isActive: boolean;
  isSelectedCitation: boolean;
  onSeek: (segment: ParsedVideoSegment) => void;
}

export function TranscriptSegmentCard({
  segment,
  isActive,
  isSelectedCitation,
  onSeek,
}: TranscriptSegmentCardProps) {
  return (
    <div
      data-testid="transcript-segment"
      data-active={isActive ? "true" : undefined}
      className={cn(
        "group rounded-lg border p-2.5 @min-[720px]:p-3 transition-colors",
        isActive || isSelectedCitation
          ? "border-primary/40 bg-surface-2 ring-1 ring-primary/20 shadow-2xs"
          : "border-surface-border-subtle bg-surface-1/70 hover:bg-surface-2 hover:border-surface-border",
      )}
    >
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="segment-timestamp"
          onClick={(e) => {
            e.stopPropagation();
            onSeek(segment);
          }}
          className="inline-flex items-center rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] font-medium text-text-muted hover:bg-surface-3 hover:text-text-primary transition-colors cursor-pointer"
          title="Seek video to this timestamp"
        >
          [{formatTime(segment.startOffsetMs / 1000)}]
        </button>

        {(segment.locator?.imageRegion || segment.kind === "visual_description") && (
          <span
            data-testid="visual-note-badge"
            className="inline-flex items-center gap-1 rounded-full border border-surface-border bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-text-secondary"
          >
            <ImageIcon className="size-2.5 text-text-faint" />
            Visual Note
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => onSeek(segment)}
        className="w-full text-left font-normal text-xs leading-relaxed text-text-primary select-text cursor-pointer focus:outline-none focus-visible:underline"
      >
        {segment.content}
      </button>
    </div>
  );
}
