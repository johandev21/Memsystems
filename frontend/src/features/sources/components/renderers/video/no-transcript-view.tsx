import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";

export interface NoTranscriptViewProps {
  videoContainerRef: React.RefObject<HTMLDivElement | null>;
  player: ReactNode;
  onAddTranscripts: () => void;
}

export function NoTranscriptView({
  videoContainerRef,
  player,
  onAddTranscripts,
}: NoTranscriptViewProps) {
  const { t } = useTranslation("sourceRenderers");
  return (
    <div className="flex h-full w-full flex-col @min-[720px]:items-center @min-[720px]:justify-center @min-[720px]:p-6 overflow-y-auto overscroll-contain">
      <div className="w-full @min-[720px]:max-w-4xl @min-[1100px]:max-w-5xl flex flex-col shrink-0">
        <div
          ref={videoContainerRef}
          className="relative w-full aspect-video bg-black @min-[720px]:rounded-xl overflow-hidden @min-[720px]:shadow-md @min-[720px]:border @min-[720px]:border-surface-border flex items-center justify-center shrink-0 select-none max-h-[50vh] @min-[720px]:max-h-[75vh]"
        >
          {player}
        </div>

        <div className="hidden @min-[720px]:flex items-center justify-between w-full px-2 py-3 text-text-muted">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-text-secondary" />
            <span className="text-xs">{t("videoTranscript.noTranscriptAttached")}</span>
          </div>
          <button
            type="button"
            data-testid="add-transcripts-button-wide"
            onClick={onAddTranscripts}
            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 px-3.5 py-1.5 text-xs font-medium text-text-primary border border-surface-border shadow-2xs transition-colors cursor-pointer"
          >
            <FileText className="size-3.5 text-primary" />
            {t("videoTranscript.addTranscripts")}
          </button>
        </div>
      </div>

      <div className="flex @min-[720px]:hidden flex-1 min-h-0 flex-col items-center justify-center p-6 text-center bg-surface-0">
        <div className="flex size-12 items-center justify-center rounded-xl bg-surface-2 text-text-muted mb-3">
          <FileText className="size-6 text-text-secondary" />
        </div>
        <h4 className="text-sm font-semibold text-text-primary mb-1">
          {t("videoTranscript.noTranscripts")}
        </h4>
        <p className="text-xs text-text-muted max-w-[260px] leading-relaxed mb-4">
          {t("videoTranscript.noTranscriptsDescription")}
        </p>
        <button
          type="button"
          data-testid="add-transcripts-button"
          onClick={onAddTranscripts}
          className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-3.5 py-2 text-xs font-medium text-text-primary border border-surface-border shadow-xs hover:bg-surface-3 transition-colors cursor-pointer"
        >
          <FileText className="size-3.5 text-primary" />
          {t("videoTranscript.addTranscripts")}
        </button>
      </div>
    </div>
  );
}
