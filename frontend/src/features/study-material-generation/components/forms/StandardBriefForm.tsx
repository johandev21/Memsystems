import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FolderPicker, SourceMultiSelect } from "@/features/notebooks";
import { KIND_LABELS } from "@/features/study-material-viewer";
import type { BaseMaterialFormProps, BriefFormData } from "./types";

export function StandardBriefForm({
  notebookId,
  kind,
  value,
  onChange,
  onSubmit,
  submitLabel = "Generate",
  disabled = false,
}: BaseMaterialFormProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const update = (patch: Partial<BriefFormData>) => {
    onChange(patch);
  };

  const label = KIND_LABELS[kind] || kind;
  const canSubmit = !disabled && (value.sourceIds.length > 0 || value.brief.trim().length > 0);

  return (
    <div className="min-w-0 space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="brief" className="text-sm font-medium">
          Brief instructions for {label} (optional)
        </Label>
        <Textarea
          id="brief"
          ref={textareaRef}
          value={value.brief}
          onChange={(e) => update({ brief: e.target.value })}
          placeholder={`Describe what topics or focus areas to include in this ${label}...`}
          className="min-h-[90px] max-h-[200px] text-xs resize-none break-all max-w-full overflow-x-hidden w-full"
          disabled={disabled}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-text-tertiary">Knowledge Sources</Label>
        <SourceMultiSelect
          notebookId={notebookId}
          value={value.sourceIds}
          onChange={(sourceIds) => update({ sourceIds })}
          className={disabled ? "opacity-60" : ""}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-text-tertiary">Destination Folder</Label>
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
        {submitLabel}
      </Button>
    </div>
  );
}
