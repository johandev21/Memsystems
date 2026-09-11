import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FolderPicker } from "@/features/notebooks/components/studio/folder-picker";
import { cn } from "@/shared/utils/cn";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CTA_BUTTON_CLASS, optionRowClass } from "./option-row";
import { DETAIL_OPTIONS, PHASE_PRESETS, type DetailLevel } from "./roadmap-options";

export interface RoadmapPhasesSectionProps {
  phaseLabel: string;
  isAutoMode: boolean;
  isCustomMode: boolean;
  phaseCount: number;
  customVal: string;
  onSelectAuto: () => void;
  onSelectPreset: (count: number) => void;
  onEnableCustom: () => void;
  onCustomChange: (raw: string) => void;
  onCustomBlur: () => void;
}

export function RoadmapPhasesSection({
  phaseLabel,
  isAutoMode,
  isCustomMode,
  phaseCount,
  customVal,
  onSelectAuto,
  onSelectPreset,
  onEnableCustom,
  onCustomChange,
  onCustomBlur,
}: RoadmapPhasesSectionProps) {
  const { t } = useTranslation("generation");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-text-primary">{t("roadmap.phasesLabel")}</Label>
        <span className="text-xs font-medium text-primary">{phaseLabel}</span>
      </div>

      <div className="grid grid-cols-6 gap-2">
        <button
          type="button"
          onClick={onSelectAuto}
          className={cn(
            optionRowClass(isAutoMode),
            "flex h-9 items-center justify-center gap-1 text-center text-xs",
            isAutoMode ? "font-semibold" : "font-medium",
          )}
        >
          {t("actions.auto")}
        </button>

        {PHASE_PRESETS.map((cnt) => {
          const selected = !isAutoMode && !isCustomMode && phaseCount === cnt;
          return (
            <button
              key={cnt}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelectPreset(cnt)}
              className={cn(
                optionRowClass(selected),
                "flex h-9 items-center justify-center gap-1 text-center text-xs",
                selected ? "font-semibold" : "font-medium",
              )}
            >
              {cnt}
            </button>
          );
        })}

        {isCustomMode ? (
          <div className="relative flex h-9 items-center">
            <input
              type="number"
              min={1}
              max={50}
              value={customVal}
              onChange={(e) => onCustomChange(e.target.value)}
              onBlur={onCustomBlur}
              placeholder="1-50"
              aria-label="1-50"
              className="h-9 w-full rounded-2xl border border-primary bg-surface-2 px-1 text-center text-xs font-semibold text-text-primary shadow-2xs outline-none focus:ring-1 focus:ring-surface-border-strong"
              autoFocus
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={onEnableCustom}
            className={cn(
              optionRowClass(false),
              "flex h-9 items-center justify-center gap-1 text-center text-xs font-medium",
            )}
          >
            {t("actions.custom")}
          </button>
        )}
      </div>
    </div>
  );
}

export function RoadmapDetailLevelSection({
  detailLevel,
  onSelectDetailLevel,
}: {
  detailLevel: DetailLevel;
  onSelectDetailLevel: (detailLevel: DetailLevel) => void;
}) {
  const { t } = useTranslation("generation");

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium text-text-primary">{t("fields.detailLevelStep2")}</Label>
      <div className="grid grid-cols-2 gap-2">
        {DETAIL_OPTIONS.map((opt) => {
          const selected = detailLevel === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelectDetailLevel(opt.id)}
              className={cn(
                optionRowClass(selected),
                "flex cursor-pointer items-start gap-3 p-3 text-left",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      selected ? "text-primary-foreground" : "text-text-tertiary",
                    )}
                  >
                    {t(opt.titleKey)}
                  </span>
                </div>
                <span
                  className={cn(
                    "text-xs leading-tight",
                    selected ? "text-primary-foreground/80" : "text-text-faint",
                  )}
                >
                  {t(opt.descKey)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface RoadmapStepTwoProps {
  notebookId: string;
  brief: string;
  folderId: string | null;
  hasSources: boolean;
  disabled: boolean;
  canSubmit: boolean;
  submitLabel: string;
  onBriefChange: (brief: string) => void;
  onFolderIdChange: (folderId: string | null) => void;
  onBack: () => void;
  onSubmit: () => void;
}

export function RoadmapStepTwo({
  notebookId,
  brief,
  folderId,
  hasSources,
  disabled,
  canSubmit,
  submitLabel,
  onBriefChange,
  onFolderIdChange,
  onBack,
  onSubmit,
}: RoadmapStepTwoProps) {
  const { t } = useTranslation("generation");

  return (
    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-2 duration-150">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="brief-roadmap" className="text-sm font-medium text-text-primary">
            {t("fields.customInstructions")}
            {!hasSources && <span className="ml-0.5 text-destructive">*</span>}
          </Label>
          <Textarea
            id="brief-roadmap"
            value={brief}
            onChange={(e) => onBriefChange(e.target.value)}
            placeholder={t("roadmap.instructionsPlaceholder")}
            className="max-h-[200px] min-h-[120px] w-full resize-none text-xs"
            disabled={disabled}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium text-text-tertiary">
            {t("fields.destinationFolder")}
          </Label>
          <FolderPicker
            notebookId={notebookId}
            value={folderId}
            onChange={onFolderIdChange}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-transparent pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="h-9 cursor-pointer gap-1.5 px-4 text-sm text-text-faint hover:text-text-secondary"
        >
          <ArrowLeft className="size-4" />
          {t("actions.back")}
        </Button>

        <Button
          type="button"
          className={cn(
            "h-10 cursor-pointer gap-2 rounded-full px-6 text-sm font-medium transition-colors",
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
