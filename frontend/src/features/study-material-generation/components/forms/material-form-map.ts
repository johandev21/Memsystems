import type { StudyMaterialKind } from "@/features/study-material-viewer";
import type React from "react";
import { FlashcardBriefForm } from "./FlashcardBriefForm";
import { MindMapBriefForm } from "./MindMapBriefForm";
import { QuizBriefForm } from "./QuizBriefForm";
import { RoadmapBriefForm } from "./RoadmapBriefForm";
import { SlidesBriefForm } from "./SlidesBriefForm";
import type { BaseMaterialFormProps } from "./types";

export const MATERIAL_FORM_MAP: Partial<
  Record<StudyMaterialKind, React.ComponentType<BaseMaterialFormProps>>
> = {
  quiz: QuizBriefForm,
  simple_flashcard: FlashcardBriefForm,
  roadmap: RoadmapBriefForm,
  mind_map: MindMapBriefForm,
  slides: SlidesBriefForm,
};
