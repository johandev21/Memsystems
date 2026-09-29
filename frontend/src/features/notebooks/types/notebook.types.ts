export type { GroundingMode } from "../model/grounding-mode";
export { DEFAULT_GROUNDING_MODE } from "../model/grounding-mode";
import type { GroundingMode } from "../model/grounding-mode";

export interface NotebookBannerVariants {
  w240: string | null;
  w480: string | null;
  w960: string | null;
  w1920: string | null;
}

export type GroundingMode = 'strict' | 'moderate' | 'free';

export const DEFAULT_GROUNDING_MODE: GroundingMode = 'strict';

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
