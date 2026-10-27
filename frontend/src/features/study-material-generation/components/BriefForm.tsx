import { MATERIAL_FORM_MAP } from "./forms/material-form-map";
import { StandardBriefForm } from "./forms/StandardBriefForm";
import type { BaseMaterialFormProps } from "./forms/types";

export { FlashcardBriefForm } from "./forms/FlashcardBriefForm";
export { MindMapBriefForm } from "./forms/MindMapBriefForm";
export { QuizBriefForm } from "./forms/QuizBriefForm";
export { RoadmapBriefForm } from "./forms/RoadmapBriefForm";
export { SlidesBriefForm } from "./forms/SlidesBriefForm";
export { StandardBriefForm } from "./forms/StandardBriefForm";
export type {
  BaseMaterialFormProps,
  BaseMaterialFormProps as BriefFormProps,
  BriefFormData,
} from "./forms/types";
export { MATERIAL_FORM_MAP } from "./forms/material-form-map";

export function BriefForm(props: BaseMaterialFormProps) {
  const FormComponent = MATERIAL_FORM_MAP[props.kind] ?? StandardBriefForm;
  return <FormComponent {...props} />;
}
