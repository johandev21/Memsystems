import type { ParseKeys } from "i18next";
import {
  Brain,
  HelpCircle,
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
} as const satisfies Record<StudyMaterialKind, ParseKeys<"notebooks">>;

export type ResourceConfig = {
  key: string;
  kind: StudyMaterialKind;
  icon: LucideIcon;
  colorClasses: string;
};

export const RESOURCES: ResourceConfig[] = [
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
    key: "slides",
    kind: "slides",
    icon: Presentation,
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
  ].includes(kind);
}
