import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BriefChoiceField } from "./brief-choice-field";
import { BriefInstructionsStep } from "./brief-instructions-step";
import {
  BriefNextButton,
  BriefStep,
  BriefStepFields,
  BriefStepFooter,
  BriefStepHint,
} from "./brief-step";
import { BriefWizardHeader } from "./brief-wizard-header";
import { CountSelector } from "./count-selector";
import { GenerationSourcePopover } from "./generation-source-popover";
import { DEFAULT_ROADMAP_OPTIONS, DETAIL_OPTIONS, PHASE_PRESETS } from "./roadmap-options";
import type { BaseMaterialFormProps, RoadmapOptions } from "./types";
import { useBriefWizard } from "./use-brief-wizard";

const MAX_PHASE_COUNT = 50;
const CUSTOM_PHASE_DEFAULT = 12;

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

  const updateRoadmapOptions = (patch: Partial<RoadmapOptions>) => {
    onChange({
      roadmapOptions: {
        phaseCount: patch.phaseCount ?? phaseCount,
        detailLevel: patch.detailLevel ?? detailLevel,
      },
    });
  };

  const detailOptions = [
    { id: "auto" as const, title: t("actions.auto"), desc: t("options.auto.description") },
    ...DETAIL_OPTIONS.map((opt) => ({
      id: opt.id,
      title: t(opt.titleKey),
      desc: t(opt.descKey),
    })),
  ];

  const phaseLabel =
    phaseCount === 0
      ? t("actions.autoDecides")
      : phaseCount >= MAX_PHASE_COUNT
        ? t("roadmap.phaseCountMax", { count: phaseCount, max: MAX_PHASE_COUNT })
        : t("roadmap.phaseCount", { count: phaseCount });

  return (
    <div className="flex flex-col gap-5 font-sans text-text-tertiary">
      <BriefWizardHeader
        title={t("wizard.title", { kind: t("kinds.roadmap") })}
        step={step}
        totalSteps={2}
        onStepChange={setStep}
      />
      {step === 1 ? (
        <BriefStep>
          <BriefStepFields>
            <CountSelector
              label={t("roadmap.phasesLabel")}
              summary={phaseLabel}
              value={phaseCount}
              presets={PHASE_PRESETS}
              min={1}
              max={MAX_PHASE_COUNT}
              customDefault={CUSTOM_PHASE_DEFAULT}
              customAriaLabel={t("roadmap.customPhaseAria")}
              onValueChange={(next) => updateRoadmapOptions({ phaseCount: next })}
            />

            <BriefChoiceField
              columns={3}
              label={t("fields.detailLevelStep2")}
              options={detailOptions}
              value={detailLevel}
              onChange={(next) => updateRoadmapOptions({ detailLevel: next })}
            />

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium text-text-primary">
                {t("fields.knowledgeSourcesStep3")}
                {!hasInstructions && <span className="text-destructive ml-0.5">*</span>}
              </Label>
              <GenerationSourcePopover
                sources={sources}
                selectedIds={value.sourceIds}
                onChange={(sourceIds) => patchFormData({ sourceIds })}
                emptyMessage={t("knowledge.emptySources", { kind: t("kinds.roadmap") })}
              />
            </div>
          </BriefStepFields>

          <BriefStepFooter>
            <BriefStepHint>{t("wizard.nextHintInstructions")}</BriefStepHint>
            <BriefNextButton onClick={() => setStep(2)}>
              {t("actions.nextStep")}
              <ArrowRight className="size-4" />
            </BriefNextButton>
          </BriefStepFooter>
        </BriefStep>
      ) : (
        <BriefInstructionsStep
          notebookId={notebookId}
          brief={value.brief}
          folderId={value.folderId}
          hasSources={hasSources}
          canSubmit={canSubmit}
          submitLabel={submitLabel ?? t("actions.generateKind", { kind: t("kinds.roadmap") })}
          placeholder={t("roadmap.instructionsPlaceholder")}
          textareaId="brief-roadmap"
          disabled={disabled}
          onBriefChange={(brief) => patchFormData({ brief })}
          onFolderIdChange={(folderId) => patchFormData({ folderId })}
          onBack={() => setStep(1)}
          onSubmit={onSubmit}
        />
      )}
    </div>
  );
}
