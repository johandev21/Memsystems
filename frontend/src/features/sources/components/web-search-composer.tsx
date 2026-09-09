import { Check, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/shared/utils/cn";
import type { WebSearchCandidate, WebSearchImportResultItem } from "../api/web-search";
import { useWebSearch } from "../hooks/use-web-search";

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function WebSearchComposer({
  notebookId,
  remainingSourceSlots,
}: {
  notebookId: string;
  remainingSourceSlots: number;
}) {
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
    setClearAnnouncement("Search results cleared");
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
          Find sources on the web
        </h3>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          Describe what you want to research. You can review every result before adding it.
        </p>
      </div>

      <div className="rounded-2xl border border-composer-border bg-composer-bg p-2 shadow-[var(--composer-glow),inset_0_1px_0_var(--composer-highlight)] transition-[border-color,box-shadow] focus-within:border-ring/60 focus-within:ring-2 focus-within:ring-ring/15">
        <textarea
          ref={searchInputRef}
          aria-label="What would you like to research?"
          value={webSearch.query}
          onChange={(event) => webSearch.setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="What would you like to research?"
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
                Searching
              </>
            ) : (
              "Search"
            )}
          </Button>
        </div>
      </div>

      {isAtSourceLimit && (
        <Alert>
          <AlertTitle>Source limit reached</AlertTitle>
          <AlertDescription>
            Remove a source before searching for more sources to add.
          </AlertDescription>
        </Alert>
      )}

      <div aria-live="polite" aria-atomic="true">
        {webSearch.phase === "searching" && (
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Searching for reliable sources. You can close this dialog and return later.
          </div>
        )}
      </div>

      {friendlyError && (
        <Alert variant="destructive">
          <AlertTitle>Web search failed</AlertTitle>
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
              {webSearch.clearing ? "Clearing…" : "Clear results"}
            </Button>
          </AlertAction>
        </Alert>
      )}

      {webSearch.clearError && (
        <Alert variant="destructive">
          <AlertTitle>Results weren't cleared</AlertTitle>
          <AlertDescription>{webSearch.clearError}</AlertDescription>
        </Alert>
      )}

      {webSearch.phase === "done" && webSearch.candidates.length === 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-medium text-foreground">No useful sources found</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Try a more specific topic, add a date, or name the kind of source you need.
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
            {webSearch.clearing ? "Clearing…" : "Clear results"}
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

function SearchResultsHeader({
  candidatesCount,
  remainingSourceSlots,
  selectedCount,
  allSelectableSelected,
  selectableCount,
  importing,
  clearing,
  onClearResults,
  onToggleSelectAll,
}: {
  candidatesCount: number;
  remainingSourceSlots: number;
  selectedCount: number;
  allSelectableSelected: boolean;
  selectableCount: number;
  importing: boolean;
  clearing: boolean;
  onClearResults: () => Promise<void>;
  onToggleSelectAll: () => void;
}) {
  const subtitle =
    remainingSourceSlots < candidatesCount
      ? `${remainingSourceSlots} source slot${remainingSourceSlots === 1 ? "" : "s"} available`
      : `${selectedCount} selected`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
      <div>
        <p className="text-sm font-semibold text-foreground">
          {candidatesCount} source{candidatesCount === 1 ? "" : "s"} found
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
          {clearing ? "Clearing…" : "Clear results"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7"
          onClick={onToggleSelectAll}
          disabled={importing || clearing || selectableCount === 0}
        >
          {allSelectableSelected ? "Deselect all" : "Select all"}
        </Button>
      </div>
    </div>
  );
}

function SearchResultsSummary({
  summary,
  expanded,
  onExpandedChange,
}: {
  summary: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}) {
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
        {expanded ? "Show less" : "Show more"}
      </button>
    </div>
  );
}

function SearchResultsCandidateList({
  candidates,
  importResults,
  selectedUrls,
  importing,
  clearing,
  remainingSourceSlots,
  onToggleCandidate,
}: {
  candidates: WebSearchCandidate[];
  importResults: Map<string, WebSearchImportResultItem>;
  selectedUrls: Set<string>;
  importing: boolean;
  clearing: boolean;
  remainingSourceSlots: number;
  onToggleCandidate: (url: string) => void;
}) {
  const selectedCount = selectedUrls.size;

  return (
    <div className="max-h-72 overflow-y-auto p-1.5">
      {candidates.map((candidate) => {
        const result = importResults.get(candidate.url);
        const selected = selectedUrls.has(candidate.url);
        const selectionDisabled =
          Boolean(result) ||
          importing ||
          clearing ||
          (!selected && selectedCount >= remainingSourceSlots);

        return (
          <SearchCandidateRow
            key={candidate.url}
            candidate={candidate}
            result={result}
            selected={selected}
            selectionDisabled={selectionDisabled}
            onToggleCandidate={onToggleCandidate}
          />
        );
      })}
    </div>
  );
}

function SearchResultsFooter({
  hasImportResults,
  selectedCount,
  importedCount,
  failedUrls,
  importing,
  clearing,
  onRetryFailed,
  onImportSelected,
}: {
  hasImportResults: boolean;
  selectedCount: number;
  importedCount: number;
  failedUrls: string[];
  importing: boolean;
  clearing: boolean;
  onRetryFailed: () => void;
  onImportSelected: () => void;
}) {
  const statusText = hasImportResults
    ? `${importedCount} added${failedUrls.length > 0 ? ` · ${failedUrls.length} failed` : ""}`
    : `${selectedCount} selected`;

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
            Retry failed
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          onClick={onImportSelected}
          disabled={selectedCount === 0 || importing || clearing}
        >
          {importing ? <Loader2 className="animate-spin" /> : null}
          {importing ? "Adding" : "Add selected"}
        </Button>
      </div>
    </div>
  );
}

function SearchResults({
  webSearch,
  expanded,
  onExpandedChange,
  remainingSourceSlots,
  importedCount,
  failedUrls,
  onClearResults,
}: {
  webSearch: ReturnType<typeof useWebSearch>;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  remainingSourceSlots: number;
  importedCount: number;
  failedUrls: string[];
  onClearResults: () => Promise<void>;
}) {
  const selectedCount = webSearch.selectedUrls.size;
  const selectableCount = Math.min(webSearch.candidates.length, remainingSourceSlots);
  const allSelectableSelected = selectableCount > 0 && selectedCount === selectableCount;

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <SearchResultsHeader
        candidatesCount={webSearch.candidates.length}
        remainingSourceSlots={remainingSourceSlots}
        selectedCount={selectedCount}
        allSelectableSelected={allSelectableSelected}
        selectableCount={selectableCount}
        importing={webSearch.importing}
        clearing={webSearch.clearing}
        onClearResults={onClearResults}
        onToggleSelectAll={() =>
          allSelectableSelected ? webSearch.clearSelection() : webSearch.selectAllCandidates()
        }
      />

      {webSearch.summary && (
        <SearchResultsSummary
          summary={webSearch.summary}
          expanded={expanded}
          onExpandedChange={onExpandedChange}
        />
      )}

      <SearchResultsCandidateList
        candidates={webSearch.candidates}
        importResults={webSearch.importResults}
        selectedUrls={webSearch.selectedUrls}
        importing={webSearch.importing}
        clearing={webSearch.clearing}
        remainingSourceSlots={remainingSourceSlots}
        onToggleCandidate={webSearch.toggleCandidate}
      />

      <SearchResultsFooter
        hasImportResults={webSearch.importResults.size > 0}
        selectedCount={selectedCount}
        importedCount={importedCount}
        failedUrls={failedUrls}
        importing={webSearch.importing}
        clearing={webSearch.clearing}
        onRetryFailed={webSearch.retryFailed}
        onImportSelected={webSearch.importSelected}
      />
    </div>
  );
}

interface SearchCandidateRowProps {
  candidate: WebSearchCandidate;
  result?: WebSearchImportResultItem;
  selected: boolean;
  selectionDisabled: boolean;
  onToggleCandidate: (url: string) => void;
}

function SearchCandidateRow({
  candidate,
  result,
  selected,
  selectionDisabled,
  onToggleCandidate,
}: SearchCandidateRowProps) {
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
          title="Added"
        >
          <Check className="size-3.5 text-success" />
        </span>
      ) : (
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleCandidate(candidate.url)}
          disabled={selectionDisabled}
          aria-label={`Select ${candidate.title}`}
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
          <span className="sr-only">Opens in a new tab</span>
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
              ? `Could not add: ${result.error ?? "source could not be fetched"}`
              : "Not added because the source limit was reached"}
          </p>
        )}
      </div>
    </div>
  );
}

export type { WebSearchImportResultItem };
