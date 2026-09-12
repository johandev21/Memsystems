import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/shared/utils/cn";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BriefWizardHeader } from "./brief-wizard-header";
import { GenerationSourcePopover } from "./generation-source-popover";
import { CTA_BUTTON_CLASS } from "./option-row";
import {
  RoadmapDetailLevelSection,
  RoadmapPhasesSection,
  RoadmapStepTwo,
} from "./roadmap-form-sections";
import {
  DEFAULT_ROADMAP_OPTIONS,
  PHASE_PRESETS,
  type DetailLevel,
} from "./roadmap-options";
import type { BaseMaterialFormProps } from "./types";
import { useBriefWizard } from "./use-brief-wizard";

export function RoadmapBriefForm({
  notebookId,
  value,
  onChange,
  onSubmit,
  submitLabel,
  disabled = false,
}: BaseMaterialFormProps) {
  const { t } = useTranslation("generation");
  const { step, setStep, sources, hasSources, hasInstructions, canSubmit, patchFormData } =
    useBriefWizard({ notebookId, value, onChange, disabled });

  const currentOptions = value.roadmapOptions ?? DEFAULT_ROADMAP_OPTIONS;
  const phaseCount = currentOptions.phaseCount;
  const detailLevel = currentOptions.detailLevel;
  const isAutoMode = phaseCount === 0;

  const isPreset = phaseCount > 0 && PHASE_PRESETS.includes(phaseCount);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(!isAutoMode && !isPreset);
  const [customVal, setCustomVal] = useState<string>(() =>
    !isAutoMode && !isPreset ? String(phaseCount) : "12",
  );

  const updateRoadmapOptions = (patch: {
    phaseCount?: number;
    detailLevel?: DetailLevel;
  }) => {
    onChange({
      roadmapOptions: {
        phaseCount: patch.phaseCount !== undefined ? patch.phaseCount : phaseCount,
        detailLevel: patch.detailLevel ?? detailLevel,
      },
    });
  };

  const handleCustomChange = (raw: string) => {
    setCustomVal(raw);
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      const clamped = Math.min(50, Math.max(1, parsed));
      updateRoadmapOptions({ phaseCount: clamped });
    }
  };

  const handleCustomBlur = () => {
    let parsed = Number.parseInt(customVal, 10);
    if (Number.isNaN(parsed) || parsed < 1) parsed = 5;
    if (parsed > 50) parsed = 50;
    setCustomVal(String(parsed));
    updateRoadmapOptions({ phaseCount: parsed });
  };

  const phaseLabel = isAutoMode
    ? t("roadmap.autoLabel")
    : phaseCount >= 50
      ? t("roadmap.phaseCountMax", { count: phaseCount, max: 50 })
      : t("roadmap.phaseCount", { count: phaseCount });

  return (
    <div className="flex flex-col gap-5 font-sans text-text-tertiary">
      <BriefWizardHeader
        title={t("wizard.title", { kind: t("kinds.roadmap") })}
        step={step}
        onStepChange={setStep}
      />
      {step === 1 ? (
        <div className="flex min-h-[380px] flex-col justify-between gap-5 animate-in fade-in slide-in-from-right-2 duration-150">
          <div className="flex flex-col gap-5">
            <RoadmapPhasesSection
              phaseLabel={phaseLabel}
              isAutoMode={isAutoMode}
              isCustomMode={isCustomMode}
              phaseCount={phaseCount}
              customVal={customVal}
              onSelectAuto={() => {
                setIsCustomMode(false);
                updateRoadmapOptions({ phaseCount: 0 });
              }}
              onSelectPreset={(cnt) => {
                setIsCustomMode(false);
                updateRoadmapOptions({ phaseCount: cnt });
              }}
              onEnableCustom={() => {
                setIsCustomMode(true);
                const parsed = Number.parseInt(customVal, 10) || 12;
                const clamped = Math.min(50, Math.max(1, parsed));
                updateRoadmapOptions({ phaseCount: clamped });
              }}
              onCustomChange={handleCustomChange}
              onCustomBlur={handleCustomBlur}
            />

            <RoadmapDetailLevelSection
              detailLevel={detailLevel}
              onSelectDetailLevel={(nextDetail) => {
                updateRoadmapOptions({ detailLevel: nextDetail });
              }}
            />

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium text-text-primary">
                {t("fields.knowledgeSourcesStep3")}
                {!hasInstructions && <span className="ml-0.5 text-destructive">*</span>}
              </Label>
              <GenerationSourcePopover
                sources={sources}
                selectedIds={value.sourceIds}
                onChange={(sourceIds) => patchFormData({ sourceIds })}
                emptyMessage={t("knowledge.emptySources", { kind: t("kinds.roadmap") })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-transparent pt-2">
            <span className="text-xs text-text-faint">{t("wizard.nextHintInstructions")}</span>
            <Button
              type="button"
              onClick={() => {
                if (!value.roadmapOptions) {
                  updateRoadmapOptions({});
                }
                setStep(2);
              }}
              className={cn(
                "h-9 cursor-pointer gap-1.5 rounded-full px-5 text-sm font-medium transition-colors",
                CTA_BUTTON_CLASS,
              )}
            >
              {t("actions.nextStep")}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <RoadmapStepTwo
          notebookId={notebookId}
          brief={value.brief}
          folderId={value.folderId}
          hasSources={hasSources}
          disabled={disabled}
          canSubmit={canSubmit}
          submitLabel={submitLabel ?? t("actions.generateKind", { kind: t("kinds.roadmap") })}
          onBriefChange={(brief) => patchFormData({ brief })}
          onFolderIdChange={(folderId) => patchFormData({ folderId })}
          onBack={() => setStep(1)}
          onSubmit={() => {
            if (!value.roadmapOptions) {
              updateRoadmapOptions({});
            }
            onSubmit();
          }}
        />
      )}
    </div>
  );
}

