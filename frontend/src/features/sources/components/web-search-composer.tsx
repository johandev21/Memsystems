import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, ExternalLink, Loader2, Send, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ModelSelectorLogo, modelsQueryOptions } from "@/features/ai";
import { useModelPersistence } from "@/features/notebooks";
import type { WebSearchImportResultItem } from "../api/web-search";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/shared/utils/cn";
import { useWebSearch } from "../hooks/use-web-search";
import { useWebSearchModel } from "../hooks/use-web-search-model";

function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function WebSearchComposer({ notebookId }: { notebookId: string }) {
  const { data: models } = useQuery(modelsQueryOptions);
  const { model: persistedModel } = useModelPersistence(notebookId);
  const webSearch = useWebSearch(notebookId);
  const [expanded, setExpanded] = useState(false);
  const { capableModels, activeModel, activeProvider, autoSwitched, hasCapableModel, setChosenModel } =
    useWebSearchModel(models, persistedModel);

  const handleSubmit = () => {
    if (activeModel) webSearch.runSearch(activeModel);
  };

  const failedUrls = useMemo(
    () => [...webSearch.importResults.entries()].filter(([, result]) => result.status === "scrape_failed").map(([url]) => url),
    [webSearch.importResults],
  );
  const importedCount = useMemo(
    () => [...webSearch.importResults.values()].filter((result) => result.status === "added").length,
    [webSearch.importResults],
  );
  const selectedCount = webSearch.selectedUrls.size;

  return (
    <div className="flex flex-col gap-2">
      {!hasCapableModel && (
        <Alert>
          <AlertTriangle />
          <AlertTitle className="text-xs">Web search unavailable</AlertTitle>
          <AlertDescription className="text-xs">
            Connect a model that supports web search in Connection settings.
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-2xl border border-border/60 bg-card/70 p-2.5">
        <textarea
          value={webSearch.query}
          onChange={(event) => webSearch.setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && activeModel) {
              event.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Describe the topic, question, or material you need..."
          disabled={!hasCapableModel}
          className="field-sizing-content min-h-10 w-full resize-none rounded-lg bg-muted/60 px-3 py-2 text-sm leading-snug outline-none placeholder:text-muted-foreground/70 focus:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed"
        />

        <div className="mt-2 flex items-center justify-between gap-1">
          {hasCapableModel ? (
            <Select value={activeModel ?? undefined} onValueChange={(value) => value && setChosenModel(value)}>
              <SelectTrigger className="h-7 max-w-40 rounded-lg border-transparent bg-transparent px-2 text-xs text-foreground hover:bg-muted/70">
                <ModelSelectorLogo provider={activeProvider} className="size-3.5" />
                <SelectValue placeholder="Model">
                  {capableModels.find((model) => model.id === activeModel)?.displayName ?? "Select model"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="w-56">
                <SelectGroup>
                  {capableModels.map((model) => (
                    <SelectItem key={model.id} value={model.id} label={model.displayName}>
                      <ModelSelectorLogo provider={model.id.split("/")[0] || "openai"} className="size-3.5" />
                      <span className="truncate text-xs font-medium">{model.displayName}</span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : (
            <span className="px-2 text-xs text-muted-foreground">No compatible model</span>
          )}

          <Button
            size="icon"
            className="size-7 rounded-lg bg-muted text-xs text-foreground hover:bg-muted/80"
            onClick={handleSubmit}
            disabled={!hasCapableModel || !webSearch.query.trim() || webSearch.phase === "searching"}
            aria-label="Run web search"
          >
            {webSearch.phase === "searching" ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          </Button>
        </div>
      </div>

      {autoSwitched && (
        <p className="px-1 text-xs text-muted-foreground">
          Using <span className="font-semibold text-foreground">{capableModels.find((model) => model.id === activeModel)?.displayName}</span> for this search.
        </p>
      )}

      {webSearch.phase === "searching" && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/70 p-2.5 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Searching the web for sources...
        </div>
      )}

      {webSearch.searchError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
          {webSearch.searchError}
        </div>
      )}

      {webSearch.phase === "done" && webSearch.candidates.length === 0 && (
        <div className="rounded-xl border border-border/70 bg-card p-3 text-xs text-muted-foreground">
          No sources found — try rephrasing your query.
        </div>
      )}

      {webSearch.phase === "done" && webSearch.candidates.length > 0 && (
        <div className="rounded-xl border border-border/70 bg-card p-2">
          <div className="flex items-center justify-between px-1 pb-1.5">
            <span className="text-xs font-semibold text-foreground">Sources found</span>
            {webSearch.summary && (
              <button type="button" onClick={() => setExpanded((value) => !value)} className="cursor-pointer text-xs text-primary">
                {expanded ? "Hide" : "View"}
              </button>
            )}
          </div>

          {expanded && webSearch.summary && (
            <div className="mb-1.5 rounded-xl bg-muted/50 px-2 py-1.5 text-xs leading-relaxed text-muted-foreground">
              {webSearch.summary}
            </div>
          )}

          <div className="flex flex-col gap-0.5">
            {webSearch.candidates.map((candidate) => {
              const result = webSearch.importResults.get(candidate.url);
              const settled = result && (result.status === "added" || result.status === "duplicate");
              return (
                <div key={candidate.url} className={cn("group flex items-start gap-1.5 rounded-xl px-1.5 py-1", settled && "opacity-60")}>
                  {settled ? (
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center"><Check className="size-3.5 text-success" /></span>
                  ) : (
                    <Checkbox checked={webSearch.selectedUrls.has(candidate.url)} onCheckedChange={() => webSearch.toggleCandidate(candidate.url)} disabled={!!result} aria-label={candidate.title} className="mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <a href={candidate.url} target="_blank" rel="noopener noreferrer" title={candidate.url} className="flex min-w-0 items-center gap-1 truncate text-xs font-medium text-foreground hover:underline">
                      <span className="truncate">{candidate.title}</span><ExternalLink className="size-3 shrink-0" />
                    </a>
                    <div className="flex items-center gap-1 truncate text-xs text-muted-foreground" title={candidate.url}>{getHostname(candidate.url)}</div>
                    {result && result.status !== "added" && result.status !== "duplicate" && (
                      <div className={cn("mt-0.5 text-xs", result.status === "scrape_failed" ? "text-destructive" : "text-muted-foreground")}>
                        {result.status === "scrape_failed" ? `Failed: ${result.error ?? "could not fetch"}` : result.status === "limit_reached" ? "Skipped: source limit reached" : null}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-1 flex items-center justify-between border-t border-border/50 px-1 pt-1.5">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {webSearch.importResults.size > 0 ? <><Check className="size-3 text-success" />{importedCount} added{failedUrls.length > 0 && ` · ${failedUrls.length} failed`}</> : `${selectedCount} selected`}
            </div>
            <div className="flex items-center gap-1">
              {failedUrls.length > 0 && (
                <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => activeModel && webSearch.retryFailed(activeModel)} disabled={webSearch.importing}>
                  {webSearch.importing ? <Loader2 className="size-3 animate-spin" /> : "Retry failed"}
                </Button>
              )}
              <Button variant="ghost" size="icon" className="size-6 text-muted-foreground" onClick={webSearch.clearResults} aria-label="Clear research results"><X className="size-3.5" /></Button>
              <Button size="sm" className="h-6 text-xs" onClick={() => activeModel && webSearch.importSelected(activeModel)} disabled={selectedCount === 0 || webSearch.importing}>
                {webSearch.importing ? <Loader2 className="size-3 animate-spin" /> : "Import"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export type { WebSearchImportResultItem };
