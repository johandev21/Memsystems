import { useRef, useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Search, BookOpen, Globe, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FolderPicker } from "@/features/notebooks";
import { sourcesQueryOptions } from "@/features/sources";
import { cn } from "@/shared/utils/cn";
import type { BaseMaterialFormProps, BriefFormData } from "./types";
import {
  CTA_BUTTON_CLASS,
  generationSourceCheckboxClass,
  generationSourceIconClass,
  generationSourceOptionClass,
  optionRowClass,
} from "./option-row";
import { GenerationSourcePopover } from "./generation-source-popover";

// ============================================================================
// Module Constants
// ============================================================================

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

// ============================================================================
// Flashcard Brief Form Component
// ============================================================================

export function FlashcardBriefForm({
  notebookId,
  value,
  onChange,
  onSubmit,
  submitLabel = "Generate Flashcards",
  disabled = false,
}: BaseMaterialFormProps) {
  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // State
  const [cardCount, setCardCount] = useState<number>(value.questionCount ?? 10);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customVal, setCustomVal] = useState("25");
  const [difficulty, setDifficulty] = useState<DifficultyId>(value.difficulty ?? "medium");
  const [cardStyle, setCardStyle] = useState<CardStyleId>(value.cardStyle ?? "qa");

  // Queries
  const { data: sources = [] } = useQuery(sourcesQueryOptions(notebookId));

  // Derived state: sources OR instructions required (at least one)
  const hasSources = value.sourceIds.length > 0;
  const hasInstructions = value.brief.trim().length > 0;
  const canSubmit = !disabled && (hasSources || hasInstructions);

  const cardLabel = `${cardCount} ${
    cardCount === 1 ? "Card" : "Cards"
  }${cardCount >= 50 ? " (Max 50)" : ""}`;

  // Handlers
  const update = (patch: Partial<BriefFormData>) => {
    onChange(patch);
  };

  // Sync internal state to parent brief form values
  useEffect(() => {
    update({ questionCount: cardCount, difficulty, cardStyle });
  }, [cardCount, difficulty, cardStyle]);

  const handleCustomChange = (raw: string) => {
    setCustomVal(raw);
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed > 0) {
      const clamped = Math.min(50, Math.max(1, parsed));
      setCardCount(clamped);
    }
  };

  const handleCustomBlur = () => {
    let parsed = parseInt(customVal, 10);
    if (isNaN(parsed) || parsed < 1) parsed = 10;
    if (parsed > 50) parsed = 50;
    setCustomVal(String(parsed));
    setCardCount(parsed);
  };

  return (
    <div className="flex flex-col gap-4 font-sans text-text-tertiary animate-in fade-in duration-150">
      {/* Card Style Toggle */}
      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium text-text-primary">Card Format</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CARD_STYLES.map((style) => {
            const selected = cardStyle === style.id;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => setCardStyle(style.id)}
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

      {/* Difficulty + Card Count in one row */}
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
                  onClick={() => setDifficulty(d.id)}
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
          }}
          onEnableCustom={() => {
            setIsCustomMode(true);
            const parsed = parseInt(customVal, 10) || 25;
            setCardCount(Math.min(50, Math.max(1, parsed)));
          }}
          onCustomChange={handleCustomChange}
          onCustomBlur={handleCustomBlur}
        />
      </div>

      {/* Instructions */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="brief-flashcards" className="text-sm font-medium text-text-primary">
          Instructions{!hasSources && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        <Textarea
          id="brief-flashcards"
          ref={textareaRef}
          value={value.brief}
          onChange={(e) => update({ brief: e.target.value })}
          placeholder="What topics should these flashcards cover?"
          className="min-h-[80px] max-h-[200px] text-xs resize-none break-all max-w-full overflow-x-hidden w-full"
          disabled={disabled}
        />
      </div>

      {/* Sources */}
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

      {/* Folder */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-medium text-text-tertiary">Folder</Label>
        <FolderPicker
          notebookId={notebookId}
          value={value.folderId}
          onChange={(folderId) => update({ folderId })}
          disabled={disabled}
        />
      </div>

      {/* Submit */}
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

// ============================================================================
// Flashcard Source Popover Component
// ============================================================================

export function FlashcardSourcePopover({
  sources,
  selectedIds,
  onChange,
}: {
  sources: Array<{ id: string; title: string; kind: string }>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = sources.filter((s) => s.title.toLowerCase().includes(search.toLowerCase()));

  const allSelected = filtered.length > 0 && filtered.every((s) => selectedIdSet.has(s.id));

  const toggleAll = () => {
    if (allSelected) {
      const filteredSet = new Set(filtered.map((s) => s.id));
      onChange(selectedIds.filter((id) => !filteredSet.has(id)));
    } else {
      const merged = new Set([...selectedIds, ...filtered.map((s) => s.id)]);
      onChange(Array.from(merged));
    }
  };

  const toggleOne = (id: string) => {
    if (selectedIdSet.has(id)) {
      onChange(selectedIds.filter((i) => i !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  function renderHeader() {
    return (
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-surface-2">
        <div className="flex items-center gap-2 flex-1">
          <Search className="size-4 text-text-faint shrink-0" />
          <input
            type="text"
            placeholder="Search sources..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-text-tertiary placeholder:text-text-faint outline-none w-full"
          />
        </div>
        <div className="flex items-center gap-2 pl-2">
          <span
            className="text-xs text-text-tertiary cursor-pointer select-none"
            onClick={toggleAll}
          >
            Select all
          </span>
          <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
        </div>
      </div>
    );
  }

  function renderSourceList() {
    if (sources.length === 0) {
      return (
        <div className="p-4 text-center text-xs text-text-faint">
          No sources in notebook. Flashcards will generate using general knowledge.
        </div>
      );
    }

    return (
      <div className="max-h-[220px] overflow-y-auto p-2 space-y-1">
        {filtered.map((src) => {
          const checked = selectedIdSet.has(src.id);
          return (
            <div
              key={src.id}
              onClick={() => toggleOne(src.id)}
              className={generationSourceOptionClass(checked)}
            >
              <div className="flex items-center gap-2 truncate pr-2">
                {src.kind === "web" ? (
                  <Globe className={generationSourceIconClass(checked)} />
                ) : src.kind === "file" ? (
                  <FileText className={generationSourceIconClass(checked)} />
                ) : (
                  <BookOpen className={generationSourceIconClass(checked)} />
                )}
                <span className="truncate">{src.title}</span>
              </div>
              <Checkbox
                checked={checked}
                onCheckedChange={() => toggleOne(src.id)}
                className={generationSourceCheckboxClass(checked)}
              />
            </div>
          );
        })}
      </div>
    );
  }

  function renderFooter() {
    return (
      <div className="p-2.5 bg-surface-2 flex justify-between items-center text-xs text-text-faint">
        <span>{selectedIds.length} selected</span>
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-2xl border border-surface-border-subtle bg-surface-2 text-text-tertiary hover:bg-surface-3 hover:text-text-secondary text-xs font-medium gap-2 px-3.5 justify-between w-full"
          >
            <div className="flex items-center gap-2 truncate">
              <BookOpen className="size-4 text-primary shrink-0" />
              <span className="truncate">
                {selectedIds.length === 0
                  ? "None selected (General Knowledge)"
                  : `${selectedIds.length} source${selectedIds.length !== 1 ? "s" : ""} selected`}
              </span>
            </div>
            <ChevronDown className="size-4 text-text-faint shrink-0" />
          </Button>
        }
      />
      <PopoverContent
        align="start"
        className="w-[320px] p-0 bg-surface-1 border-surface-border shadow-xl rounded-2xl overflow-hidden"
      >
        {renderHeader()}
        {renderSourceList()}
        {renderFooter()}
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Flashcard Model Popover Component
// ============================================================================

// ============================================================================
// Small Local Helper Components
// ============================================================================

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
