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

const QUESTION_PRESETS = [5, 10, 15] as const;

// ============================================================================
// Quiz Brief Form Component
// ============================================================================

export function QuizBriefForm({
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

  const difficulty = value.difficulty ?? "auto";
  const questionCount = value.questionCount ?? 0;

  const difficultyOptions = [
    { id: "auto", title: t("actions.auto"), desc: t("options.auto.description") },
    { id: "easy", title: t("quiz.difficulty.easy.title"), desc: t("quiz.difficulty.easy.desc") },
    {
      id: "medium",
      title: t("quiz.difficulty.medium.title"),
      desc: t("quiz.difficulty.medium.desc"),
    },
    { id: "hard", title: t("quiz.difficulty.hard.title"), desc: t("quiz.difficulty.hard.desc") },
  ] as const;

  const questionCountLabel =
    questionCount === 0
      ? t("actions.autoDecides")
      : questionCount >= 50
        ? t("quiz.questionCountMax", { count: questionCount, max: 50 })
        : t("quiz.questionCount", { count: questionCount });

  return (
    <div className="flex flex-col gap-5 font-sans text-text-tertiary">
      <BriefWizardHeader
        title={t("wizard.title", { kind: t("kinds.quiz") })}
        step={step}
        totalSteps={2}
        onStepChange={setStep}
      />
      {step === 1 ? (
        <BriefStep>
          <BriefStepFields>
            <BriefChoiceField
              label={t("fields.targetDifficulty")}
              options={difficultyOptions}
              value={difficulty}
              onChange={(next) => patchFormData({ difficulty: next })}
              columns={4}
            />

            <CountSelector
              label={t("quiz.questionsLabel")}
              summary={questionCountLabel}
              value={questionCount}
              presets={QUESTION_PRESETS}
              min={1}
              max={50}
              customDefault={25}
              customAriaLabel={t("quiz.customQuestionAria")}
              presetLabel={(count) => t("quiz.questionPreset", { count })}
              onValueChange={(next) => patchFormData({ questionCount: next })}
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
                emptyMessage={t("knowledge.emptySources", { kind: t("kinds.quiz") })}
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
          submitLabel={submitLabel ?? t("actions.generateNow", { kind: t("kinds.quiz") })}
          placeholder={t("quiz.instructionsPlaceholder")}
          textareaId="brief-quiz"
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
