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

const PROBLEM_PRESETS = [4, 6, 8] as const;
const MAX_PROBLEMS = 30;

const DIFFICULTY_OPTIONS = [
  { id: "auto", titleKey: "actions.auto", descKey: "options.auto.description" },
  {
    id: "easy",
    titleKey: "practice.difficulty.easy.title",
    descKey: "practice.difficulty.easy.desc",
  },
  {
    id: "medium",
    titleKey: "practice.difficulty.medium.title",
    descKey: "practice.difficulty.medium.desc",
  },
  {
    id: "hard",
    titleKey: "practice.difficulty.hard.title",
    descKey: "practice.difficulty.hard.desc",
  },
] as const;

type DifficultyId = (typeof DIFFICULTY_OPTIONS)[number]["id"];

export function PracticeProblemsBriefForm({
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

  const problemCount = value.practiceProblemsOptions?.problemCount ?? value.questionCount ?? 0;
  const difficulty = value.practiceProblemsOptions?.difficulty ?? value.difficulty ?? "auto";

  const updatePracticeProblems = (patch: { problemCount?: number; difficulty?: DifficultyId }) => {
    const nextCount = patch.problemCount ?? problemCount;
    const nextDiff = patch.difficulty ?? difficulty;
    onChange({
      questionCount: nextCount,
      difficulty: nextDiff,
      practiceProblemsOptions: {
        problemCount: nextCount,
        difficulty: nextDiff,
      },
    });
  };

  const difficultyOptions = DIFFICULTY_OPTIONS.map((option) => ({
    id: option.id,
    title: t(option.titleKey),
    desc: t(option.descKey),
  }));

  const problemLabel =
    problemCount === 0
      ? t("actions.autoDecides")
      : problemCount >= MAX_PROBLEMS
        ? t("practice.problemCountMax", { count: problemCount, max: MAX_PROBLEMS })
        : t("practice.problemCount", { count: problemCount });

  return (
    <div className="flex flex-col gap-5 font-sans text-text-tertiary">
      <BriefWizardHeader
        title={t("wizard.title", { kind: t("kinds.practice_problems") })}
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
              columns={4}
              onChange={(next) => updatePracticeProblems({ difficulty: next })}
            />

            <CountSelector
              label={t("practice.problemsLabel")}
              summary={problemLabel}
              value={problemCount}
              presets={PROBLEM_PRESETS}
              min={1}
              max={MAX_PROBLEMS}
              customDefault={16}
              customAriaLabel={t("practice.customProblemAria")}
              onValueChange={(next) => updatePracticeProblems({ problemCount: next })}
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
                emptyMessage={t("knowledge.emptySources", { kind: t("kinds.practice_problems") })}
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
          submitLabel={
            submitLabel ?? t("actions.generateNow", { kind: t("kinds.practice_problems") })
          }
          placeholder={t("practice.instructionsPlaceholder")}
          textareaId="brief-practice-problems"
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
