import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FolderPicker } from "@/features/notebooks/components/studio/folder-picker";
import { SourceMultiSelect } from "@/features/notebooks/components/studio/source-multi-select";
import { kindLabelKey } from "../../kind-label";
import type { BaseMaterialFormProps, BriefFormData } from "./types";

export function StandardBriefForm({
  notebookId,
  kind,
  value,
  onChange,
  onSubmit,
  submitLabel,
  disabled = false,
}: BaseMaterialFormProps) {
  const { t } = useTranslation("generation");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const update = (patch: Partial<BriefFormData>) => {
    onChange(patch);
  };

  const label = t(kindLabelKey(kind));
  const canSubmit = !disabled && (value.sourceIds.length > 0 || value.brief.trim().length > 0);

  return (
    <div className="min-w-0 space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="brief" className="text-sm font-medium">
          {t("standard.briefLabel", { kind: label })}
        </Label>
        <Textarea
          id="brief"
          ref={textareaRef}
          value={value.brief}
          onChange={(e) => update({ brief: e.target.value })}
          placeholder={t("standard.briefPlaceholder", { kind: label })}
          className="min-h-22.5 max-h-50 text-sm resize-none break-all max-w-full overflow-x-hidden w-full"
          disabled={disabled}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-text-tertiary">
          {t("fields.knowledgeSources")}
        </Label>
        <SourceMultiSelect
          notebookId={notebookId}
          value={value.sourceIds}
          onChange={(sourceIds) => update({ sourceIds })}
          className={disabled ? "opacity-60" : ""}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-text-tertiary">
          {t("fields.destinationFolder")}
        </Label>
        <FolderPicker
          notebookId={notebookId}
          value={value.folderId}
          onChange={(folderId) => update({ folderId })}
          disabled={disabled}
        />
      </div>

      <Button
        type="button"
        className="w-full cursor-pointer"
        disabled={!canSubmit}
        onClick={onSubmit}
      >
        {submitLabel ?? t("actions.generate")}
      </Button>
    </div>
  );
}
