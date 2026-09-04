import { useQuery } from "@tanstack/react-query";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { modelsQueryOptions, type ModelOption } from "@/features/ai";
import { useModelPersistence } from "@/features/notebooks";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/shared/utils/cn";
import type { WebSearchImportResultItem } from "../api/web-search";
import { useWebSearch } from "../hooks/use-web-search";
import { useWebSearchModel } from "../hooks/use-web-search-model";

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function supportsWebSearch(model: ModelOption): boolean {
  return model.supportsWebSearch === true || model.capabilities?.webSearch === true;
}

const TOOL_CAPABILITY_ERROR =
  /tool[_ ]choice.*(?:did not match|unsupported|not supported|not found.*tools?.*parameter)|does not support (?:tools?|function calling)|unsupported(?:\s+\w+)*\s+tool/i;

function friendlySearchError(error: string, modelName?: string): string {
  if (!TOOL_CAPABILITY_ERROR.test(error)) return error;
  const selected = modelName ?? "This model";
  return `${selected} doesn't support web search through the gateway. Choose a compatible model and try again.`;
}

export function WebSearchComposer({
  notebookId,
  remainingSourceSlots,
}: {
  notebookId: string;
  remainingSourceSlots: number;
}) {
  const { data: models } = useQuery(modelsQueryOptions);
  const { model: selectedModel, setModel } = useModelPersistence(notebookId);
  const webSearch = useWebSearch(notebookId, remainingSourceSlots);
  const [expanded, setExpanded] = useState(false);
  const [clearAnnouncement, setClearAnnouncement] = useState("");
  const searchInputRef = useRef<HTMLTextAreaElement>(null);
  const { currentModel, isSupported } = useWebSearchModel(models, selectedModel);
  const compatibleModels = useMemo(() => (models ?? []).filter(supportsWebSearch), [models]);

  useEffect(() => {
    if (clearAnnouncement) searchInputRef.current?.focus();
  }, [clearAnnouncement]);

  const handleSubmit = () => {
    if (isSupported && selectedModel) webSearch.runSearch(selectedModel);
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
      [...webSearch.importResults.entries()]
        .filter(([, result]) => result.status === "scrape_failed")
        .map(([url]) => url),
    [webSearch.importResults],
  );
  const importedCount = useMemo(
    () =>
      [...webSearch.importResults.values()].filter((result) => result.status === "added").length,
    [webSearch.importResults],
  );
  const friendlyError = webSearch.searchError
    ? friendlySearchError(webSearch.searchError, currentModel?.displayName)
    : null;
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
          value={webSearch.query}
          onChange={(event) => webSearch.setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && isSupported) {
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
              !isSupported ||
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

      {!isAtSourceLimit && !isSupported && (
        <ModelCompatibilityNotice
          models={compatibleModels}
          selectedModel={selectedModel}
          onModelChange={setModel}
        />
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
          selectedModel={selectedModel}
          importedCount={importedCount}
          failedUrls={failedUrls}
          onClearResults={handleClearResults}
        />
      )}
    </section>
  );
}

function ModelCompatibilityNotice({
  models,
  selectedModel,
  onModelChange,
}: {
  models: ModelOption[];
  selectedModel?: string | null;
  onModelChange: (modelId: string) => void;
}) {
  return (
    <Alert>
      <AlertTitle>Choose a model that can search the web</AlertTitle>
      <AlertDescription>
        Your current model cannot run web searches. Changing this also updates the model used in
        this notebook's chat.
      </AlertDescription>
      {models.length > 0 ? (
        <Select
          value={models.some((model) => model.id === selectedModel) ? selectedModel : null}
          onValueChange={(value) => value && onModelChange(value)}
        >
          <SelectTrigger className="mt-3 w-full border-border bg-background sm:w-auto">
            <SelectValue placeholder="Choose model" />
          </SelectTrigger>
          <SelectContent align="start">
            {models.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          No web-search model is currently available. Check your AI connection settings.
        </p>
      )}
    </Alert>
  );
}

function SearchResults({
  webSearch,
  expanded,
  onExpandedChange,
  remainingSourceSlots,
  selectedModel,
  importedCount,
  failedUrls,
  onClearResults,
}: {
  webSearch: ReturnType<typeof useWebSearch>;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  remainingSourceSlots: number;
  selectedModel?: string | null;
  importedCount: number;
  failedUrls: string[];
  onClearResults: () => Promise<void>;
}) {
  const selectedCount = webSearch.selectedUrls.size;
  const selectableCount = Math.min(webSearch.candidates.length, remainingSourceSlots);
  const allSelectableSelected = selectableCount > 0 && selectedCount === selectableCount;

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {webSearch.candidates.length} source{webSearch.candidates.length === 1 ? "" : "s"} found
          </p>
          <p className="text-xs text-muted-foreground">
            {remainingSourceSlots < webSearch.candidates.length
              ? `${remainingSourceSlots} source slot${remainingSourceSlots === 1 ? "" : "s"} available`
              : `${selectedCount} selected`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={onClearResults}
            disabled={webSearch.importing || webSearch.clearing}
          >
            {webSearch.clearing ? "Clearing…" : "Clear results"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={() =>
              allSelectableSelected ? webSearch.clearSelection() : webSearch.selectAllCandidates()
            }
            disabled={webSearch.importing || webSearch.clearing || selectableCount === 0}
          >
            {allSelectableSelected ? "Deselect all" : "Select all"}
          </Button>
        </div>
      </div>

      {webSearch.summary && (
        <div className="border-b border-border/60 px-3 py-2.5">
          <p className={cn("text-xs leading-5 text-muted-foreground", !expanded && "line-clamp-2")}>
            {webSearch.summary}
          </p>
          <button
            type="button"
            onClick={() => onExpandedChange(!expanded)}
            className="mt-1 cursor-pointer text-xs font-medium text-primary hover:underline"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        </div>
      )}

      <div className="max-h-72 overflow-y-auto p-1.5">
        {webSearch.candidates.map((candidate) => {
          const result = webSearch.importResults.get(candidate.url);
          const settled = result && (result.status === "added" || result.status === "duplicate");
          const selected = webSearch.selectedUrls.has(candidate.url);
          const selectionDisabled =
            Boolean(result) ||
            webSearch.importing ||
            webSearch.clearing ||
            (!selected && selectedCount >= remainingSourceSlots);

          return (
            <div
              key={candidate.url}
              className={cn(
                "flex items-start gap-2 rounded-xl px-2 py-2.5",
                selected && !settled && "bg-muted/45",
                settled && "opacity-65",
              )}
            >
              {settled ? (
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center" title="Added">
                  <Check className="size-3.5 text-success" />
                </span>
              ) : (
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => webSearch.toggleCandidate(candidate.url)}
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
        })}
      </div>

      <div className="flex flex-col gap-2 border-t border-border/60 bg-muted/15 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite" className="text-xs text-muted-foreground">
          {webSearch.importResults.size > 0
            ? `${importedCount} added${failedUrls.length > 0 ? ` · ${failedUrls.length} failed` : ""}`
            : `${selectedCount} selected`}
        </div>
        <div className="flex items-center justify-end gap-2">
          {failedUrls.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => selectedModel && webSearch.retryFailed(selectedModel)}
              disabled={!selectedModel || webSearch.importing || webSearch.clearing}
            >
              {webSearch.importing ? <Loader2 className="animate-spin" /> : null}
              Retry failed
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={() => selectedModel && webSearch.importSelected(selectedModel)}
            disabled={
              !selectedModel || selectedCount === 0 || webSearch.importing || webSearch.clearing
            }
          >
            {webSearch.importing ? <Loader2 className="animate-spin" /> : null}
            {webSearch.importing ? "Adding" : "Add selected"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export type { WebSearchImportResultItem };
