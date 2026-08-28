import type { StudyMaterialKind } from "../types";

export const KIND_LABELS: Record<StudyMaterialKind, string> = {
  quiz: "Quiz",
  simple_flashcard: "Flashcards",
  roadmap: "Roadmap",
  mind_map: "Mind Map",
};

export const KIND_PLURAL_LABELS: Record<StudyMaterialKind, string> = {
  quiz: "Quizzes",
  simple_flashcard: "Flashcards",
  roadmap: "Roadmaps",
  mind_map: "Mind Maps",
};

export function getKindLabel(kind: StudyMaterialKind): string {
  return KIND_LABELS[kind] ?? kind;
}

export function getKindPluralLabel(kind: StudyMaterialKind): string {
  return KIND_PLURAL_LABELS[kind] ?? kind;
}
