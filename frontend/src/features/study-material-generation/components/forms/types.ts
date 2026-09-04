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
}

export interface SlidesOptions {
  slideCount: number;
  theme: "dark" | "light" | "accent";
  detailLevel: "basic" | "detailed";
}

export interface BriefFormData {
  brief: string;
  sourceIds: string[];
  folderId: string | null;
  model?: string;
  questionCount?: number;
  difficulty?: "easy" | "medium" | "hard";
  cardStyle?: "qa" | "definition" | "cloze" | "mixed";
  roadmapOptions?: RoadmapOptions;
  mindMapOptions?: MindMapOptions;
  slidesOptions?: SlidesOptions;
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
