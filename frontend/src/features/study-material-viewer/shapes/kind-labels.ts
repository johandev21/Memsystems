import type { StudyMaterialKind } from "../types";

export const KIND_LABELS: Record<StudyMaterialKind, string> = {
  quiz: "Quiz",
  simple_flashcard: "Flashcards",
  roadmap: "Roadmap",
  mind_map: "Mind Map",
  slides: "Slides",
  study_guide: "Study Guide",
  practice_problems: "Practice Problems",
  case_study: "Case Study",
};

export const KIND_PLURAL_LABELS: Record<StudyMaterialKind, string> = {
  quiz: "Quizzes",
  simple_flashcard: "Flashcards",
  roadmap: "Roadmaps",
  mind_map: "Mind Maps",
  slides: "Slides",
  study_guide: "Study Guides",
  practice_problems: "Practice Problems",
  case_study: "Case Studies",
};

export function getKindLabel(kind: StudyMaterialKind): string {
  return KIND_LABELS[kind] ?? kind;
}

export function getKindPluralLabel(kind: StudyMaterialKind): string {
  return KIND_PLURAL_LABELS[kind] ?? kind;
}
