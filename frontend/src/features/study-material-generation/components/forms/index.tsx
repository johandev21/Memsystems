import type React from "react";
import type { StudyMaterialKind } from "@/features/study-material-viewer";
import type { BaseMaterialFormProps } from "./types";
import { QuizBriefForm } from "./QuizBriefForm";
import { FlashcardBriefForm } from "./FlashcardBriefForm";
import { RoadmapBriefForm } from "./RoadmapBriefForm";
import { MindMapBriefForm } from "./MindMapBriefForm";
import { StandardBriefForm } from "./StandardBriefForm";

export type { BaseMaterialFormProps, BriefFormData } from "./types";
export { QuizBriefForm } from "./QuizBriefForm";
export { FlashcardBriefForm } from "./FlashcardBriefForm";
export { RoadmapBriefForm } from "./RoadmapBriefForm";
export { MindMapBriefForm } from "./MindMapBriefForm";
export { StandardBriefForm } from "./StandardBriefForm";

/**
 * Declarative Form Registry Map (FSD v2.1 Compliant)
 * Maps study material kinds to their dedicated form components.
 */
export const MATERIAL_FORM_MAP: Partial<
  Record<StudyMaterialKind, React.ComponentType<BaseMaterialFormProps>>
> = {
  quiz: QuizBriefForm,
  simple_flashcard: FlashcardBriefForm,
  roadmap: RoadmapBriefForm,
  mind_map: MindMapBriefForm,
};

/**
 * BriefForm dispatcher component.
 * Renders the registered form component for the specified kind, or falls back to StandardBriefForm.
 */
export function BriefForm(props: BaseMaterialFormProps) {
  const FormComponent = MATERIAL_FORM_MAP[props.kind] ?? StandardBriefForm;
  return <FormComponent {...props} />;
}
