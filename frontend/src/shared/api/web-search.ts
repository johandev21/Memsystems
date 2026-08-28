import { queryOptions } from "@tanstack/react-query";
import { apiDelete, apiPost, createQueryOptions } from "./factory";

export interface WebSearchCandidate {
  title: string;
  url: string;
  description: string | null;
}

export type WebSearchJobStatus = "pending" | "processing" | "ready" | "failed";

export interface WebSearchJob {
  id: string;
  notebookId: string;
  userId: string;
  query: string;
  modelId: string;
  status: WebSearchJobStatus;
  summary: string | null;
  candidates: WebSearchCandidate[];
  lastError: string | null;
  createdAt: string;
  completedAt: string | null;
}

export type WebSearchImportResultStatus = "added" | "duplicate" | "limit_reached" | "scrape_failed";

export interface WebSearchImportResultItem {
  url: string;
  title: string;
  status: WebSearchImportResultStatus;
  sourceId?: string;
  error?: string;
}

export interface WebSearchImportResponse {
  results: WebSearchImportResultItem[];
}

export const POLL_INTERVAL_MS = 2500;

export function webSearchJobQueryOptions(notebookId: string) {
  return queryOptions({
    ...createQueryOptions<WebSearchJob | null>(
      ["web-search-job", notebookId],
      `/api/notebooks/${notebookId}/sources/web-search/latest`,
      { staleTime: 0, refetchOnMount: "always" },
    ),
    refetchInterval: (query) => {
      const job = query.state.data;
      return job && (job.status === "pending" || job.status === "processing")
        ? POLL_INTERVAL_MS
        : false;
    },
  });
}

export const startWebSearchJob = (notebookId: string, input: { query: string; modelId: string }) =>
  apiPost<{ query: string; modelId: string }, WebSearchJob>(
    `/api/notebooks/${notebookId}/sources/web-search`,
    input,
  );

export const dismissWebSearchJob = (notebookId: string) =>
  apiDelete(`/api/notebooks/${notebookId}/sources/web-search/latest`);

export const importWebSources = (
  notebookId: string,
  input: {
    candidates: { url: string; title?: string; description?: string | null }[];
    modelId: string;
    query: string;
  },
) =>
  apiPost<
    {
      candidates: { url: string; title?: string; description?: string | null }[];
      modelId: string;
      query: string;
    },
    WebSearchImportResponse
  >(`/api/notebooks/${notebookId}/sources/web-search/import`, input);
