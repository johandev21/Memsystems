import { fetchApi, apiDelete, createQueryOptions } from "@/shared/api";
import type { Notebook, NotebooksResponse } from "../types";
import type { BannerVariantWidth } from "../utils/banner-variants";

export type { Notebook, NotebooksResponse };
export type NotebooksPage = NotebooksResponse;

export const notebookQueryOptions = (id: string) =>
  createQueryOptions<Notebook>(["notebooks", id], `/api/notebooks/${id}`, {
    staleTime: 30_000,
  });

export function deleteNotebook(id: string): Promise<void> {
  return apiDelete(`/api/notebooks/${id}`);
}

export async function createNotebook(
  input: { title?: string; icon?: string; description?: string; folderId?: string | null } = {},
): Promise<Notebook> {
  const res = await fetchApi("/api/notebooks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to create notebook (${res.status})`);
  return res.json();
}

export async function updateNotebook(
  id: string,
  updates: Partial<
    Pick<
      Notebook,
      "title" | "description" | "icon" | "folderId" | "bannerFocalPoint" | "groundingMode"
    >
  >,
): Promise<Notebook> {
  const res = await fetchApi(`/api/notebooks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`Failed to update notebook (${res.status})`);
  return res.json();
}

export async function uploadNotebookBanner(
  id: string,
  file: File,
  focalPoint?: { x: number; y: number },
  variants?: Partial<Record<BannerVariantWidth, File>>,
): Promise<void> {
  const body = new FormData();
  body.append("id", id);
  body.append("file", file);
  if (focalPoint) {
    body.append("focalPointX", focalPoint.x.toString());
    body.append("focalPointY", focalPoint.y.toString());
    body.append("focalPoint", JSON.stringify(focalPoint));
  }
  for (const width of [240, 480, 960, 1920] as const) {
    const variantFile = variants?.[width];
    if (variantFile) body.append(`variant${width}`, variantFile);
  }
  const res = await fetchApi(`/api/notebooks/${id}/banner`, { method: "POST", body });
  if (!res.ok) throw new Error(`Failed to upload banner (${res.status})`);
}

export async function deleteNotebookBanner(id: string): Promise<void> {
  const res = await fetchApi(`/api/notebooks/${id}/banner`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to remove banner (${res.status})`);
}

export async function exportNotebook(id: string, fallbackTitle?: string): Promise<void> {
  const res = await fetchApi(`/api/notebooks/${id}/export`);
  if (!res.ok) throw new Error(`Failed to export notebook (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;

  const contentDisposition = res.headers.get("content-disposition");
  let filename = fallbackTitle
    ? `${fallbackTitle.trim().replace(/[^\p{L}\p{N}_-]+/gu, "-") || "notebook"}.memsys`
    : "notebook.memsys";

  if (contentDisposition) {
    const match = contentDisposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/);
    const extracted = match?.[1] ? decodeURIComponent(match[1]) : match?.[2];
    if (extracted) filename = extracted;
  }

  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importNotebook(file: File, folderId?: string | null): Promise<Notebook> {
  const body = new FormData();
  body.append("file", file);
  if (folderId) {
    body.append("folderId", folderId);
  }
  const res = await fetchApi("/api/notebooks/import", {
    method: "POST",
    body,
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(data.message || `Failed to import notebook (${res.status})`);
  }
  return res.json();
}

