import type { ParseKeys } from "i18next";
import {
  BookOpen,
  Brain,
  Briefcase,
  HelpCircle,
  ListChecks,
  type LucideIcon,
  Map as MapIcon,
  Network,
  Presentation,
} from "lucide-react";
import type { StudyMaterialKind } from "@/features/study-material-viewer";

export const KIND_LABEL_KEYS = {
  quiz: "studio.resources.quiz",
  simple_flashcard: "studio.resources.flashcards",
  roadmap: "studio.resources.roadmap",
  mind_map: "studio.resources.mindMap",
  slides: "studio.resources.slides",
  study_guide: "studio.resources.studyGuide",
  practice_problems: "studio.resources.practiceProblems",
  case_study: "studio.resources.caseStudy",
} as const satisfies Record<StudyMaterialKind, ParseKeys<"notebooks">>;

export type ResourceConfig = {
  key: string;
  kind: StudyMaterialKind;
  icon: LucideIcon;
  colorClasses: string;
};

export const RESOURCES: ResourceConfig[] = [
  {
    key: "studyGuide",
    kind: "study_guide",
    icon: BookOpen,
    colorClasses: "bg-studio-resource hover:bg-studio-resource-hover",
  },
  {
    key: "quiz",
    kind: "quiz",
    icon: HelpCircle,
    colorClasses: "bg-studio-resource hover:bg-studio-resource-hover",
  },
  {
    key: "flashcards",
    kind: "simple_flashcard",
    icon: Brain,
    colorClasses: "bg-studio-resource hover:bg-studio-resource-hover",
  },
  {
    key: "roadmap",
    kind: "roadmap",
    icon: MapIcon,
    colorClasses: "bg-studio-resource hover:bg-studio-resource-hover",
  },
  {
    key: "mindMap",
    kind: "mind_map",
    icon: Network,
    colorClasses: "bg-studio-resource hover:bg-studio-resource-hover",
  },
  {
    key: "practiceProblems",
    kind: "practice_problems",
    icon: ListChecks,
    colorClasses: "bg-studio-resource hover:bg-studio-resource-hover",
  },
  {
    key: "slides",
    kind: "slides",
    icon: Presentation,
    colorClasses: "bg-studio-resource hover:bg-studio-resource-hover",
  },
  {
    key: "caseStudy",
    kind: "case_study",
    icon: Briefcase,
    colorClasses: "bg-studio-resource hover:bg-studio-resource-hover",
  },
];

export function isInScope(kind: StudyMaterialKind): boolean {
  return [
    "quiz",
    "simple_flashcard",
    "roadmap",
    "mind_map",
    "slides",
    "study_guide",
    "practice_problems",
    "case_study",
  ].includes(kind);
}
