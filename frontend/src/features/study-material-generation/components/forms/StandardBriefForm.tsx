import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { FolderPicker } from "./folder-picker";
import { SourceMultiSelect } from "./source-multi-select";
import { canSubmitBrief, useNotebookGroundingMode } from "@/features/notebooks";
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

  const groundingMode = useNotebookGroundingMode(notebookId);
  const hasSources = value.sourceIds.length > 0;
  const showFreeHint = groundingMode === "free" && !hasSources;

  const label = t(kindLabelKey(kind));
  const canSubmit =
    canSubmitBrief(groundingMode, hasSources, value.brief.trim().length > 0, disabled) &&
    (kind !== "audio_overview" || hasSources);

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
          className="min-h-30 max-h-50 text-base sm:text-sm resize-none break-words max-w-full overflow-x-hidden w-full"
          disabled={disabled}
        />
      </div>

      {kind === "audio_overview" && (
        <div className="grid gap-3 sm:grid-cols-3">
          {(["format", "length", "audience"] as const).map((field) => {
            const options =
              field === "format"
                ? ["briefing", "deep_dive"]
                : field === "length"
                  ? ["short", "standard", "extended"]
                  : ["new_to_topic", "some_background", "advanced"];
            const selected =
              value[field] ??
              (field === "format"
                ? "briefing"
                : field === "length"
                  ? "standard"
                  : "some_background");
            return (
              <div key={field} className="space-y-1.5">
                <Label
                  htmlFor={`audio-${field}`}
                  className="text-sm font-medium text-text-tertiary"
                >
                  {t(`audioOverview.${field}.label`)}
                </Label>
                <select
                  id={`audio-${field}`}
                  className="h-10 w-full rounded-md border border-surface-border bg-surface-1 px-3 text-sm"
                  value={selected}
                  onChange={(event) =>
                    update({ [field]: event.target.value } as Partial<BriefFormData>)
                  }
                  disabled={disabled}
                >
                  {options.map((option) => (
                    <option key={option} value={option}>
                      {t(`audioOverview.${field}.${option}` as never)}
                    </option>
                  ))}
                </select>
                {field === "length" && (
                  <p className="text-xs text-text-secondary">
                    {t("audioOverview.length.estimate")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

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
        {kind === "audio_overview" && !hasSources && (
          <p className="text-xs text-text-secondary">{t("audioOverview.sourceRequired")}</p>
        )}
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
        className="min-h-11 sm:min-h-9 w-full cursor-pointer touch-manipulation active:scale-97"
        disabled={!canSubmit}
        onClick={onSubmit}
      >
        {submitLabel ?? t("actions.generate")}
      </Button>
      {showFreeHint && <p className="text-xs text-text-secondary">{t("fields.freeHint")}</p>}
    </div>
  );
}
