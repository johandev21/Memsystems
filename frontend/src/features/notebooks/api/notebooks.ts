import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { fetchApi, apiDelete, createQueryOptions } from "@/shared/api";
import type { Notebook, NotebooksResponse } from "../types";

export type { Notebook, NotebooksResponse };
export type NotebooksPage = NotebooksResponse;

async function fetchNotebooks(
  limit?: number,
  offset?: number,
  search?: string,
): Promise<NotebooksResponse> {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (offset) params.set("offset", String(offset));
  if (search) params.set("search", search);
  const url = `/api/notebooks${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await fetchApi(url);
  if (!res.ok) throw new Error(`Failed to fetch notebooks (${res.status})`);
  const data = await res.json();
  return Array.isArray(data) ? { notebooks: data, total: data.length } : data;
}

export const notebooksQueryOptions = queryOptions({
  queryKey: ["notebooks", "home"],
  queryFn: () => fetchNotebooks(6),
  staleTime: 30_000,
  refetchOnMount: "always",
});

export const notebooksInfiniteQueryOptions = infiniteQueryOptions({
  queryKey: ["notebooks", "infinite"],
  queryFn: ({ pageParam = 0 }) => fetchNotebooks(20, pageParam),
  initialPageParam: 0,
  getNextPageParam: (lastPage, allPages) => {
    const loaded = allPages.flatMap((p) => p.notebooks).length;
    return loaded < lastPage.total ? loaded : undefined;
  },
  staleTime: 30_000,
});

export const notebookQueryOptions = (id: string) =>
  createQueryOptions<Notebook>(["notebooks", id], `/api/notebooks/${id}`, {
    staleTime: 30_000,
    refetchOnMount: "always",
  });

export function allNotebooksQueryOptions(page: number, search?: string) {
  const limit = 12;
  const offset = (page - 1) * limit;
  return queryOptions({
    queryKey: ["notebooks", "all", page, search],
    queryFn: () => fetchNotebooks(limit, offset, search),
    staleTime: 30_000,
    refetchOnMount: "always",
  });
}

export function deleteNotebook(id: string): Promise<void> {
  return apiDelete(`/api/notebooks/${id}`);
}
