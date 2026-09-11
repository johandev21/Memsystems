import type { StudyMaterialKind } from "@/features/study-material-viewer";

export const KIND_LABEL_KEYS = {
  quiz: "kinds.quiz",
  simple_flashcard: "kinds.simple_flashcard",
  roadmap: "kinds.roadmap",
  mind_map: "kinds.mind_map",
  slides: "kinds.slides",
  study_guide: "kinds.study_guide",
  practice_problems: "kinds.practice_problems",
  case_study: "kinds.case_study",
} as const satisfies Record<StudyMaterialKind, string>;

export function kindLabelKey(kind: StudyMaterialKind): (typeof KIND_LABEL_KEYS)[StudyMaterialKind] {
  return KIND_LABEL_KEYS[kind];
}
