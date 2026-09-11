import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FolderPicker } from "@/features/notebooks";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { GenerationSourcePopover, type GenerationSource } from "./generation-source-popover";
import { CTA_BUTTON_CLASS } from "./option-row";
import { cn } from "@/shared/utils/cn";
import type { BriefFormData } from "./types";

export interface BriefKnowledgeStepProps {
  notebookId: string;
  value: BriefFormData;
  sources: GenerationSource[];
  hasSources: boolean;
  hasInstructions: boolean;
  canSubmit: boolean;
  submitLabel: string;
  disabled?: boolean;
  placeholder?: string;
  textareaId?: string;
  emptySourcesMessage?: string;
  onPatch: (patch: Partial<BriefFormData>) => void;
  onBack: () => void;
  onSubmit: () => void;
}

export function BriefKnowledgeStep({
  notebookId,
  value,
  sources,
  hasSources,
  hasInstructions,
  canSubmit,
  submitLabel,
  disabled = false,
  placeholder,
  textareaId = "brief-custom-instructions",
  emptySourcesMessage,
  onPatch,
  onBack,
  onSubmit,
}: BriefKnowledgeStepProps) {
  const { t } = useTranslation("generation");
  const resolvedPlaceholder = placeholder ?? t("knowledge.defaultPlaceholder");
  const resolvedEmptySourcesMessage =
    emptySourcesMessage ?? t("knowledge.defaultEmptySources");

  return (
    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-2 duration-150">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label className="text-sm font-medium text-text-primary">
            {t("fields.knowledgeSources")}
            {!hasInstructions && <span className="text-destructive ml-0.5">*</span>}
          </Label>
          <GenerationSourcePopover
            sources={sources}
            selectedIds={value.sourceIds}
            onChange={(sourceIds) => onPatch({ sourceIds })}
            emptyMessage={resolvedEmptySourcesMessage}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={textareaId} className="text-sm font-medium text-text-primary">
            {t("fields.customInstructions")}
            {!hasSources && <span className="text-destructive ml-0.5">*</span>}
          </Label>
          <Textarea
            id={textareaId}
            value={value.brief}
            onChange={(e) => onPatch({ brief: e.target.value })}
            placeholder={resolvedPlaceholder}
            className="min-h-[120px] max-h-[200px] text-xs resize-none w-full"
            disabled={disabled}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium text-text-tertiary">
            {t("fields.destinationFolder")}
          </Label>
          <FolderPicker
            notebookId={notebookId}
            value={value.folderId}
            onChange={(folderId) => onPatch({ folderId })}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="flex justify-between items-center pt-2 border-t border-transparent">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="h-9 px-4 text-sm text-text-faint hover:text-text-secondary gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="size-4" />
          {t("actions.back")}
        </Button>

        <Button
          type="button"
          className={cn(
            "h-10 px-6 rounded-full font-medium text-sm gap-2 cursor-pointer transition-colors",
            CTA_BUTTON_CLASS,
          )}
          disabled={!canSubmit}
          onClick={onSubmit}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
