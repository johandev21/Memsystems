import { fetchApi, apiDelete, apiPost, createQueryOptions } from "@/shared/api";
import type { SourceKind, Source, SourceWithContent } from "../types";

export type { SourceKind, Source, SourceWithContent };
export const SOURCE_LIMIT = 300;

export const sourcesQueryOptions = (notebookId: string) =>
  createQueryOptions<Source[]>(["sources", notebookId], `/api/notebooks/${notebookId}/sources`);

export const sourceQueryOptions = (sourceId: string) =>
  createQueryOptions<SourceWithContent>(["source", sourceId], `/api/sources/${sourceId}`);

export const deleteSource = (sourceId: string) => apiDelete(`/api/sources/${sourceId}`);

export const createTextSource = (notebookId: string, input: { title: string; rawText: string }) =>
  apiPost<{ title: string; rawText: string }, Source>(
    `/api/notebooks/${notebookId}/sources/text`,
    input,
  );

export const createUrlSource = (notebookId: string, input: { url: string; title?: string }) =>
  apiPost<{ url: string; title?: string }, Source>(
    `/api/notebooks/${notebookId}/sources/url`,
    input,
  );

export async function createFileSource(
  notebookId: string,
  file: File,
  title?: string,
): Promise<Source> {
  const formData = new FormData();
  formData.append("file", file);
  if (title) formData.append("title", title);
  const res = await fetchApi(`/api/notebooks/${notebookId}/sources/file`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Failed to add source (${res.status})`);
  return data as Source;
}

export const reindexAllSources = (notebookId: string) =>
  fetchApi(`/api/notebooks/${notebookId}/sources/reindex-all`, { method: "POST" });

export const reindexSource = (sourceId: string) =>
  fetchApi(`/api/sources/${sourceId}/reindex`, { method: "POST" });
