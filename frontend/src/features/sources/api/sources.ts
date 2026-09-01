import { fetchApi, apiDelete, createQueryOptions } from "@/shared/api";
import type { SourceKind, Source, SourceWithContent } from "../types";

export type { SourceKind, Source, SourceWithContent };
export const SOURCE_LIMIT = 300;

export const sourcesQueryOptions = (notebookId: string) =>
  createQueryOptions<Source[]>(["sources", notebookId], `/api/notebooks/${notebookId}/sources`);

export const sourceQueryOptions = (sourceId: string) =>
  createQueryOptions<SourceWithContent>(["source", sourceId], `/api/sources/${sourceId}`);

export const deleteSource = (sourceId: string) => apiDelete(`/api/sources/${sourceId}`);

export const createTextSource = (
  notebookId: string,
  input: { title: string; rawText: string },
  signal?: AbortSignal,
) => postSource(`/api/notebooks/${notebookId}/sources/text`, input, signal);

export const createUrlSource = (
  notebookId: string,
  input: {
    url: string;
    title?: string;
    captionText?: string;
    captionFormat?: string;
    oauthToken?: string;
  },
  signal?: AbortSignal,
) => postSource(`/api/notebooks/${notebookId}/sources/url`, input, signal);

async function postSource<TInput>(
  url: string,
  input: TInput,
  signal?: AbortSignal,
): Promise<Source> {
  const response = await fetchApi(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? `Failed to add source (${response.status})`);
  return data as Source;
}

export async function createFileSource(
  notebookId: string,
  file: File,
  title?: string,
  signal?: AbortSignal,
): Promise<Source> {
  const digest = await sha256File(file);
  const targetResponse = await fetchApi(`/api/notebooks/${notebookId}/source-uploads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
      sha256: digest,
    }),
    signal,
  });
  const targetData = (await targetResponse.json().catch(() => ({}))) as {
    uploadId?: string;
    uploadUrl?: string;
    headers?: Record<string, string>;
    error?: string;
  };
  if (!targetResponse.ok || !targetData.uploadId || !targetData.uploadUrl) {
    throw new Error(targetData.error ?? `Failed to prepare upload (${targetResponse.status})`);
  }

  const uploadResponse = await fetchApi(targetData.uploadUrl, {
    method: "PUT",
    headers: targetData.headers,
    body: file,
    // Local streaming targets require the app session; presigned S3 URLs do
    // not and should not receive browser credentials cross-origin.
    credentials: targetData.uploadUrl.startsWith("/") ? "include" : "omit",
    signal,
  });
  if (!uploadResponse.ok) {
    const data = await uploadResponse.json().catch(() => ({}));
    throw new Error(data.error ?? `Failed to upload file (${uploadResponse.status})`);
  }

  const finalizeResponse = await fetchApi(
    `/api/notebooks/${notebookId}/source-uploads/${encodeURIComponent(targetData.uploadId)}/finalize`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
      signal,
    },
  );
  const data = await finalizeResponse.json().catch(() => ({}));
  if (!finalizeResponse.ok) {
    throw new Error(data.error ?? `Failed to finalize upload (${finalizeResponse.status})`);
  }
  return data as Source;
}

async function sha256File(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Re-enqueue source processing after a failed or cancelled attempt. */
export async function retrySource(sourceId: string): Promise<unknown> {
  const response = await fetchApi(`/api/sources/${sourceId}/retry`, { method: "POST" });
  if (response.status === 404) {
    // Older backends expose reindex as the equivalent operator action.
    const legacyResponse = await fetchApi(`/api/sources/${sourceId}/reindex`, { method: "POST" });
    const legacyData = await legacyResponse.json().catch(() => ({}));
    if (!legacyResponse.ok) {
      throw new Error(legacyData.error ?? `Failed to retry source (${legacyResponse.status})`);
    }
    return legacyData;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error ?? `Failed to retry source (${response.status})`);
  }
  return data;
}

/** Request cancellation of an active source-processing job. */
export async function cancelSource(sourceId: string): Promise<void> {
  const response = await fetchApi(`/api/sources/${sourceId}/cancel`, { method: "POST" });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? `Failed to cancel source (${response.status})`);
  }
}

export const reindexAllSources = (notebookId: string) =>
  fetchApi(`/api/notebooks/${notebookId}/sources/reindex-all`, { method: "POST" });

export const reindexSource = (sourceId: string) =>
  fetchApi(`/api/sources/${sourceId}/reindex`, { method: "POST" });
