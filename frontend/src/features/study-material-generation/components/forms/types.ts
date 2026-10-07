import type {
  StudyGuideGenerationOptions,
  CaseStudyGenerationOptions,
} from "@/features/study-material-viewer";
import type { StudyMaterialKind } from "@/features/study-material-viewer";

/**
 * Explicit-selection contract shared by every generation form: numeric counts
 * are always explicit (`>= 1`) and enum options carry no `"auto"` member in
 * the UI. The backend still accepts legacy `"auto"`/`0` values.
 */
export interface RoadmapOptions {
  /** Explicit phase count. */
  phaseCount: number;
  detailLevel: "basic" | "detailed";
}

export interface MindMapOptions {
  /** Explicit node count. */
  nodeCount: number;
  structure: "radial" | "hierarchical" | "organic";
  colorGroups: boolean;
  crossLinks: boolean;
  detailLevel: "basic" | "detailed";
}

export interface SlidesOptions {
  /** Explicit slide count. */
  slideCount: number;
  theme: "dark" | "light" | "accent" | "editorial" | "academic" | "technical" | "warm";
  detailLevel: "basic" | "detailed";
}

export interface PracticeProblemsOptions {
  /** Explicit problem count. */
  problemCount: number;
  difficulty: "easy" | "medium" | "hard";
}

export interface BriefFormData {
  brief: string;
  sourceIds: string[];
  folderId: string | null;
  model?: string;
  /** Explicit question count. */
  questionCount?: number;
  difficulty?: "easy" | "medium" | "hard";
  roadmapOptions?: RoadmapOptions;
  mindMapOptions?: MindMapOptions;
  studyGuideOptions?: StudyGuideGenerationOptions;
  practiceProblemsOptions?: PracticeProblemsOptions;
  caseStudyOptions?: CaseStudyGenerationOptions;
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
