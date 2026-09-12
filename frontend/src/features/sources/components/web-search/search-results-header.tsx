import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export interface SearchResultsHeaderProps {
  candidatesCount: number;
  remainingSourceSlots: number;
  selectedCount: number;
  allSelectableSelected: boolean;
  selectableCount: number;
  importing: boolean;
  clearing: boolean;
  onClearResults: () => Promise<void>;
  onToggleSelectAll: () => void;
}

export function SearchResultsHeader({
  candidatesCount,
  remainingSourceSlots,
  selectedCount,
  allSelectableSelected,
  selectableCount,
  importing,
  clearing,
  onClearResults,
  onToggleSelectAll,
}: SearchResultsHeaderProps) {
  const { t } = useTranslation("sources");
  const subtitle =
    remainingSourceSlots < candidatesCount
      ? t("webSearchResults.sourceSlotsAvailable", { count: remainingSourceSlots })
      : t("webSearchResults.selectedCount", { count: selectedCount });

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
      <div>
        <p className="text-sm font-semibold text-foreground">
          {t("webSearchResults.sourceFound", { count: candidatesCount })}
        </p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7"
          onClick={onClearResults}
          disabled={importing || clearing}
        >
          {clearing ? t("webSearch.clearing") : t("webSearch.clearResults")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7"
          onClick={onToggleSelectAll}
          disabled={importing || clearing || selectableCount === 0}
        >
          {allSelectableSelected ? t("webSearch.deselectAll") : t("webSearch.selectAll")}
        </Button>
      </div>
    </div>
  );
}
