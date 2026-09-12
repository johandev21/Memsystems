import i18n from "@/shared/i18n";
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
    case "study_guide":
      return i18n.t("kinds.study_guide", { ns: "viewer" });
    case "practice_problems":
      return i18n.t("kinds.practice_problems", { ns: "viewer" });
    case "case_study":
      return i18n.t("kinds.case_study", { ns: "viewer" });
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
    case "study_guide":
      return i18n.t("kindsPlural.study_guide", { ns: "viewer" });
    case "practice_problems":
      return i18n.t("kindsPlural.practice_problems", { ns: "viewer" });
    case "case_study":
      return i18n.t("kindsPlural.case_study", { ns: "viewer" });
    default:
      return KIND_PLURAL_LABELS[kind] ?? kind;
  }
}
