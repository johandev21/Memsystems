import { ArrowLeft, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BriefChoiceField } from "./brief-choice-field";
import { BriefInstructionsStep } from "./brief-instructions-step";
import {
  BriefFieldLabel,
  BriefBackButton,
  BriefNextButton,
  BriefStep,
  BriefStepFields,
  BriefStepFooter,
  BriefStepHint,
} from "./brief-step";
import { BriefWizardHeader } from "./brief-wizard-header";
import { GenerationSourcePopover } from "./generation-source-popover";
import type { BaseMaterialFormProps } from "./types";
import { useBriefWizard } from "./use-brief-wizard";

const TOTAL_STEPS = 3;

export function AudioOverviewBriefForm({
  notebookId,
  value,
  onChange,
  onSubmit,
  submitLabel,
  disabled = false,
}: BaseMaterialFormProps) {
  const { t } = useTranslation("generation");
  const wizard = useBriefWizard({ notebookId, value, onChange, disabled, totalSteps: TOTAL_STEPS });
  const { step, setStep, sources, hasSources, canSubmit, patchFormData } = wizard;

  const format = value.format ?? "briefing";
  const length = value.length ?? "standard";
  const audience = value.audience ?? "some_background";
  const canAdvance = hasSources && !disabled;
  const selectedSourceTitles = sources
    .filter((source) => value.sourceIds.includes(source.id))
    .map((source) => source.title);
  const moveToStep = (nextStep: number) => {
    if (nextStep > step && (nextStep !== step + 1 || (nextStep >= 3 && !hasSources))) {
      return;
    }
    setStep(nextStep);
  };

  const formatOptions = (["briefing", "deep_dive"] as const).map((id) => ({
    id,
    title: t(`audioOverview.format.${id}`),
    desc: t(`audioOverview.format.${id}Desc`),
  }));
  const lengthOptions = (["short", "standard", "extended"] as const).map((id) => ({
    id,
    title: t(`audioOverview.length.${id}`),
    desc: t(`audioOverview.length.${id}Desc`),
  }));
  const audienceOptions = (["new_to_topic", "some_background", "advanced"] as const).map((id) => ({
    id,
    title: t(`audioOverview.audience.${id}`),
    desc: t(`audioOverview.audience.${id}Desc`),
  }));
  const formatLabel =
    format === "deep_dive"
      ? t("audioOverview.format.deep_dive")
      : t("audioOverview.format.briefing");
  const lengthLabel =
    length === "short"
      ? t("audioOverview.length.short")
      : length === "extended"
        ? t("audioOverview.length.extended")
        : t("audioOverview.length.standard");
  const audienceLabel =
    audience === "new_to_topic"
      ? t("audioOverview.audience.new_to_topic")
      : audience === "advanced"
        ? t("audioOverview.audience.advanced")
        : t("audioOverview.audience.some_background");

  return (
    <div className="flex flex-1 flex-col gap-5 font-sans text-text-tertiary">
      <BriefWizardHeader
        title={t("wizard.title", { kind: t("kinds.audio_overview") })}
        step={step}
        totalSteps={TOTAL_STEPS}
        onStepChange={moveToStep}
      />
      {step === 1 ? (
        <BriefStep>
          <BriefStepFields>
            <BriefChoiceField
              label={t("audioOverview.format.label")}
              options={formatOptions}
              value={format}
              onChange={(next) => patchFormData({ format: next })}
              columns={2}
              disabled={disabled}
            />
            <BriefChoiceField
              label={t("audioOverview.length.label")}
              options={lengthOptions}
              value={length}
              onChange={(next) => patchFormData({ length: next })}
              columns={3}
              disabled={disabled}
            />
            <p className="-mt-3 text-xs text-text-secondary">
              {t("audioOverview.length.estimate")}
            </p>
          </BriefStepFields>
          <BriefStepFooter>
            <BriefStepHint>{t("audioOverview.nextHintAudience")}</BriefStepHint>
            <BriefNextButton onClick={() => moveToStep(2)}>
              {t("actions.nextStep")}
              <ArrowRight className="size-4" />
            </BriefNextButton>
          </BriefStepFooter>
        </BriefStep>
      ) : step === 2 ? (
        <BriefStep>
          <BriefStepFields>
            <BriefChoiceField
              label={t("audioOverview.audience.label")}
              options={audienceOptions}
              value={audience}
              onChange={(next) => patchFormData({ audience: next })}
              columns={3}
              disabled={disabled}
            />
            <div className="flex flex-col gap-2">
              <BriefFieldLabel required>{t("fields.knowledgeSources")}</BriefFieldLabel>
              <GenerationSourcePopover
                sources={sources}
                selectedIds={value.sourceIds}
                onChange={(sourceIds) => patchFormData({ sourceIds })}
                emptyMessage={t("knowledge.emptySources", { kind: t("kinds.audio_overview") })}
              />
              {!hasSources && (
                <p className="text-xs text-text-secondary" role="status">
                  {t("audioOverview.sourceRequired")}
                </p>
              )}
              {selectedSourceTitles.length > 0 && (
                <p className="text-xs text-text-secondary">
                  {t("audioOverview.selectedSources", {
                    sources: selectedSourceTitles.join(", "),
                  })}
                </p>
              )}
            </div>
          </BriefStepFields>
          <BriefStepFooter>
            <BriefBackButton onClick={() => setStep(1)}>
              <ArrowLeft className="size-4" />
              {t("actions.back")}
            </BriefBackButton>
            <BriefNextButton disabled={!canAdvance} onClick={() => moveToStep(3)}>
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
          canSubmit={canSubmit && hasSources}
          submitLabel={
            submitLabel ?? t("actions.generateKind", { kind: t("kinds.audio_overview") })
          }
          placeholder={t("audioOverview.instructionsPlaceholder")}
          textareaId="brief-audio-overview"
          instructionsLabel={t("audioOverview.briefLabel")}
          longform
          extra={
            <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs text-text-secondary">
              {t("audioOverview.overviewSummary", {
                format: formatLabel,
                length: lengthLabel,
                audience: audienceLabel,
              })}
              <span>
                {t("audioOverview.selectedSourceCount", { count: value.sourceIds.length })}
              </span>
            </p>
          }
          disabled={disabled}
          onBriefChange={(brief) => patchFormData({ brief })}
          onFolderIdChange={(folderId) => patchFormData({ folderId })}
          onBack={() => setStep(2)}
          onSubmit={onSubmit}
        />
      )}
    </div>
  );
}
