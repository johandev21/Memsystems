export type { GroundingMode } from "../model/grounding-mode";
export { DEFAULT_GROUNDING_MODE } from "../model/grounding-mode";
import type { GroundingMode } from "../model/grounding-mode";
import type { AgentAccessLevel } from "@/shared/types/agent-access";

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
  /** Resolved agent access: the override, or the workspace default. */
  agentAccess?: AgentAccessLevel;
  /** Null when the notebook inherits the workspace default. */
  agentAccessOverride?: AgentAccessLevel | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotebooksResponse {
  notebooks: Notebook[];
  total: number;
}
