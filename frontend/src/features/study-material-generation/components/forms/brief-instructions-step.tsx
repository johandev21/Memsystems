import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FolderPicker } from "@/features/notebooks/components/studio/folder-picker";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  BriefBackButton,
  BriefStep,
  BriefStepFields,
  BriefStepFooter,
  BriefSubmitButton,
} from "./brief-step";

/**
 * Shared second step for every generation dialog: the custom instructions
 * textarea, an optional extra field block (e.g. Case Study concepts), the
 * destination folder, and the Back / Generate footer.
 *
 * Knowledge sources live on step one in every form, matching the Quiz
 * reference, so this step only carries the brief.
 */
export interface BriefInstructionsStepProps {
  notebookId: string;
  brief: string;
  folderId: string | null;
  hasSources: boolean;
  canSubmit: boolean;
  submitLabel: string;
  placeholder: string;
  textareaId: string;
  /** Extra field block rendered above the instructions textarea. */
  extra?: ReactNode;
  disabled?: boolean;
  onBriefChange: (brief: string) => void;
  onFolderIdChange: (folderId: string | null) => void;
  onBack: () => void;
  onSubmit: () => void;
}

export function BriefInstructionsStep({
  notebookId,
  brief,
  folderId,
  hasSources,
  canSubmit,
  submitLabel,
  placeholder,
  textareaId,
  extra,
  disabled = false,
  onBriefChange,
  onFolderIdChange,
  onBack,
  onSubmit,
}: BriefInstructionsStepProps) {
  const { t } = useTranslation("generation");

  return (
    <BriefStep>
      <BriefStepFields>
        {extra}

        <div className="flex flex-col gap-2">
          <Label htmlFor={textareaId} className="text-sm font-medium text-text-primary">
            {t("fields.customInstructions")}
            {!hasSources && <span className="text-destructive ml-0.5">*</span>}
          </Label>
          <Textarea
            id={textareaId}
            value={brief}
            onChange={(event) => onBriefChange(event.target.value)}
            placeholder={placeholder}
            className="min-h-30 max-h-50 text-sm resize-none break-all max-w-full overflow-x-hidden w-full"
            disabled={disabled}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-sm font-medium text-text-tertiary">
            {t("fields.destinationFolder")}
          </Label>
          <FolderPicker
            notebookId={notebookId}
            value={folderId}
            onChange={onFolderIdChange}
            disabled={disabled}
          />
        </div>
      </BriefStepFields>

      <BriefStepFooter>
        <BriefBackButton onClick={onBack}>
          <ArrowLeft className="size-4" />
          {t("actions.back")}
        </BriefBackButton>
        <BriefSubmitButton disabled={!canSubmit} onClick={onSubmit}>
          {submitLabel}
        </BriefSubmitButton>
      </BriefStepFooter>
    </BriefStep>
  );
}
