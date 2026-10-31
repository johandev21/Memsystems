import type { StudyMaterialKind } from "@/features/study-material-viewer";

export interface RoadmapOptions {
  phaseCount: number;
  detailLevel: "basic" | "detailed";
}

export interface MindMapOptions {
  nodeCount: number;
  structure: "radial" | "hierarchical" | "organic";
  colorGroups: boolean;
  crossLinks: boolean;
  detailLevel: "basic" | "detailed";
}

export interface SlidesOptions {
  slideCount: number;
  theme: "dark" | "light" | "accent" | "editorial" | "academic" | "technical" | "warm" | "auto";
  detailLevel: "basic" | "detailed";
}

export interface BriefFormData {
  brief: string;
  sourceIds: string[];
  folderId: string | null;
  model?: string;
  questionCount?: number;
  difficulty?: "easy" | "medium" | "hard";
  roadmapOptions?: RoadmapOptions;
  mindMapOptions?: MindMapOptions;
  slidesOptions?: SlidesOptions;
  format?: "briefing" | "deep_dive";
  length?: "short" | "standard" | "extended";
  audience?: "new_to_topic" | "some_background" | "advanced";
}

export interface BaseMaterialFormProps {
  notebookId: string;
  kind: StudyMaterialKind;
  value: BriefFormData;
  onChange: (next: Partial<BriefFormData>) => void;
  onSubmit: () => void;
  submitLabel?: string;
  disabled?: boolean;
}
