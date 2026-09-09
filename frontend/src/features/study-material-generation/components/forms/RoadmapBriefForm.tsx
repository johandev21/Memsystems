import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/shared/utils/cn";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { BriefWizardHeader } from "./brief-wizard-header";
import { GenerationSourcePopover } from "./generation-source-popover";
import { CTA_BUTTON_CLASS } from "./option-row";
import {
  RoadmapDetailLevelSection,
  RoadmapPhasesSection,
  RoadmapStepTwo,
} from "./roadmap-form-sections";
import { PHASE_PRESETS, type DetailLevel } from "./roadmap-options";
import type { BaseMaterialFormProps } from "./types";
import { useBriefWizard } from "./use-brief-wizard";

export function RoadmapBriefForm({
  notebookId,
  value,
  onChange,
  onSubmit,
  submitLabel = "Generate Roadmap",
  disabled = false,
}: BaseMaterialFormProps) {
  const { step, setStep, sources, hasSources, hasInstructions, canSubmit, patchFormData } =
    useBriefWizard({ notebookId, value, onChange, disabled });

  const initialPhaseCount = value.roadmapOptions?.phaseCount ?? 5;
  const [phaseCount, setPhaseCount] = useState<number>(initialPhaseCount);
  const [isAutoMode, setIsAutoMode] = useState<boolean>(initialPhaseCount === 0);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(
    initialPhaseCount > 0 && !PHASE_PRESETS.includes(initialPhaseCount),
  );
  const [customVal, setCustomVal] = useState<string>(
    initialPhaseCount > 0 && !PHASE_PRESETS.includes(initialPhaseCount)
      ? String(initialPhaseCount)
      : "12",
  );

  const [detailLevel, setDetailLevel] = useState<DetailLevel>(
    value.roadmapOptions?.detailLevel ?? "detailed",
  );

  useEffect(() => {
    onChange({
      roadmapOptions: {
        phaseCount: isAutoMode ? 0 : phaseCount,
        detailLevel,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseCount, isAutoMode, detailLevel]);

  const updateRoadmapOptions = (patch: {
    phaseCount?: number;
    detailLevel?: DetailLevel;
  }) => {
    const nextCount = patch.phaseCount ?? (isAutoMode ? 0 : phaseCount);
    const nextDetail = patch.detailLevel ?? detailLevel;
    onChange({
      roadmapOptions: {
        phaseCount: nextCount,
        detailLevel: nextDetail,
      },
    });
  };

  const handleCustomChange = (raw: string) => {
    setCustomVal(raw);
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      const clamped = Math.min(50, Math.max(1, parsed));
      setPhaseCount(clamped);
      updateRoadmapOptions({ phaseCount: clamped });
    }
  };

  const handleCustomBlur = () => {
    let parsed = Number.parseInt(customVal, 10);
    if (Number.isNaN(parsed) || parsed < 1) parsed = 5;
    if (parsed > 50) parsed = 50;
    setCustomVal(String(parsed));
    setPhaseCount(parsed);
    updateRoadmapOptions({ phaseCount: parsed });
  };

  const phaseLabel = isAutoMode
    ? "Auto (AI Decides optimal phases)"
    : `${phaseCount} ${phaseCount === 1 ? "Phase" : "Phases"}${phaseCount >= 50 ? " (Max 50)" : ""}`;

  return (
    <div className="flex flex-col gap-5 font-sans text-text-tertiary">
      <BriefWizardHeader title="Roadmap Setup" step={step} onStepChange={setStep} />
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
                setIsAutoMode(true);
                setIsCustomMode(false);
                setPhaseCount(0);
                updateRoadmapOptions({ phaseCount: 0 });
              }}
              onSelectPreset={(cnt) => {
                setIsAutoMode(false);
                setIsCustomMode(false);
                setPhaseCount(cnt);
                updateRoadmapOptions({ phaseCount: cnt });
              }}
              onEnableCustom={() => {
                setIsAutoMode(false);
                setIsCustomMode(true);
                const parsed = Number.parseInt(customVal, 10) || 12;
                const clamped = Math.min(50, Math.max(1, parsed));
                setPhaseCount(clamped);
                updateRoadmapOptions({ phaseCount: clamped });
              }}
              onCustomChange={handleCustomChange}
              onCustomBlur={handleCustomBlur}
            />

            <RoadmapDetailLevelSection
              detailLevel={detailLevel}
              onSelectDetailLevel={(nextDetail) => {
                setDetailLevel(nextDetail);
                updateRoadmapOptions({ detailLevel: nextDetail });
              }}
            />

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium text-text-primary">
                3. Knowledge Sources
                {!hasInstructions && <span className="ml-0.5 text-destructive">*</span>}
              </Label>
              <GenerationSourcePopover
                sources={sources}
                selectedIds={value.sourceIds}
                onChange={(sourceIds) => patchFormData({ sourceIds })}
                emptyMessage="No sources in notebook. Roadmap will generate using general knowledge."
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-transparent pt-2">
            <span className="text-xs text-text-faint">Configure custom instructions next</span>
            <Button
              type="button"
              onClick={() => setStep(2)}
              className={cn(
                "h-9 cursor-pointer gap-1.5 rounded-full px-5 text-sm font-medium transition-colors",
                CTA_BUTTON_CLASS,
              )}
            >
              Next Step
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
          submitLabel={submitLabel}
          onBriefChange={(brief) => patchFormData({ brief })}
          onFolderIdChange={(folderId) => patchFormData({ folderId })}
          onBack={() => setStep(1)}
          onSubmit={onSubmit}
        />
      )}
    </div>
  );
}
