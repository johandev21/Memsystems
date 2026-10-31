import type { ReactNode } from "react";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { FolderPicker } from "./folder-picker";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/cn";
import {
  BriefBackButton,
  BriefStep,
  BriefStepFields,
  BriefStepFooter,
  BriefSubmitButton,
} from "./brief-step";

export interface BriefInstructionsStepProps {
  notebookId: string;
  brief: string;
  folderId: string | null;
  hasSources: boolean;
  canSubmit: boolean;
  submitLabel: string;
  placeholder: string;
  textareaId: string;
  instructionsLabel?: string;
  longform?: boolean;
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
  instructionsLabel,
  longform = false,
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
            {instructionsLabel ?? t("fields.customInstructions")}
            {!hasSources && <span className="text-destructive ml-0.5">*</span>}
          </Label>
          <Textarea
            id={textareaId}
            value={brief}
            onChange={(event) => onBriefChange(event.target.value)}
            placeholder={placeholder}
            className={cn(
              "min-h-36 sm:min-h-30 max-h-60 text-base sm:text-sm resize-none break-words max-w-full overflow-x-hidden w-full",
              longform && "min-h-44 sm:min-h-40",
            )}
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
