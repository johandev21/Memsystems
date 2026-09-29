import type {
  StudyGuideGenerationOptions,
  CaseStudyGenerationOptions,
} from "@/features/study-material-viewer";
import type { StudyMaterialKind } from "@/features/study-material-viewer";

/**
 * Auto contract shared by every generation form: numeric counts use `0` to
 * mean "Auto" (the model chooses from the sources and the brief), and enum
 * options carry the literal `"auto"` member.
 */
export interface RoadmapOptions {
  /** 0 = auto. */
  phaseCount: number;
  detailLevel: "basic" | "detailed" | "auto";
}

export interface MindMapOptions {
  /** 0 = auto. */
  nodeCount: number;
  structure: "radial" | "hierarchical" | "organic";
  colorGroups: boolean | "auto";
  crossLinks: boolean;
  detailLevel: "basic" | "detailed" | "auto";
}

export interface SlidesOptions {
  /** 0 = auto. */
  slideCount: number;
  theme: "dark" | "light" | "accent" | "editorial" | "academic" | "technical" | "warm" | "auto";
  detailLevel: "basic" | "detailed" | "auto";
}

export interface PracticeProblemsOptions {
  /** 0 = auto. */
  problemCount: number;
  difficulty: "easy" | "medium" | "hard" | "auto";
}

export interface BriefFormData {
  brief: string;
  sourceIds: string[];
  folderId: string | null;
  model?: string;
  /** 0 = auto. */
  questionCount?: number;
  difficulty?: "easy" | "medium" | "hard" | "auto";
  cardStyle?: "qa" | "definition" | "cloze" | "mixed" | "auto";
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
