import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, ExternalLink, Loader2, Send, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ModelSelectorLogo } from "@/features/ai";
import { useModelPersistence } from "@/features/notebooks";
import { modelsQueryOptions } from "@/shared/api/models";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { cn } from "@/shared/lib/utils";
import { useWebSearch } from "../model/use-web-search";
import type { WebSearchImportResultItem } from "@/shared/api/web-search";

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
  const [chosenModel, setChosenModel] = useState<string | null>(null);

  const capableModels = useMemo(() => (models ?? []).filter((m) => m.supportsWebSearch), [models]);

  const defaultModel = useMemo(() => {
    if (capableModels.some((m) => m.id === persistedModel)) {
      return persistedModel as string;
    }
    return capableModels[0]?.id ?? null;
  }, [capableModels, persistedModel]);

  const activeModel = chosenModel ?? defaultModel;
  const activeProvider = activeModel?.split("/")[0] || "openai";

  const autoSwitched = persistedModel && defaultModel && persistedModel !== defaultModel;

  const hasCapableModel = capableModels.length > 0;

  const handleSubmit = () => {
    if (!activeModel) return;
    webSearch.runSearch(activeModel);
  };

  const importResults = webSearch.importResults;
  const hasImport = importResults.size > 0;
  const failedUrls = useMemo(() => {
    const failed: string[] = [];
    for (const [url, r] of importResults) {
      if (r.status === "scrape_failed") failed.push(url);
    }
    return failed;
  }, [importResults]);

  const importedCount = useMemo(
    () => [...importResults.values()].filter((r) => r.status === "added").length,
    [importResults],
  );

  const selectedCount = webSearch.selectedUrls.size;

  return (
    <div className="flex flex-col gap-2">
      {/* Capability warning */}
      {!hasCapableModel && (
        <div className="flex items-start gap-2.5 rounded-xl border border-border/80 p-3 leading-relaxed text-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span className="text-xs">
            Web search isn&apos;t supported by your current models. Connect a model that supports it
            (e.g. GPT-5 or GPT-5 Mini) in Connection settings.
          </span>
        </div>
      )}

      {/* Research composer */}
      <div className="space-y-2 rounded-xl border border-border/60 bg-card/70 p-2.5">
        <textarea
          value={webSearch.query}
          onChange={(e) => webSearch.setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && activeModel) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Search sources about any topic..."
          disabled={!hasCapableModel}
          className="field-sizing-content min-h-10 w-full resize-none rounded-lg bg-muted/60 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/70 focus:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-100"
        />

        <div className="flex items-center justify-between gap-1">
          <div className="flex min-w-0 items-center gap-1">
            {hasCapableModel && (
              <Select
                value={activeModel ?? undefined}
                onValueChange={(val) => {
                  if (val) setChosenModel(val);
                }}
              >
                <SelectTrigger className="h-7 max-w-40 rounded-lg border-transparent bg-transparent px-2 text-xs text-foreground hover:bg-muted/70 focus-visible:border-ring focus-visible:bg-muted/70">
                  <ModelSelectorLogo provider={activeProvider} className="size-3.5" />
                  <SelectValue placeholder="Model">
                    {capableModels.find((m) => m.id === activeModel)?.displayName ?? "Select model"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="w-56 rounded-xl border border-border/70 bg-popover p-1.5 shadow-lg duration-0 data-open:animate-none data-closed:animate-none">
                  {capableModels.map((model) => (
                    <SelectItem
                      key={model.id}
                      value={model.id}
                      label={model.displayName}
                      className="cursor-pointer rounded-lg px-2 py-2 text-xs text-foreground"
                    >
                      <ModelSelectorLogo
                        provider={model.id.split("/")[0] || "openai"}
                        className="size-3.5"
                      />
                      <span className="truncate font-medium">{model.displayName}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Button
            size="icon"
            className="size-7 shrink-0 cursor-pointer rounded-lg bg-muted text-foreground hover:bg-muted/80"
            onClick={handleSubmit}
            disabled={!hasCapableModel || webSearch.phase === "searching"}
            aria-label="Run web search"
          >
            {webSearch.phase === "searching" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
          </Button>
        </div>
      </div>

      {autoSwitched && (
        <p className="px-1 text-xs text-muted-foreground">
          Your selected model doesn&apos;t support web search — using{" "}
          <span className="font-semibold text-foreground">
            {capableModels.find((m) => m.id === activeModel)?.displayName}
          </span>{" "}
          for this search.
        </p>
      )}

      {/* Searching state */}
      {webSearch.phase === "searching" && (
        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/70 p-2.5 text-xs text-muted-foreground">
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
          Searching the web for sources...
        </div>
      )}

      {/* Search error */}
      {webSearch.searchError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
          {webSearch.searchError}
        </div>
      )}

      {/* Staged results card */}
      {webSearch.phase === "done" && webSearch.candidates.length === 0 && (
        <div className="rounded-2xl border border-border/70 bg-card p-3 text-xs text-muted-foreground">
          No sources found — try rephrasing your query.
        </div>
      )}

      {webSearch.phase === "done" && webSearch.candidates.length > 0 && (
        <div className="rounded-2xl border border-border/70 bg-card p-2">
          <div className="flex items-center justify-between px-1 pb-1.5">
            <span className="text-xs font-semibold text-foreground">Sources found</span>
            {webSearch.summary && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-xs text-primary cursor-pointer"
              >
                {expanded ? "Hide" : "View"}
              </button>
            )}
          </div>

          {expanded && webSearch.summary && (
            <div className="mb-1.5 rounded-xl bg-muted/50 px-2 py-1.5 text-xs leading-relaxed text-muted-foreground">
              {webSearch.summary}
            </div>
          )}

          <div className="space-y-0.5">
            {webSearch.candidates.map((c) => {
              const result = importResults.get(c.url);
              const settled =
                result && (result.status === "added" || result.status === "duplicate");
              return (
                <div
                  key={c.url}
                  className={cn(
                    "group flex items-start gap-1.5 rounded-xl px-1.5 py-1 hover:bg-muted/50",
                    settled && "opacity-60",
                  )}
                >
                  {settled ? (
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                      <Check className="size-3.5 text-success" />
                    </span>
                  ) : (
                    <Checkbox
                      checked={webSearch.selectedUrls.has(c.url)}
                      onCheckedChange={() => webSearch.toggleCandidate(c.url)}
                      disabled={!!result}
                      aria-label={c.title}
                      className="mt-0.5"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <label className="flex cursor-pointer items-start gap-1.5">
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={c.url}
                        className="min-w-0 truncate text-xs font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 rounded-sm"
                      >
                        {c.title}
                      </a>
                    </label>
                    <div
                      className="flex items-center gap-1 text-xs text-muted-foreground"
                      title={c.url}
                    >
                      <span className="truncate">{getHostname(c.url)}</span>
                      <ExternalLink className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" />
                    </div>
                    {result && result.status !== "added" && result.status !== "duplicate" && (
                      <div
                        className={cn(
                          "mt-0.5 flex items-center gap-1 text-xs",
                          result.status === "scrape_failed"
                            ? "text-destructive"
                            : "text-muted-foreground",
                        )}
                      >
                        {result.status === "scrape_failed"
                          ? `Failed: ${result.error ?? "could not fetch"}`
                          : result.status === "limit_reached"
                            ? "Skipped: source limit reached"
                            : null}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action row */}
          <div className="mt-1 flex items-center justify-between border-t border-border/50 px-1 pt-1.5">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {hasImport ? (
                <span className="flex items-center gap-1">
                  <Check className="size-3 text-success" />
                  {importedCount} added
                  {failedUrls.length > 0 && ` · ${failedUrls.length} failed`}
                </span>
              ) : (
                <span>{selectedCount} selected</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {hasImport && failedUrls.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 cursor-pointer text-xs"
                  onClick={() => activeModel && webSearch.retryFailed(activeModel)}
                  disabled={webSearch.importing}
                >
                  {webSearch.importing ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    "Retry failed"
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground cursor-pointer"
                onClick={webSearch.clearResults}
                aria-label="Clear research results"
              >
                <X className="size-3.5" />
              </Button>
              <Button
                size="sm"
                className="h-6 cursor-pointer text-xs"
                onClick={() => activeModel && webSearch.importSelected(activeModel)}
                disabled={selectedCount === 0 || webSearch.importing}
              >
                {webSearch.importing ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  "Import"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export type { WebSearchImportResultItem };
