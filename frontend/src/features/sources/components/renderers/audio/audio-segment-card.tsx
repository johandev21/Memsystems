import { Check, Edit2, User, X } from "lucide-react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/cn";
import { formatTime, type ParsedAudioSegment } from "../../../utils/audio-transcript-parser";

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightMatches({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={`${part}-${i}`} className="bg-warning/30 text-foreground rounded-xs px-0.5 font-medium">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

export interface AudioSegmentCardProps {
  segment: ParsedAudioSegment;
  isActive: boolean;
  isSelectedCitation: boolean;
  searchQuery: string;
  speakerColor: string;
  isEditingSpeaker: boolean;
  editingValue: string;
  onSegmentClick: (segment: ParsedAudioSegment) => void;
  onTimestampClick: (segment: ParsedAudioSegment) => void;
  onStartRename: (speaker: string, e: React.MouseEvent) => void;
  onRenameChange: (v: string) => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onSpeakerKeyDown: (e: ReactKeyboardEvent<HTMLInputElement>) => void;
}

export function AudioSegmentCard({
  segment,
  isActive,
  isSelectedCitation,
  searchQuery,
  speakerColor,
  isEditingSpeaker,
  editingValue,
  onSegmentClick,
  onTimestampClick,
  onStartRename,
  onRenameChange,
  onSaveRename,
  onCancelRename,
  onSpeakerKeyDown,
}: AudioSegmentCardProps) {
  const { t } = useTranslation("sourceRenderers");
  return (
    <div
      data-testid="transcript-segment"
      data-active={isActive ? "true" : undefined}
      className={cn(
        "group rounded-xl border p-3.5 transition-all",
        isActive || isSelectedCitation
          ? "border-primary bg-primary/5 ring-1 ring-primary/30 shadow-xs"
          : "border-border/60 bg-card/40 hover:border-border hover:bg-card/70",
      )}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="segment-timestamp"
            onClick={(e) => {
              e.stopPropagation();
              onTimestampClick(segment);
            }}
            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
            title={t("audioSegment.seekAudioTitle")}
          >
            [{formatTime(segment.startOffsetMs / 1000)}]
          </button>
          {segment.speaker && (
            <>
              {isEditingSpeaker ? (
                <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    autoFocus
                    data-testid="speaker-rename-input"
                    aria-label={t("audioSegment.renameSpeakerAria")}
                    value={editingValue}
                    onChange={(e) => onRenameChange(e.target.value)}
                    onKeyDown={onSpeakerKeyDown}
                    className="h-6 w-32 rounded border border-primary bg-background px-1.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    data-testid="speaker-rename-save"
                    onClick={onSaveRename}
                    className="size-5 flex items-center justify-center rounded bg-primary text-primary-foreground hover:opacity-90 cursor-pointer"
                    title={t("audioSegment.saveSpeakerName")}
                  >
                    <Check className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={onCancelRename}
                    className="size-5 flex items-center justify-center rounded bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                    title={t("audioSegment.cancelRename")}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  data-testid="speaker-badge"
                  onClick={(e) => onStartRename(segment.speaker!, e)}
                  className={cn(
                    "group/speaker inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-all cursor-pointer",
                    speakerColor,
                  )}
                  title={t("audioSegment.renameSpeakerTitle")}
                >
                  <User className="size-2.5" />
                  <span>{segment.speaker}</span>
                  <Edit2 className="size-2.5 opacity-0 group-hover/speaker:opacity-100 transition-opacity ml-0.5" />
                </button>
              )}
            </>
          )}
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">#{segment.ordinal}</span>
      </div>
      <button
        type="button"
        onClick={() => onSegmentClick(segment)}
        className="w-full text-left font-normal text-sm leading-relaxed text-foreground/90 select-text cursor-pointer focus:outline-none focus-visible:underline"
      >
        {searchQuery ? (
          <HighlightMatches text={segment.content} query={searchQuery} />
        ) : (
          segment.content
        )}
      </button>
    </div>
  );
}
