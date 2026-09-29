import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight } from "lucide-react";
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

// ============================================================================
// Module Constants
// ============================================================================

const CARD_PRESETS = [10, 15, 20] as const;

// ============================================================================
// Flashcard Brief Form Component
// ============================================================================

export function FlashcardBriefForm({
  notebookId,
  value,
  onChange,
  onSubmit,
  submitLabel,
  disabled = false,
}: BaseMaterialFormProps) {
  const { t } = useTranslation("generation");
  const { step, setStep, sources, hasSources, hasInstructions, canSubmit, patchFormData } =
    useBriefWizard({ notebookId, value, onChange, disabled, totalSteps: 3 });

  const cardStyle = value.cardStyle ?? "auto";
  const difficulty = value.difficulty ?? "auto";
  const cardCount = value.questionCount ?? 0;

  const formatOptions = [
    { id: "auto", title: t("actions.auto"), desc: t("options.auto.description") },
    { id: "qa", title: t("flashcards.cardStyle.qa.title"), desc: t("flashcards.cardStyle.qa.desc") },
    {
      id: "definition",
      title: t("flashcards.cardStyle.definition.title"),
      desc: t("flashcards.cardStyle.definition.desc"),
    },
    {
      id: "cloze",
      title: t("flashcards.cardStyle.cloze.title"),
      desc: t("flashcards.cardStyle.cloze.desc"),
    },
    {
      id: "mixed",
      title: t("flashcards.cardStyle.mixed.title"),
      desc: t("flashcards.cardStyle.mixed.desc"),
    },
  ] as const;

  const difficultyOptions = [
    { id: "auto", title: t("actions.auto"), desc: t("options.auto.description") },
    {
      id: "easy",
      title: t("flashcards.difficulty.easy.title"),
      desc: t("flashcards.difficulty.easy.desc"),
    },
    {
      id: "medium",
      title: t("flashcards.difficulty.medium.title"),
      desc: t("flashcards.difficulty.medium.desc"),
    },
    {
      id: "hard",
      title: t("flashcards.difficulty.hard.title"),
      desc: t("flashcards.difficulty.hard.desc"),
    },
  ] as const;

  const cardCountLabel =
    cardCount === 0
      ? t("actions.autoDecides")
      : cardCount >= 50
        ? t("flashcards.countMax", { count: cardCount, max: 50 })
        : t("flashcards.count", { count: cardCount });

  return (
    <div className="flex flex-col gap-5 font-sans text-text-tertiary">
      <BriefWizardHeader
        title={t("wizard.title", { kind: t("kinds.simple_flashcard") })}
        step={step}
        totalSteps={3}
        onStepChange={setStep}
      />
      {step === 1 ? (
        <BriefStep>
          <BriefStepFields>
            <BriefChoiceField
              label={t("flashcards.cardFormatLabel")}
              options={formatOptions}
              value={cardStyle}
              onChange={(next) => patchFormData({ cardStyle: next })}
              columns={3}
            />
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
            <BriefChoiceField
              label={t("flashcards.difficultyLabel")}
              options={difficultyOptions}
              value={difficulty}
              onChange={(next) => patchFormData({ difficulty: next })}
              columns={4}
            />

            <CountSelector
              label={t("flashcards.cardsLabel")}
              summary={cardCountLabel}
              value={cardCount}
              presets={CARD_PRESETS}
              min={1}
              max={50}
              customDefault={25}
              customAriaLabel={t("flashcards.customCountAria")}
              onValueChange={(next) => patchFormData({ questionCount: next })}
            />

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium text-text-primary">
                {t("fields.knowledgeSourcesStep4")}
                {!hasInstructions && <span className="text-destructive ml-0.5">*</span>}
              </Label>
              <GenerationSourcePopover
                sources={sources}
                selectedIds={value.sourceIds}
                onChange={(sourceIds) => patchFormData({ sourceIds })}
                emptyMessage={t("knowledge.emptySources", { kind: t("kinds.simple_flashcard") })}
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
          submitLabel={submitLabel ?? t("actions.generateKind", { kind: t("kinds.simple_flashcard") })}
          placeholder={t("flashcards.instructionsPlaceholder")}
          textareaId="brief-flashcards"
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
