import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { WebSearchImportResultItem } from "../api/web-search";
import { useWebSearch } from "../hooks/use-web-search";
import { SearchResults } from "./web-search/search-results";

export type { WebSearchImportResultItem };

export function WebSearchComposer({
  notebookId,
  remainingSourceSlots,
}: {
  notebookId: string;
  remainingSourceSlots: number;
}) {
  const { t } = useTranslation("sources");
  const webSearch = useWebSearch(notebookId, remainingSourceSlots);
  const [expanded, setExpanded] = useState(false);
  const [clearAnnouncement, setClearAnnouncement] = useState("");
  const searchInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (clearAnnouncement) searchInputRef.current?.focus();
  }, [clearAnnouncement]);

  const handleSubmit = () => {
    webSearch.runSearch();
  };

  const handleClearResults = async () => {
    setClearAnnouncement("");
    const cleared = await webSearch.clearResults();
    if (!cleared) return;
    setExpanded(false);
    setClearAnnouncement(t("webSearch.resultsCleared"));
  };

  const failedUrls = useMemo(
    () =>
      [...webSearch.importResults.entries()].reduce<string[]>((urls, [url, result]) => {
        if (result.status === "scrape_failed") urls.push(url);
        return urls;
      }, []),
    [webSearch.importResults],
  );

  const importedCount = useMemo(
    () =>
      [...webSearch.importResults.values()].filter((result) => result.status === "added").length,
    [webSearch.importResults],
  );

  const friendlyError = webSearch.searchError;
  const isAtSourceLimit = remainingSourceSlots === 0;

  return (
    <section aria-labelledby="web-source-search-title" className="flex flex-col gap-3">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {clearAnnouncement}
      </div>
      <div>
        <h3 id="web-source-search-title" className="font-medium text-foreground">
          {t("webSearch.title")}
        </h3>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          {t("webSearch.intro")}
        </p>
      </div>

      <div className="rounded-2xl border border-composer-border bg-composer-bg p-2 shadow-sm transition-frame focus-within:border-ring/60 focus-within:ring-2 focus-within:ring-ring/15">
        <textarea
          ref={searchInputRef}
          aria-label={t("webSearch.inputLabel")}
          value={webSearch.query}
          onChange={(event) => webSearch.setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={t("webSearch.inputPlaceholder")}
          disabled={isAtSourceLimit}
          className="field-sizing-content min-h-16 w-full resize-none bg-transparent px-3 py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground/70 disabled:cursor-not-allowed disabled:opacity-60"
        />

        <div className="flex justify-end px-1 pb-1">
          <Button
            type="button"
            size="sm"
            className="h-8 rounded-xl px-4"
            onClick={handleSubmit}
            disabled={
              isAtSourceLimit ||
              webSearch.clearing ||
              !webSearch.query.trim() ||
              webSearch.phase === "searching"
            }
          >
            {webSearch.phase === "searching" ? (
              <>
                <Loader2 className="animate-spin" />
                {t("webSearch.searching")}
              </>
            ) : (
              t("webSearch.search")
            )}
          </Button>
        </div>
      </div>

      {isAtSourceLimit && (
        <Alert>
          <AlertTitle>{t("webSearch.limitReached")}</AlertTitle>
          <AlertDescription>
            {t("webSearch.limitReachedDescription")}
          </AlertDescription>
        </Alert>
      )}

      <div aria-live="polite" aria-atomic="true">
        {webSearch.phase === "searching" && (
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            {t("webSearch.searchingHint")}
          </div>
        )}
      </div>

      {friendlyError && (
        <Alert variant="destructive">
          <AlertTitle>{t("webSearch.errorTitle")}</AlertTitle>
          <AlertDescription>{friendlyError}</AlertDescription>
          <AlertAction>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleClearResults}
              disabled={webSearch.clearing}
            >
              {webSearch.clearing ? t("webSearch.clearing") : t("webSearch.clearResults")}
            </Button>
          </AlertAction>
        </Alert>
      )}

      {webSearch.clearError && (
        <Alert variant="destructive">
          <AlertTitle>{t("webSearch.failedTitle")}</AlertTitle>
          <AlertDescription>{webSearch.clearError}</AlertDescription>
        </Alert>
      )}

      {webSearch.phase === "done" && webSearch.candidates.length === 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-medium text-foreground">{t("webSearch.emptyTitle")}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t("webSearch.emptyDescription")}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0"
            onClick={handleClearResults}
            disabled={webSearch.clearing}
          >
            {webSearch.clearing ? t("webSearch.clearing") : t("webSearch.clearResults")}
          </Button>
        </div>
      )}

      {webSearch.phase === "done" && webSearch.candidates.length > 0 && (
        <SearchResults
          webSearch={webSearch}
          expanded={expanded}
          onExpandedChange={setExpanded}
          remainingSourceSlots={remainingSourceSlots}
          importedCount={importedCount}
          failedUrls={failedUrls}
          onClearResults={handleClearResults}
        />
      )}
    </section>
  );
}
