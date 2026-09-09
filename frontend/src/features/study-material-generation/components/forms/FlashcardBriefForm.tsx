import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FolderPicker } from "@/features/notebooks";
import { sourcesQueryOptions } from "@/features/sources";
import { cn } from "@/shared/utils/cn";
import type { BaseMaterialFormProps, BriefFormData } from "./types";
import { CTA_BUTTON_CLASS, optionRowClass } from "./option-row";
import { GenerationSourcePopover } from "./generation-source-popover";

const CARD_COUNT_PRESETS = [10, 15, 20] as const;

const DIFFICULTIES = [
  { id: "easy", title: "Basic", description: "Simple definitions & recall" },
  { id: "medium", title: "Standard", description: "Conceptual understanding" },
  { id: "hard", title: "Advanced", description: "Deep analysis & application" },
] as const;

type DifficultyId = (typeof DIFFICULTIES)[number]["id"];

const CARD_STYLES = [
  { id: "qa", title: "Q & A", description: "Classic question → answer format" },
  { id: "definition", title: "Definition", description: "Term → definition pairs" },
  { id: "cloze", title: "Fill-in-the-Blank", description: "Sentence with missing word(s)" },
  {
    id: "mixed",
    title: "Mixed",
    description: "Combination of Q&A, Definitions, and Fill-in-the-Blank",
  },
] as const;

type CardStyleId = (typeof CARD_STYLES)[number]["id"];

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
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <Label className="text-sm font-medium text-text-primary">Cards</Label>
        <span className="text-xs font-medium text-primary">{cardLabel}</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {CARD_COUNT_PRESETS.map((cnt) => {
          const selected = cardCount === cnt && !isCustomMode;
          return (
            <button
              key={cnt}
              type="button"
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
              max={50}
              value={customVal}
              onChange={(e) => onCustomChange(e.target.value)}
              onBlur={onCustomBlur}
              placeholder="1-50"
              aria-label="1-50"
              className="w-full h-9 px-2 text-center text-sm font-semibold bg-surface-2 border border-primary text-text-primary rounded-2xl outline-none focus:ring-1 focus:ring-surface-border-strong shadow-2xs"
              autoFocus
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={onEnableCustom}
            className={cn(
              optionRowClass(false),
              "h-9 text-sm font-medium text-center flex items-center justify-center gap-1.5",
            )}
          >
            Custom
          </button>
        )}
      </div>
    </div>
  );
}

export function FlashcardBriefForm({
  notebookId,
  value,
  onChange,
  onSubmit,
  submitLabel = "Generate Flashcards",
  disabled = false,
}: BaseMaterialFormProps) {
  const [cardCount, setCardCount] = useState<number>(value.questionCount ?? 10);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customVal, setCustomVal] = useState("25");
  const [difficulty, setDifficulty] = useState<DifficultyId>(value.difficulty ?? "medium");
  const [cardStyle, setCardStyle] = useState<CardStyleId>(value.cardStyle ?? "qa");

  const { data: sources = [] } = useQuery(sourcesQueryOptions(notebookId));

  const hasSources = value.sourceIds.length > 0;
  const hasInstructions = value.brief.trim().length > 0;
  const canSubmit = !disabled && (hasSources || hasInstructions);

  const cardLabel = `${cardCount} ${
    cardCount === 1 ? "Card" : "Cards"
  }${cardCount >= 50 ? " (Max 50)" : ""}`;

  const update = (patch: Partial<BriefFormData>) => {
    onChange(patch);
  };

  const handleCustomChange = (raw: string) => {
    setCustomVal(raw);
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      const clamped = Math.min(50, Math.max(1, parsed));
      setCardCount(clamped);
      update({ questionCount: clamped });
    }
  };

  const handleCustomBlur = () => {
    let parsed = Number.parseInt(customVal, 10);
    if (Number.isNaN(parsed) || parsed < 1) parsed = 10;
    if (parsed > 50) parsed = 50;
    setCustomVal(String(parsed));
    setCardCount(parsed);
    update({ questionCount: parsed });
  };

  return (
    <div className="flex flex-col gap-4 font-sans text-text-tertiary animate-in fade-in duration-150">
      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium text-text-primary">Card Format</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CARD_STYLES.map((style) => {
            const selected = cardStyle === style.id;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => {
                  setCardStyle(style.id);
                  update({ cardStyle: style.id });
                }}
                className={cn(
                  optionRowClass(selected),
                  "h-9 text-xs text-center flex items-center justify-center gap-1.5",
                  selected ? "font-semibold" : "font-medium",
                )}
              >
                {style.title}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium text-text-primary">Difficulty</Label>
          <div className="flex gap-2">
            {DIFFICULTIES.map((d) => {
              const selected = difficulty === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    setDifficulty(d.id);
                    update({ difficulty: d.id });
                  }}
                  className={cn(
                    optionRowClass(selected),
                    "flex-1 h-9 text-xs cursor-pointer flex items-center justify-center gap-1",
                    selected ? "font-semibold" : "font-medium",
                  )}
                >
                  {d.title}
                </button>
              );
            })}
          </div>
        </div>

        <CardCountSelector
          cardLabel={cardLabel}
          cardCount={cardCount}
          isCustomMode={isCustomMode}
          customVal={customVal}
          onSelectPreset={(cnt) => {
            setIsCustomMode(false);
            setCardCount(cnt);
            update({ questionCount: cnt });
          }}
          onEnableCustom={() => {
            setIsCustomMode(true);
            const parsed = Number.parseInt(customVal, 10) || 25;
            const clamped = Math.min(50, Math.max(1, parsed));
            setCardCount(clamped);
            update({ questionCount: clamped });
          }}
          onCustomChange={handleCustomChange}
          onCustomBlur={handleCustomBlur}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="brief-flashcards" className="text-sm font-medium text-text-primary">
          Instructions{!hasSources && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        <Textarea
          id="brief-flashcards"
          value={value.brief}
          onChange={(e) => update({ brief: e.target.value })}
          placeholder="What topics should these flashcards cover?"
          className="min-h-[80px] max-h-[200px] text-xs resize-none break-all max-w-full overflow-x-hidden w-full"
          disabled={disabled}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium text-text-primary">
          Sources{!hasInstructions && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        <GenerationSourcePopover
          sources={sources}
          selectedIds={value.sourceIds}
          onChange={(sourceIds) => update({ sourceIds })}
          emptyMessage="No sources in notebook. Flashcards will generate using general knowledge."
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-medium text-text-tertiary">Folder</Label>
        <FolderPicker
          notebookId={notebookId}
          value={value.folderId}
          onChange={(folderId) => update({ folderId })}
          disabled={disabled}
        />
      </div>

      <Button
        type="button"
        className={cn(
          "w-full h-10 rounded-full font-medium text-sm gap-2 cursor-pointer transition-colors",
          CTA_BUTTON_CLASS,
        )}
        disabled={!canSubmit}
        onClick={onSubmit}
      >
        {submitLabel}
      </Button>
    </div>
  );
}
