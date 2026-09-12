import type { StudyMaterialKind } from "@/features/study-material-viewer";
import type React from "react";
import { CaseStudyBriefForm } from "./CaseStudyBriefForm";
import { FlashcardBriefForm } from "./FlashcardBriefForm";
import { MindMapBriefForm } from "./MindMapBriefForm";
import { PracticeProblemsBriefForm } from "./PracticeProblemsBriefForm";
import { QuizBriefForm } from "./QuizBriefForm";
import { RoadmapBriefForm } from "./RoadmapBriefForm";
import { SlidesBriefForm } from "./SlidesBriefForm";
import { StudyGuideBriefForm } from "./StudyGuideBriefForm";
import type { BaseMaterialFormProps } from "./types";

export const MATERIAL_FORM_MAP: Partial<
  Record<StudyMaterialKind, React.ComponentType<BaseMaterialFormProps>>
> = {
  quiz: QuizBriefForm,
  simple_flashcard: FlashcardBriefForm,
  roadmap: RoadmapBriefForm,
  mind_map: MindMapBriefForm,
  slides: SlidesBriefForm,
  study_guide: StudyGuideBriefForm,
  practice_problems: PracticeProblemsBriefForm,
  case_study: CaseStudyBriefForm,
};
