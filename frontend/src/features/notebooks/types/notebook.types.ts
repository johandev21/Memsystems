export type { GroundingMode } from "../model/grounding-mode";
export { DEFAULT_GROUNDING_MODE } from "../model/grounding-mode";
import type { GroundingMode } from "../model/grounding-mode";

export interface NotebookBannerVariants {
  w240: string | null;
  w480: string | null;
  w960: string | null;
  w1920: string | null;
}

export interface Notebook {
  id: string;
  title: string;
  description: string;
  icon: string;
  folderId: string | null;
  banner: string | null;
  bannerUrl: string | null;
  bannerVariants: NotebookBannerVariants | null;
  bannerFocalPoint: { x: number; y: number } | null;
  groundingMode?: GroundingMode;
  createdAt: string;
  updatedAt: string;
}

export interface NotebooksResponse {
  notebooks: Notebook[];
  total: number;
}

export interface CreateNotebookDto {
  title?: string;
  icon?: string;
  description?: string;
  folderId?: string | null;
}

export type UpdateNotebookDto = Partial<
  Pick<
    Notebook,
    "title" | "description" | "icon" | "folderId" | "bannerFocalPoint" | "groundingMode"
  >
>;

export interface BannerCrop {
  x: number;
  y: number;
}
