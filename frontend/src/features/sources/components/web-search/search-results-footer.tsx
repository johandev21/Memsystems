import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export interface SearchResultsFooterProps {
  hasImportResults: boolean;
  selectedCount: number;
  importedCount: number;
  failedUrls: string[];
  importing: boolean;
  clearing: boolean;
  onRetryFailed: () => void;
  onImportSelected: () => void;
}

export function SearchResultsFooter({
  hasImportResults,
  selectedCount,
  importedCount,
  failedUrls,
  importing,
  clearing,
  onRetryFailed,
  onImportSelected,
}: SearchResultsFooterProps) {
  const { t } = useTranslation("sources");
  const statusText = hasImportResults
    ? failedUrls.length > 0
      ? t("webSearchResults.addedAndFailed", {
          added: importedCount,
          failed: failedUrls.length,
        })
      : t("webSearchResults.addedCount", { count: importedCount })
    : t("webSearchResults.selectedCount", { count: selectedCount });

  return (
    <div className="flex flex-col gap-2 border-t border-border/60 bg-muted/15 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div aria-live="polite" className="text-xs text-muted-foreground">
        {statusText}
      </div>
      <div className="flex items-center justify-end gap-2">
        {failedUrls.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetryFailed}
            disabled={importing || clearing}
          >
            {importing ? <Loader2 className="animate-spin" /> : null}
            {t("webSearchResults.retryFailed")}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          onClick={onImportSelected}
          disabled={selectedCount === 0 || importing || clearing}
        >
          {importing ? <Loader2 className="animate-spin" /> : null}
          {importing ? t("webSearchResults.adding") : t("webSearchResults.addSelected")}
        </Button>
      </div>
    </div>
  );
}
