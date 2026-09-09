import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  dismissWebSearchJob,
  importWebSources,
  startWebSearchJob,
  webSearchJobQueryOptions,
  type WebSearchCandidate,
  type WebSearchImportResultItem,
} from "../api/web-search";

export type WebSearchPhase = "idle" | "searching" | "done" | "failed";

export interface WebSearchState {
  query: string;
  phase: WebSearchPhase;
  summary: string | null;
  candidates: WebSearchCandidate[];
  selectedUrls: Set<string>;
  importing: boolean;
  clearing: boolean;
  importResults: Map<string, WebSearchImportResultItem>;
  searchError: string | null;
  clearError: string | null;
}

export function useWebSearch(notebookId: string, selectionLimit = Number.POSITIVE_INFINITY) {
  const queryClient = useQueryClient();
  const jobQuery = useQuery(webSearchJobQueryOptions(notebookId));
  const job = jobQuery.data ?? null;

  const [queryDraft, setQueryDraft] = useState("");
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [importResults, setImportResults] = useState<Map<string, WebSearchImportResultItem>>(
    new Map(),
  );
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [clearError, setClearError] = useState<string | null>(null);
  const initializedSelectionForJob = useRef<string | null>(null);
  const clearInFlight = useRef(false);

  // A new job invalidates previous review-session state.
  const jobId = job?.id ?? null;
  useEffect(() => {
    setSelectedUrls(new Set());
    setImportResults(new Map());
    setLocalError(null);
    setClearError(null);
    initializedSelectionForJob.current = null;
  }, [jobId]);

  const phase: WebSearchPhase = useMemo(() => {
    if (!job) return "idle";
    if (job.status === "pending" || job.status === "processing") return "searching";
    if (job.status === "failed") return "failed";
    return "done";
  }, [job]);

  const candidates = useMemo(() => job?.candidates ?? [], [job]);

  useEffect(() => {
    if (!jobId || candidates.length === 0 || initializedSelectionForJob.current === jobId) return;
    setSelectedUrls(new Set(candidates.slice(0, selectionLimit).map((candidate) => candidate.url)));
    initializedSelectionForJob.current = jobId;
  }, [candidates, jobId, selectionLimit]);

  const searchError =
    job?.status === "failed" ? (job.lastError ?? "Web search failed") : localError;

  const runSearch = useCallback(async () => {
    const query = queryDraft.trim();
    if (!query) return;
    setLocalError(null);
    try {
      const job = await startWebSearchJob(notebookId, { query });
      queryClient.setQueryData(webSearchJobQueryOptions(notebookId).queryKey, job);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Web search failed");
    }
  }, [notebookId, queryClient, queryDraft]);

  const toggleCandidate = useCallback(
    (url: string) => {
      setSelectedUrls((prev) => {
        const next = new Set(prev);
        if (next.has(url)) next.delete(url);
        else if (next.size < selectionLimit) next.add(url);
        return next;
      });
    },
    [selectionLimit],
  );

  const selectAllCandidates = useCallback(() => {
    setSelectedUrls(new Set(candidates.slice(0, selectionLimit).map((candidate) => candidate.url)));
  }, [candidates, selectionLimit]);

  const clearSelection = useCallback(() => setSelectedUrls(new Set()), []);

  const importSelected = useCallback(async () => {
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
        query: job?.query ?? "",
      });
      const nextResults = new Map<string, WebSearchImportResultItem>();
      for (const r of result.results) {
        nextResults.set(r.url, r);
      }
      setImportResults(nextResults);
      setSelectedUrls((previous) => {
        const next = new Set(previous);
        for (const item of result.results) next.delete(item.url);
        return next;
      });
      await queryClient.invalidateQueries({
        queryKey: ["sources", notebookId],
      });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }, [candidates, importing, job?.query, notebookId, queryClient, selectedUrls]);

  const retryFailed = useCallback(async () => {
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
  }, [candidates, importResults, importing, job?.query, notebookId, queryClient]);

  const clearResults = useCallback(async (): Promise<boolean> => {
    if (clearInFlight.current) return false;
    clearInFlight.current = true;
    setClearing(true);
    setClearError(null);
    try {
      await dismissWebSearchJob(notebookId);
      queryClient.setQueryData(webSearchJobQueryOptions(notebookId).queryKey, null);
      setSelectedUrls(new Set());
      setImportResults(new Map());
      setLocalError(null);
      return true;
    } catch {
      setClearError("Couldn't clear these results. Try again.");
      return false;
    } finally {
      clearInFlight.current = false;
      setClearing(false);
    }
  }, [notebookId, queryClient]);

  const state: WebSearchState = {
    query: queryDraft,
    phase,
    summary: job?.summary ?? null,
    candidates,
    selectedUrls,
    importing,
    clearing,
    importResults,
    searchError,
    clearError,
  };

  return {
    ...state,
    setQuery: setQueryDraft,
    runSearch,
    toggleCandidate,
    selectAllCandidates,
    clearSelection,
    importSelected,
    retryFailed,
    clearResults,
  };
}
