import { Check, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/shared/utils/cn";
import type { WebSearchCandidate, WebSearchImportResultItem } from "../../api/web-search";
import { getHostname } from "./web-search-utils";

export interface SearchCandidateRowProps {
  candidate: WebSearchCandidate;
  result?: WebSearchImportResultItem;
  selected: boolean;
  selectionDisabled: boolean;
  onToggleCandidate: (url: string) => void;
}

export function SearchCandidateRow({
  candidate,
  result,
  selected,
  selectionDisabled,
  onToggleCandidate,
}: SearchCandidateRowProps) {
  const { t } = useTranslation("sources");
  const settled = result && (result.status === "added" || result.status === "duplicate");

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl px-2 py-2.5",
        selected && !settled && "bg-muted/45",
        settled && "opacity-65",
      )}
    >
      {settled ? (
        <span
          className="mt-0.5 flex size-4 shrink-0 items-center justify-center"
          title={t("webSearchResults.added")}
        >
          <Check className="size-3.5 text-success" />
        </span>
      ) : (
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleCandidate(candidate.url)}
          disabled={selectionDisabled}
          aria-label={t("webSearchResults.selectLabel", { title: candidate.title })}
          className="mt-0.5"
        />
      )}
      <div className="min-w-0 flex-1">
        <a
          href={candidate.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex max-w-full items-center gap-1.5 text-sm font-medium text-foreground hover:underline"
        >
          <span className="truncate">{candidate.title}</span>
          <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
          <span className="sr-only">{t("webSearchResults.opensNewTab")}</span>
        </a>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {getHostname(candidate.url)}
        </p>
        {candidate.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {candidate.description}
          </p>
        )}
        {result && result.status !== "added" && result.status !== "duplicate" && (
          <p
            className={cn(
              "mt-1 text-xs",
              result.status === "scrape_failed"
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          >
            {result.status === "scrape_failed"
              ? t("webSearchResults.addError", {
                  error: result.error ?? t("webSearchResults.fetchFailed"),
                })
              : t("webSearchResults.limitReached")}
          </p>
        )}
      </div>
    </div>
  );
}
