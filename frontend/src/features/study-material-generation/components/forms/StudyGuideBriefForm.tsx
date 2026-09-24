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
import type { BaseMaterialFormProps } from "./types";
import { useBriefWizard } from "./use-brief-wizard";

// ============================================================================
// Module Constants
// ============================================================================

type StudyGuideFormat = "detailed" | "revision" | "auto";

const SECTION_PRESETS = [4, 6, 8] as const;

// ============================================================================
// Study Guide Brief Form Component
// ============================================================================

export function StudyGuideBriefForm({
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

  const format: StudyGuideFormat = value.studyGuideOptions?.format ?? "auto";
  const sectionCount = value.studyGuideOptions?.sectionCount ?? 0;

  const updateStudyGuideOptions = (patch: {
    format?: StudyGuideFormat;
    sectionCount?: number;
  }) => {
    onChange({
      studyGuideOptions: {
        format: patch.format ?? format,
        sectionCount: patch.sectionCount ?? sectionCount,
      },
    });
  };

  const formatOptions = [
    { id: "auto", title: t("actions.auto"), desc: t("options.auto.description") },
    {
      id: "detailed",
      title: t("studyGuide.format.detailed.title"),
      desc: t("studyGuide.format.detailed.desc"),
    },
    {
      id: "revision",
      title: t("studyGuide.format.revision.title"),
      desc: t("studyGuide.format.revision.desc"),
    },
  ] as const;

  const sectionCountLabel =
    sectionCount === 0
      ? t("actions.autoDecides")
      : t("studyGuide.sectionCount", { count: sectionCount });

  return (
    <div className="flex flex-col gap-5 font-sans text-text-tertiary">
      <BriefWizardHeader
        title={t("wizard.title", { kind: t("kinds.study_guide") })}
        step={step}
        totalSteps={2}
        onStepChange={setStep}
      />
      {step === 1 ? (
        <BriefStep>
          <BriefStepFields>
            <BriefChoiceField
              label={t("studyGuide.formatLabel")}
              options={formatOptions}
              value={format}
              onChange={(next) => updateStudyGuideOptions({ format: next })}
              columns={3}
            />

            <CountSelector
              label={t("studyGuide.sectionsLabel")}
              summary={sectionCountLabel}
              value={sectionCount}
              presets={SECTION_PRESETS}
              min={1}
              max={12}
              customDefault={10}
              customAriaLabel={t("studyGuide.customSectionAria")}
              onValueChange={(next) => updateStudyGuideOptions({ sectionCount: next })}
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
                emptyMessage={t("knowledge.emptySources", { kind: t("kinds.study_guide") })}
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
          submitLabel={submitLabel ?? t("actions.generateKind", { kind: t("kinds.study_guide") })}
          placeholder={t("studyGuide.instructionsPlaceholder")}
          textareaId="brief-study-guide"
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
