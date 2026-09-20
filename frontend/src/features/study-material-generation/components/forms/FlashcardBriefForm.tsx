import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/shared/utils/cn";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BriefChoiceField } from "./brief-choice-field";
import { BriefKnowledgeStep } from "./brief-knowledge-step";
import { BriefWizardHeader } from "./brief-wizard-header";
import { optionRowClass } from "./option-row";
import type { BaseMaterialFormProps } from "./types";
import { useBriefWizard } from "./use-brief-wizard";

// ============================================================================
// Module Constants
// ============================================================================

const CARD_COUNT_PRESETS = [10, 15, 20] as const;
const MAX_CARD_COUNT = 50;

const DIFFICULTIES = [
  {
    id: "easy",
    titleKey: "flashcards.difficulty.easy.title",
    descKey: "flashcards.difficulty.easy.desc",
  },
  {
    id: "medium",
    titleKey: "flashcards.difficulty.medium.title",
    descKey: "flashcards.difficulty.medium.desc",
  },
  {
    id: "hard",
    titleKey: "flashcards.difficulty.hard.title",
    descKey: "flashcards.difficulty.hard.desc",
  },
] as const;

type DifficultyId = (typeof DIFFICULTIES)[number]["id"];

const CARD_STYLES = [
  { id: "qa", titleKey: "flashcards.cardStyle.qa.title", descKey: "flashcards.cardStyle.qa.desc" },
  {
    id: "definition",
    titleKey: "flashcards.cardStyle.definition.title",
    descKey: "flashcards.cardStyle.definition.desc",
  },
  {
    id: "cloze",
    titleKey: "flashcards.cardStyle.cloze.title",
    descKey: "flashcards.cardStyle.cloze.desc",
  },
  {
    id: "mixed",
    titleKey: "flashcards.cardStyle.mixed.title",
    descKey: "flashcards.cardStyle.mixed.desc",
  },
] as const;

type CardStyleId = (typeof CARD_STYLES)[number]["id"];

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
    useBriefWizard({ notebookId, value, onChange, disabled });

  // State
  const [cardCount, setCardCount] = useState<number>(value.questionCount ?? 10);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customVal, setCustomVal] = useState("25");
  const [difficulty, setDifficulty] = useState<DifficultyId>(value.difficulty ?? "medium");
  const [cardStyle, setCardStyle] = useState<CardStyleId>(value.cardStyle ?? "qa");

  const cardLabel =
    cardCount >= MAX_CARD_COUNT
      ? t("flashcards.countMax", { count: cardCount, max: MAX_CARD_COUNT })
      : t("flashcards.count", { count: cardCount });

  const formatOptions = CARD_STYLES.map((style) => ({
    id: style.id,
    title: t(style.titleKey),
    desc: t(style.descKey),
  }));

  // Handlers
  const handleCustomChange = (raw: string) => {
    setCustomVal(raw);
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      const clamped = Math.min(MAX_CARD_COUNT, Math.max(1, parsed));
      setCardCount(clamped);
      patchFormData({ questionCount: clamped });
    }
  };

  const handleCustomBlur = () => {
    let parsed = Number.parseInt(customVal, 10);
    if (Number.isNaN(parsed) || parsed < 1) parsed = 10;
    if (parsed > MAX_CARD_COUNT) parsed = MAX_CARD_COUNT;
    setCustomVal(String(parsed));
    setCardCount(parsed);
    patchFormData({ questionCount: parsed });
  };

  // Section Render Helpers
  function renderStepOne() {
    return (
      <div className="flex flex-col gap-5 min-h-95 justify-between animate-in fade-in slide-in-from-right-2 duration-150">
        <div className="flex flex-col gap-5">
          <BriefChoiceField
            label={t("flashcards.cardFormatLabel")}
            options={formatOptions}
            value={cardStyle}
            onChange={(id) => {
              setCardStyle(id);
              patchFormData({ cardStyle: id });
            }}
          />

          <DifficultySelector
            value={difficulty}
            onChange={(val) => {
              setDifficulty(val);
              patchFormData({ difficulty: val });
            }}
          />

          <CardCountSelector
            cardLabel={cardLabel}
            cardCount={cardCount}
            isCustomMode={isCustomMode}
            customVal={customVal}
            onSelectPreset={(cnt) => {
              setIsCustomMode(false);
              setCardCount(cnt);
              patchFormData({ questionCount: cnt });
            }}
            onEnableCustom={() => {
              setIsCustomMode(true);
              const parsed = Number.parseInt(customVal, 10) || 25;
              const clamped = Math.min(MAX_CARD_COUNT, Math.max(1, parsed));
              setCardCount(clamped);
              patchFormData({ questionCount: clamped });
            }}
            onCustomChange={handleCustomChange}
            onCustomBlur={handleCustomBlur}
          />
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-transparent">
          <span className="text-xs text-text-faint">{t("wizard.nextHintKnowledge")}</span>
          <Button
            variant="surface"
            type="button"
            onClick={() => setStep(2)}
            className={cn(
              "h-9 px-5 rounded-full text-sm font-medium gap-1.5 cursor-pointer transition-colors",
            )}
          >
            {t("actions.nextStep")}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 font-sans text-text-tertiary">
      <BriefWizardHeader
        title={t("wizard.title", { kind: t("kinds.simple_flashcard") })}
        step={step}
        onStepChange={setStep}
      />
      {step === 1 ? (
        renderStepOne()
      ) : (
        <BriefKnowledgeStep
          notebookId={notebookId}
          value={value}
          sources={sources}
          hasSources={hasSources}
          hasInstructions={hasInstructions}
          canSubmit={canSubmit}
          submitLabel={submitLabel ?? t("actions.generateKind", { kind: t("kinds.simple_flashcard") })}
          disabled={disabled}
          placeholder={t("flashcards.instructionsPlaceholder")}
          textareaId="brief-flashcards"
          emptySourcesMessage={t("knowledge.emptySources", { kind: t("kinds.simple_flashcard") })}
          onPatch={patchFormData}
          onBack={() => setStep(1)}
          onSubmit={onSubmit}
        />
      )}
    </div>
  );
}

function DifficultySelector({
  value,
  onChange,
}: {
  value: DifficultyId;
  onChange: (val: DifficultyId) => void;
}) {
  const { t } = useTranslation("generation");

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium text-text-primary">
        {t("flashcards.difficultyLabel")}
      </Label>
      <div className="grid grid-cols-3 gap-3">
        {DIFFICULTIES.map((d) => (
          <button
            key={d.id}
            type="button"
            aria-pressed={value === d.id}
            onClick={() => onChange(d.id)}
            className={cn(
              optionRowClass(value === d.id),
              "p-3 flex flex-col justify-between gap-1.5 text-left cursor-pointer",
            )}
          >
            <span
              className={cn(
                "text-sm font-semibold",
                value === d.id ? "text-primary-foreground" : "text-text-tertiary",
              )}
            >
              {t(d.titleKey)}
            </span>
            <span
              className={cn(
                "text-sm leading-tight",
                value === d.id ? "text-primary-foreground/80" : "text-text-faint",
              )}
            >
              {t(d.descKey)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CardCountSelector({
  cardLabel,
  cardCount,
  isCustomMode,
  customVal,
  onSelectPreset,
  onEnableCustom,
  onCustomChange,
  onCustomBlur,
}: {
  cardLabel: string;
  cardCount: number;
  isCustomMode: boolean;
  customVal: string;
  onSelectPreset: (count: number) => void;
  onEnableCustom: () => void;
  onCustomChange: (raw: string) => void;
  onCustomBlur: () => void;
}) {
  const { t } = useTranslation("generation");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <Label className="text-sm font-medium text-text-primary">
          {t("flashcards.cardsLabel")}
        </Label>
        <span className="text-sm font-medium text-primary">{cardLabel}</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {CARD_COUNT_PRESETS.map((cnt) => {
          const selected = cardCount === cnt && !isCustomMode;
          return (
            <button
              key={cnt}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelectPreset(cnt)}
              className={cn(
                optionRowClass(selected),
                "h-9 text-sm text-center flex items-center justify-center gap-1.5",
                selected ? "font-semibold" : "font-medium",
              )}
            >
              {cnt}
            </button>
          );
        })}

        {isCustomMode ? (
          <div className="relative flex items-center h-9">
            <input
              type="number"
              min={1}
              max={MAX_CARD_COUNT}
              value={customVal}
              onChange={(e) => onCustomChange(e.target.value)}
              onBlur={onCustomBlur}
              placeholder="1-50"
              aria-label={t("flashcards.customCountAria")}
              className="w-full h-9 px-2 text-center text-sm font-semibold bg-surface-2 border border-primary text-text-primary rounded-2xl outline-none focus:ring-1 focus:ring-surface-border-strong shadow-2xs"
              autoFocus
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={onEnableCustom}
            aria-pressed={false}
            className={cn(
              optionRowClass(false),
              "h-9 text-sm font-medium text-center flex items-center justify-center gap-1.5",
            )}
          >
            {t("actions.custom")}
          </button>
        )}
      </div>
    </div>
  );
}
