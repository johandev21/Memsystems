import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  dismissWebSearchJob,
  importWebSources,
  startWebSearchJob,
  webSearchJobQueryOptions,
  type WebSearchCandidate,
  type WebSearchImportResultItem,
} from "@/shared/api";

export type WebSearchPhase = "idle" | "searching" | "done" | "failed";

export interface WebSearchState {
  query: string;
  phase: WebSearchPhase;
  summary: string | null;
  candidates: WebSearchCandidate[];
  selectedUrls: Set<string>;
  importing: boolean;
  importResults: Map<string, WebSearchImportResultItem>;
  searchError: string | null;
}

export function useWebSearch(notebookId: string) {
  const queryClient = useQueryClient();
  const jobQuery = useQuery(webSearchJobQueryOptions(notebookId));
  const job = jobQuery.data ?? null;

  const [queryDraft, setQueryDraft] = useState("");
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [importResults, setImportResults] = useState<Map<string, WebSearchImportResultItem>>(
    new Map(),
  );
  const [importing, setImporting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // A new job invalidates previous review-session state.
  const jobId = job?.id ?? null;
  useEffect(() => {
    setSelectedUrls(new Set());
    setImportResults(new Map());
    setLocalError(null);
  }, [jobId]);

  const phase: WebSearchPhase = useMemo(() => {
    if (!job) return "idle";
    if (job.status === "pending" || job.status === "processing") return "searching";
    if (job.status === "failed") return "failed";
    return "done";
  }, [job]);

  const candidates = useMemo(() => job?.candidates ?? [], [job]);

  const searchError =
    job?.status === "failed" ? (job.lastError ?? "Web search failed") : localError;

  const runSearch = useCallback(
    async (modelId: string) => {
      const query = queryDraft.trim();
      if (!query) return;
      setLocalError(null);
      try {
        const job = await startWebSearchJob(notebookId, { query, modelId });
        queryClient.setQueryData(webSearchJobQueryOptions(notebookId).queryKey, job);
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : "Web search failed");
      }
    },
    [notebookId, queryClient, queryDraft],
  );

  const toggleCandidate = useCallback((url: string) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }, []);

  const importSelected = useCallback(
    async (modelId: string) => {
      const selected = candidates.filter((c) => selectedUrls.has(c.url));
      if (selected.length === 0 || importing) return;

      setImporting(true);
      try {
        const result = await importWebSources(notebookId, {
          candidates: selected.map((c) => ({
            url: c.url,
            title: c.title,
            description: c.description,
          })),
          modelId,
          query: job?.query ?? "",
        });
        const nextResults = new Map<string, WebSearchImportResultItem>();
        for (const r of result.results) {
          nextResults.set(r.url, r);
        }
        setImportResults(nextResults);
        await queryClient.invalidateQueries({
          queryKey: ["sources", notebookId],
        });
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : "Import failed");
      } finally {
        setImporting(false);
      }
    },
    [candidates, importing, job?.query, notebookId, queryClient, selectedUrls],
  );

  const retryFailed = useCallback(
    async (modelId: string) => {
      const failed = candidates.filter((c) => {
        const r = importResults.get(c.url);
        return r?.status === "scrape_failed";
      });
      if (failed.length === 0 || importing) return;

      setImporting(true);
      try {
        const result = await importWebSources(notebookId, {
          candidates: failed.map((c) => ({
            url: c.url,
            title: c.title,
            description: c.description,
          })),
          modelId,
          query: job?.query ?? "",
        });
        setImportResults((prev) => {
          const next = new Map(prev);
          for (const r of result.results) {
            next.set(r.url, r);
          }
          return next;
        });
        await queryClient.invalidateQueries({
          queryKey: ["sources", notebookId],
        });
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : "Retry failed");
      } finally {
        setImporting(false);
      }
    },
    [candidates, importResults, importing, job?.query, notebookId, queryClient],
  );

  const clearResults = useCallback(async () => {
    try {
      await dismissWebSearchJob(notebookId);
    } catch {
      // Local reset even if dismissal fails server-side.
    }
    queryClient.setQueryData(webSearchJobQueryOptions(notebookId).queryKey, null);
    setSelectedUrls(new Set());
    setImportResults(new Map());
    setLocalError(null);
  }, [notebookId, queryClient]);

  const state: WebSearchState = {
    query: queryDraft,
    phase,
    summary: job?.summary ?? null,
    candidates,
    selectedUrls,
    importing,
    importResults,
    searchError,
  };

  return {
    ...state,
    setQuery: setQueryDraft,
    runSearch,
    toggleCandidate,
    importSelected,
    retryFailed,
    clearResults,
  };
}
