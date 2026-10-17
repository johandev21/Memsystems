import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BriefChoiceField } from "./brief-choice-field";
import { BriefInstructionsStep } from "./brief-instructions-step";
import {
  BriefFieldLabel,
  BriefNextButton,
  BriefStep,
  BriefStepFields,
  BriefStepFooter,
  BriefStepHint,
} from "./brief-step";
import { BriefWizardHeader } from "./brief-wizard-header";
import { CountSelector } from "./count-selector";
import { GenerationSourcePopover } from "./generation-source-popover";
import {
  DEFAULT_SLIDES_OPTIONS,
  DETAIL_OPTIONS,
  MAX_SLIDE_COUNT,
  SLIDE_PRESETS,
} from "./slides-theme-options";
import type { BaseMaterialFormProps, SlidesOptions } from "./types";
import { useBriefWizard } from "./use-brief-wizard";

const TOTAL_STEPS = 2;
const CUSTOM_SLIDE_DEFAULT = 15;

export function SlidesBriefForm({
  notebookId,
  value,
  onChange,
  onSubmit,
  submitLabel,
  disabled = false,
}: BaseMaterialFormProps) {
  const { t } = useTranslation("generation");
  const { step, setStep, sources, hasSources, hasInstructions, canSubmit, patchFormData } =
    useBriefWizard({ notebookId, value, onChange, disabled, totalSteps: TOTAL_STEPS });

  const currentOptions = value.slidesOptions ?? DEFAULT_SLIDES_OPTIONS;
  const slideCount = currentOptions.slideCount || DEFAULT_SLIDES_OPTIONS.slideCount;
  const rawDetail = currentOptions.detailLevel as string | undefined;
  const detailLevel = (rawDetail === "auto" || !rawDetail
    ? DEFAULT_SLIDES_OPTIONS.detailLevel
    : rawDetail) as "basic" | "detailed";

  const updateSlidesOptions = (patch: Partial<SlidesOptions>) => {
    onChange({
      slidesOptions: {
        slideCount: patch.slideCount ?? slideCount,
        theme: patch.theme ?? currentOptions.theme ?? "auto",
        detailLevel: patch.detailLevel ?? detailLevel,
      },
    });
  };

  const countLabel =
    slideCount >= MAX_SLIDE_COUNT
      ? t("slides.countMax", { count: slideCount, max: MAX_SLIDE_COUNT })
      : t("slides.count", { count: slideCount });

  const detailOptions = [
    ...DETAIL_OPTIONS.map((opt) => ({
      id: opt.id,
      title: t(opt.titleKey),
      desc: t(opt.descKey),
    })),
  ];

  return (
    <div className="flex flex-1 flex-col gap-5 font-sans text-text-tertiary">
      <BriefWizardHeader
        title={t("wizard.title", { kind: t("kinds.slides") })}
        step={step}
        totalSteps={TOTAL_STEPS}
        onStepChange={setStep}
      />
      {step === 1 ? (
        <BriefStep>
          <BriefStepFields>
            <CountSelector
              label={t("slides.numberOfSlidesLabel")}
              summary={countLabel}
              value={slideCount}
              presets={SLIDE_PRESETS}
              min={1}
              max={MAX_SLIDE_COUNT}
              customDefault={CUSTOM_SLIDE_DEFAULT}
              customAriaLabel={t("slides.customCountAria")}
              onValueChange={(next) => updateSlidesOptions({ slideCount: next })}
            />

            <BriefChoiceField
              columns={2}
              label={t("fields.detailLevelStep2")}
              options={detailOptions}
              value={detailLevel}
              onChange={(next) => updateSlidesOptions({ detailLevel: next })}
            />

            <div className="flex flex-col gap-2">
              <BriefFieldLabel required={!hasInstructions}>
                {t("fields.knowledgeSourcesStep3")}
              </BriefFieldLabel>
              <GenerationSourcePopover
                sources={sources}
                selectedIds={value.sourceIds}
                onChange={(sourceIds) => patchFormData({ sourceIds })}
                emptyMessage={t("knowledge.emptySources", { kind: t("kinds.slides") })}
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
          submitLabel={submitLabel ?? t("actions.generateKind", { kind: t("kinds.slides") })}
          placeholder={t("slides.instructionsPlaceholder")}
          textareaId="brief-slides"
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
