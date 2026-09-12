import { Badge } from "@/components/ui/badge";
import { Search, Sparkles, X } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface AudioTranscriptToolbarProps {
  searchQuery: string;
  onSearchChange: (v: string) => void;
}

export function AudioTranscriptToolbar({
  searchQuery,
  onSearchChange,
}: AudioTranscriptToolbarProps) {
  const { t } = useTranslation("sourceRenderers");
  return (
    <div className="shrink-0 border-b border-border/40 bg-muted/10 px-4 py-2">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            type="text"
            data-testid="transcript-search-input"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("audioTranscript.searchPlaceholder")}
            aria-label={t("audioTranscript.searchAria")}
            className="h-8 w-full rounded-lg border border-border/60 bg-background pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              title={t("common.clearSearch")}
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        <Badge variant="secondary" className="gap-1 font-normal text-xs shrink-0">
          <Sparkles className="size-3 text-primary" />
          {t("audioTranscript.aiTranscription")}
        </Badge>
      </div>
    </div>
  );
}
