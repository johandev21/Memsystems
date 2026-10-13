import { MATERIAL_FORM_MAP } from "./material-form-map";
import { StandardBriefForm } from "./StandardBriefForm";
import type { BaseMaterialFormProps } from "./types";

export { FlashcardBriefForm } from "./FlashcardBriefForm";
export { MindMapBriefForm } from "./MindMapBriefForm";
export { QuizBriefForm } from "./QuizBriefForm";
export { RoadmapBriefForm } from "./RoadmapBriefForm";
export { SlidesBriefForm } from "./SlidesBriefForm";
export { StandardBriefForm } from "./StandardBriefForm";
export type { BaseMaterialFormProps, BriefFormData } from "./types";

export function BriefForm(props: BaseMaterialFormProps) {
  const FormComponent = MATERIAL_FORM_MAP[props.kind] ?? StandardBriefForm;
  return <FormComponent {...props} />;
}
