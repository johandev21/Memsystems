import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BriefChoiceField } from "./brief-choice-field";
import { BriefInstructionsStep } from "./brief-instructions-step";
import {
  BriefBackButton,
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

const QUESTION_PRESETS = [2, 4, 6] as const;
const MAX_QUESTIONS = 10;

const PERSPECTIVE_OPTIONS = [
  { id: "auto", titleKey: "actions.auto", descKey: "options.auto.description" },
  {
    id: "single",
    titleKey: "caseStudy.perspective.single.title",
    descKey: "caseStudy.perspective.single.desc",
  },
  {
    id: "compare",
    titleKey: "caseStudy.perspective.compare.title",
    descKey: "caseStudy.perspective.compare.desc",
  },
] as const;

type PerspectiveId = (typeof PERSPECTIVE_OPTIONS)[number]["id"];

export function CaseStudyBriefForm({
  notebookId,
  value,
  onChange,
  onSubmit,
  submitLabel,
  disabled = false,
}: BaseMaterialFormProps) {
  const { t } = useTranslation("generation");
  const { step, setStep, sources, hasSources, patchFormData } = useBriefWizard({
    notebookId,
    value,
    onChange,
    disabled,
    totalSteps: 3,
  });

  const questionCount = value.caseStudyOptions?.questionCount ?? value.questionCount ?? 0;
  const comparePerspectives = value.caseStudyOptions?.comparePerspectives ?? "auto";
  const [focus, setFocus] = useState(value.caseStudyOptions?.focus ?? "");

  const hasInstructions = value.brief.trim().length > 0 || focus.trim().length > 0;
  const canSubmit = !disabled && (hasSources || hasInstructions);

  const updateCaseStudyOptions = (patch: {
    questionCount?: number;
    comparePerspectives?: PerspectiveId;
    focus?: string;
  }) => {
    const nextCount = patch.questionCount ?? questionCount;
    const nextCompare = patch.comparePerspectives ?? comparePerspectives;
    const nextFocus = patch.focus ?? focus;
    onChange({
      questionCount: nextCount,
      caseStudyOptions: {
        questionCount: nextCount,
        focus: nextFocus,
        comparePerspectives: nextCompare,
      },
    });
  };

  const perspectiveOptions = PERSPECTIVE_OPTIONS.map((option) => ({
    id: option.id,
    title: t(option.titleKey),
    desc: t(option.descKey),
  }));

  const questionLabel =
    questionCount === 0
      ? t("actions.autoDecides")
      : t("caseStudy.questionCount", { count: questionCount });

  return (
    <div className="flex flex-col gap-5 font-sans text-text-tertiary">
      <BriefWizardHeader
        title={t("wizard.title", { kind: t("kinds.case_study") })}
        step={step}
        totalSteps={3}
        onStepChange={setStep}
      />

      {step === 1 ? (
        <BriefStep>
          <BriefStepFields>
            <CountSelector
              label={t("caseStudy.discussionQuestionsLabel")}
              summary={questionLabel}
              value={questionCount}
              presets={QUESTION_PRESETS}
              min={1}
              max={MAX_QUESTIONS}
              customDefault={5}
              customAriaLabel={t("caseStudy.customQuestionAria")}
              onValueChange={(next) => updateCaseStudyOptions({ questionCount: next })}
            />

            <BriefChoiceField
              label={t("caseStudy.perspectiveLabel")}
              options={perspectiveOptions}
              value={comparePerspectives}
              columns={3}
              onChange={(next) => updateCaseStudyOptions({ comparePerspectives: next })}
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
                emptyMessage={t("knowledge.emptySources", { kind: t("kinds.case_study") })}
              />
            </div>
          </BriefStepFields>

          <BriefStepFooter>
            <BriefStepHint>{t("wizard.nextHintOptions")}</BriefStepHint>
            <BriefNextButton onClick={() => setStep(2)}>
              {t("actions.nextStep")}
              <ArrowRight className="size-4" />
            </BriefNextButton>
          </BriefStepFooter>
        </BriefStep>
      ) : step === 2 ? (
        <BriefStep>
          <BriefStepFields>
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="brief-case-study-focus"
                className="text-sm font-medium text-text-primary"
              >
                {t("caseStudy.conceptsToApplyLabel")}
              </Label>
              <Textarea
                id="brief-case-study-focus"
                value={focus}
                onChange={(event) => {
                  setFocus(event.target.value);
                  updateCaseStudyOptions({ focus: event.target.value });
                }}
                placeholder={t("caseStudy.conceptsPlaceholder")}
                className="min-h-40 max-h-60 text-sm resize-none break-all max-w-full overflow-x-hidden w-full"
                disabled={disabled}
              />
            </div>
          </BriefStepFields>

          <BriefStepFooter>
            <BriefBackButton onClick={() => setStep(1)}>
              <ArrowLeft className="size-4" />
              {t("actions.back")}
            </BriefBackButton>
            <BriefStepHint>{t("wizard.nextHintInstructions")}</BriefStepHint>
            <BriefNextButton onClick={() => setStep(3)}>
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
          submitLabel={submitLabel ?? t("actions.generateKind", { kind: t("kinds.case_study") })}
          placeholder={t("caseStudy.instructionsPlaceholder")}
          textareaId="brief-case-study"
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
