import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FolderPicker } from "@/features/notebooks";
import { sourcesQueryOptions } from "@/features/sources";
import { cn } from "@/shared/utils/cn";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";
import { BriefWizardHeader } from "./brief-wizard-header";
import { GenerationSourcePopover, type GenerationSource } from "./generation-source-popover";
import { CTA_BUTTON_CLASS, optionRowClass } from "./option-row";
import type { BaseMaterialFormProps } from "./types";

// ============================================================================
// Module Constants
// ============================================================================

type DetailLevel = "basic" | "detailed";

const PHASE_PRESETS = [3, 5, 7, 10];

const DETAIL_OPTIONS = [
  {
    id: "basic" as DetailLevel,
    title: "Basic",
    desc: "Phase titles & milestones only",
  },
  {
    id: "detailed" as DetailLevel,
    title: "Detailed",
    desc: "In-depth topics & learning objectives",
  },
] as const;

// ============================================================================
// Subcomponents
// ============================================================================

interface RoadmapPhasesSectionProps {
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

function RoadmapPhasesSection({
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
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <Label className="text-sm font-medium text-text-primary">1. Number of Phases</Label>
        <span className="text-xs font-medium text-primary">{phaseLabel}</span>
      </div>

      <div className="grid grid-cols-6 gap-2">
        <button
          type="button"
          onClick={onSelectAuto}
          className={cn(
            optionRowClass(isAutoMode),
            "h-9 text-xs text-center flex items-center justify-center gap-1",
            isAutoMode ? "font-semibold" : "font-medium",
          )}
        >
          Auto
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
                "h-9 text-xs text-center flex items-center justify-center gap-1",
                selected ? "font-semibold" : "font-medium",
              )}
            >
              {cnt}
            </button>
          );
        })}

        {isCustomMode && !isAutoMode ? (
          <div className="relative flex items-center h-9">
            <input
              type="number"
              min={1}
              max={50}
              value={customVal}
              onChange={(e) => onCustomChange(e.target.value)}
              onBlur={onCustomBlur}
              placeholder="1-50"
              aria-label="1-50"
              className="w-full h-9 px-2 text-center text-xs font-semibold bg-surface-2 border border-primary text-text-primary rounded-2xl outline-none focus:ring-1 focus:ring-surface-border-strong shadow-2xs"
              autoFocus
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={onEnableCustom}
            className={cn(
              optionRowClass(false),
              "h-9 text-xs font-medium text-center flex items-center justify-center",
            )}
          >
            Custom
          </button>
        )}
      </div>
    </div>
  );
}

interface RoadmapDetailLevelSectionProps {
  detailLevel: DetailLevel;
  onSelectDetailLevel: (detailLevel: DetailLevel) => void;
}

function RoadmapDetailLevelSection({
  detailLevel,
  onSelectDetailLevel,
}: RoadmapDetailLevelSectionProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium text-text-primary">2. Detail Level</Label>
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
                "p-3 flex items-start gap-3 text-left cursor-pointer",
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      selected ? "text-primary-foreground" : "text-text-tertiary",
                    )}
                  >
                    {opt.title}
                  </span>
                </div>
                <span
                  className={cn(
                    "text-xs leading-tight",
                    selected ? "text-primary-foreground/80" : "text-text-faint",
                  )}
                >
                  {opt.desc}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface RoadmapStepOneProps {
  phasesProps: RoadmapPhasesSectionProps;
  detailLevel: DetailLevel;
  onSelectDetailLevel: (detailLevel: DetailLevel) => void;
  sources: GenerationSource[];
  selectedSourceIds: string[];
  hasInstructions: boolean;
  onSourceIdsChange: (sourceIds: string[]) => void;
  onNext: () => void;
}

function RoadmapStepOne({
  phasesProps,
  detailLevel,
  onSelectDetailLevel,
  sources,
  selectedSourceIds,
  hasInstructions,
  onSourceIdsChange,
  onNext,
}: RoadmapStepOneProps) {
  return (
    <div className="flex flex-col gap-5 min-h-[380px] justify-between animate-in fade-in slide-in-from-right-2 duration-150">
      <div className="flex flex-col gap-5">
        <RoadmapPhasesSection {...phasesProps} />

        <RoadmapDetailLevelSection
          detailLevel={detailLevel}
          onSelectDetailLevel={onSelectDetailLevel}
        />

        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium text-text-primary">
            3. Knowledge Sources
            {!hasInstructions && <span className="text-destructive ml-0.5">*</span>}
          </Label>
          <GenerationSourcePopover
            sources={sources}
            selectedIds={selectedSourceIds}
            onChange={onSourceIdsChange}
            emptyMessage="No sources in notebook. Roadmap will generate using general knowledge."
          />
        </div>
      </div>

      <div className="flex justify-between items-center pt-2 border-t border-transparent">
        <span className="text-xs text-text-faint">Configure custom instructions next</span>
        <Button
          type="button"
          onClick={onNext}
          className={cn(
            "h-9 px-5 rounded-full text-sm font-medium gap-1.5 cursor-pointer transition-colors",
            CTA_BUTTON_CLASS,
          )}
        >
          Next Step
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

interface RoadmapStepTwoProps {
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

function RoadmapStepTwo({
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
  return (
    <div className="flex flex-col gap-5 min-h-[380px] justify-between animate-in fade-in slide-in-from-right-2 duration-150">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="brief-roadmap" className="text-sm font-medium text-text-primary">
            Custom Instructions{!hasSources && <span className="text-destructive ml-0.5">*</span>}
          </Label>
          <Textarea
            id="brief-roadmap"
            value={brief}
            onChange={(e) => onBriefChange(e.target.value)}
            placeholder="What do you want to learn? Describe the topic, goal, or target skill..."
            className="min-h-[120px] max-h-[200px] text-xs resize-none break-all max-w-full overflow-x-hidden w-full"
            disabled={disabled}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium text-text-tertiary">Destination Folder</Label>
          <FolderPicker
            notebookId={notebookId}
            value={folderId}
            onChange={onFolderIdChange}
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
          Back
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

// ============================================================================
// Roadmap Brief Form Component
// ============================================================================

export function RoadmapBriefForm({
  notebookId,
  value,
  onChange,
  onSubmit,
  submitLabel = "Generate Roadmap",
  disabled = false,
}: BaseMaterialFormProps) {
  const [step, setStep] = useState<1 | 2>(1);

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

  const { data: sources = [] } = useQuery(sourcesQueryOptions(notebookId));

  const hasSources = value.sourceIds.length > 0;
  const hasInstructions = value.brief.trim().length > 0;
  const canSubmit = !disabled && (hasSources || hasInstructions);

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
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed > 0) {
      const clamped = Math.min(50, Math.max(1, parsed));
      setPhaseCount(clamped);
      updateRoadmapOptions({ phaseCount: clamped });
    }
  };

  const handleCustomBlur = () => {
    let parsed = parseInt(customVal, 10);
    if (isNaN(parsed) || parsed < 1) parsed = 5;
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
        <RoadmapStepOne
          phasesProps={{
            phaseLabel,
            isAutoMode,
            isCustomMode,
            phaseCount,
            customVal,
            onSelectAuto: () => {
              setIsAutoMode(true);
              setIsCustomMode(false);
              setPhaseCount(0);
              updateRoadmapOptions({ phaseCount: 0 });
            },
            onSelectPreset: (cnt) => {
              setIsAutoMode(false);
              setIsCustomMode(false);
              setPhaseCount(cnt);
              updateRoadmapOptions({ phaseCount: cnt });
            },
            onEnableCustom: () => {
              setIsAutoMode(false);
              setIsCustomMode(true);
              const parsed = parseInt(customVal, 10) || 12;
              const clamped = Math.min(50, Math.max(1, parsed));
              setPhaseCount(clamped);
              updateRoadmapOptions({ phaseCount: clamped });
            },
            onCustomChange: handleCustomChange,
            onCustomBlur: handleCustomBlur,
          }}
          detailLevel={detailLevel}
          onSelectDetailLevel={(nextDetail) => {
            setDetailLevel(nextDetail);
            updateRoadmapOptions({ detailLevel: nextDetail });
          }}
          sources={sources}
          selectedSourceIds={value.sourceIds}
          hasInstructions={hasInstructions}
          onSourceIdsChange={(sourceIds) => onChange({ sourceIds })}
          onNext={() => setStep(2)}
        />
      ) : (
        <RoadmapStepTwo
          notebookId={notebookId}
          brief={value.brief}
          folderId={value.folderId}
          hasSources={hasSources}
          disabled={disabled}
          canSubmit={canSubmit}
          submitLabel={submitLabel}
          onBriefChange={(brief) => onChange({ brief })}
          onFolderIdChange={(folderId) => onChange({ folderId })}
          onBack={() => setStep(1)}
          onSubmit={onSubmit}
        />
      )}
    </div>
  );
}
