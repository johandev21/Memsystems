import { fetchApi } from "@/shared/api";

export type TrashKind =
  | "notebook_folder"
  | "notebook"
  | "source_folder"
  | "source"
  | "study_material_folder"
  | "study_material";

export interface TrashItem {
  id: string;
  name: string;
  kind: TrashKind;
  subtypeLabel?: string;
  notebookId?: string;
  notebookTitle?: string;
  deletedAt: string;
  daysRemaining: number;
}

export interface TrashPageResponse {
  items: TrashItem[];
  nextCursor: string | null;
}

export async function fetchTrashPage(cursor?: string, limit = 30): Promise<TrashPageResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  params.set("limit", limit.toString());

  const res = await fetchApi(`/api/trash?${params.toString()}`);
  if (!res.ok) {
    throw new Error("Failed to load trash ledger");
  }
  return res.json() as Promise<TrashPageResponse>;
}

export async function restoreTrashItem(
  kind: TrashKind,
  id: string,
): Promise<{ success: boolean; id: string; kind: TrashKind }> {
  const res = await fetchApi(`/api/trash/${kind}/${id}/restore`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error("Failed to restore item from trash");
  }
  return res.json() as Promise<{ success: boolean; id: string; kind: TrashKind }>;
}

export async function deleteForeverTrashItem(
  kind: TrashKind,
  id: string,
): Promise<{ success: boolean; id: string; kind: TrashKind }> {
  const res = await fetchApi(`/api/trash/${kind}/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("Failed to permanently delete item");
  }
  return res.json() as Promise<{ success: boolean; id: string; kind: TrashKind }>;
}

export async function emptyTrashApi(): Promise<{ success: boolean; purged: boolean }> {
  const res = await fetchApi("/api/trash", {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("Failed to empty trash");
  }
  return res.json() as Promise<{ success: boolean; purged: boolean }>;
}
