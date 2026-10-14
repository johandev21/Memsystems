import i18n from "@/shared/i18n";
import type { StudyMaterialKind } from "../types";

export const KIND_LABELS: Record<StudyMaterialKind, string> = {
  quiz: "Quiz",
  simple_flashcard: "Flashcards",
  roadmap: "Roadmap",
  mind_map: "Mind Map",
  slides: "Slides",
};

export const KIND_PLURAL_LABELS: Record<StudyMaterialKind, string> = {
  quiz: "Quizzes",
  simple_flashcard: "Flashcards",
  roadmap: "Roadmaps",
  mind_map: "Mind Maps",
  slides: "Slides",
};

export function getKindLabel(kind: StudyMaterialKind): string {
  switch (kind) {
    case "quiz":
      return i18n.t("kinds.quiz", { ns: "viewer" });
    case "simple_flashcard":
      return i18n.t("kinds.simple_flashcard", { ns: "viewer" });
    case "roadmap":
      return i18n.t("kinds.roadmap", { ns: "viewer" });
    case "mind_map":
      return i18n.t("kinds.mind_map", { ns: "viewer" });
    case "slides":
      return i18n.t("kinds.slides", { ns: "viewer" });
    default:
      return KIND_LABELS[kind] ?? kind;
  }
}

export function getKindPluralLabel(kind: StudyMaterialKind): string {
  switch (kind) {
    case "quiz":
      return i18n.t("kindsPlural.quiz", { ns: "viewer" });
    case "simple_flashcard":
      return i18n.t("kindsPlural.simple_flashcard", { ns: "viewer" });
    case "roadmap":
      return i18n.t("kindsPlural.roadmap", { ns: "viewer" });
    case "mind_map":
      return i18n.t("kindsPlural.mind_map", { ns: "viewer" });
    case "slides":
      return i18n.t("kindsPlural.slides", { ns: "viewer" });
    default:
      return KIND_PLURAL_LABELS[kind] ?? kind;
  }
}
