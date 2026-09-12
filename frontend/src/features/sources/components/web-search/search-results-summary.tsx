import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/cn";

export interface SearchResultsSummaryProps {
  summary: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

export function SearchResultsSummary({
  summary,
  expanded,
  onExpandedChange,
}: SearchResultsSummaryProps) {
  const { t } = useTranslation("sources");
  return (
    <div className="border-b border-border/60 px-3 py-2.5">
      <p className={cn("text-xs leading-5 text-muted-foreground", !expanded && "line-clamp-2")}>
        {summary}
      </p>
      <button
        type="button"
        onClick={() => onExpandedChange(!expanded)}
        className="mt-1 cursor-pointer text-xs font-medium text-primary hover:underline"
      >
        {expanded ? t("webSearchResults.showLess") : t("webSearchResults.showMore")}
      </button>
    </div>
  );
}
