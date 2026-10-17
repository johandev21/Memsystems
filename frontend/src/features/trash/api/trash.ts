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
