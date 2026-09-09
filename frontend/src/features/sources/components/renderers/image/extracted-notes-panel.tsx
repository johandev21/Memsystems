import { AlertTriangle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/shared/utils/cn";
import type { ParsedImageSection, ViewMode } from "./image-types";
import { ImageNoteCard } from "./image-note-card";

export interface ExtractedNotesPanelProps {
  viewMode: ViewMode;
  warningMessage: string | null;
  sections: ParsedImageSection[];
  activeSegmentId: string | null;
  hoveredSegmentId: string | null;
  notesContainerRef: React.RefObject<HTMLDivElement | null>;
  noteElementsRef: React.RefObject<Map<string, HTMLDivElement>>;
  onSelectSegment: (id: string) => void;
  onHoverSegment: (id: string | null) => void;
}

export function ExtractedNotesPanel({
  viewMode,
  warningMessage,
  sections,
  activeSegmentId,
  hoveredSegmentId,
  notesContainerRef,
  noteElementsRef,
  onSelectSegment,
  onHoverSegment,
}: ExtractedNotesPanelProps) {
  return (
    <div
      ref={notesContainerRef}
      className={cn(
        "flex flex-col overflow-y-auto overscroll-contain bg-background p-4 sm:p-6",
        viewMode === "split" ? "w-full lg:w-1/2" : "w-full max-w-4xl mx-auto",
      )}
    >
      <div className="mb-4 space-y-2 border-b border-border/40 pb-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold tracking-tight text-foreground">Extracted Notes</h2>
          <Badge variant="secondary" className="gap-1 font-normal text-xs">
            <Sparkles className="size-3 text-primary" />
            AI Vision Analysis
          </Badge>
        </div>

        {warningMessage && (
          <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning-foreground">
            <AlertTriangle className="size-4 shrink-0 text-warning mt-0.5" />
            <div>
              <div className="font-semibold">Notice</div>
              <div className="text-muted-foreground">{warningMessage}</div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {sections.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No extracted text or visual analysis available for this image.
          </div>
        ) : (
          sections.map((section) => (
            <ImageNoteCard
              key={section.id}
              section={section}
              isActive={activeSegmentId === section.id}
              isHovered={hoveredSegmentId === section.id}
              onHover={onHoverSegment}
              onSelect={onSelectSegment}
              noteRefs={noteElementsRef}
            />
          ))
        )}
      </div>
    </div>
  );
}
