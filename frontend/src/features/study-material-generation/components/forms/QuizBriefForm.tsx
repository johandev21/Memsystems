import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FolderPicker } from "@/features/notebooks";
import { sourcesQueryOptions } from "@/features/sources";
import { cn } from "@/shared/utils/cn";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRef, useState } from "react";
import { BriefWizardHeader } from "./brief-wizard-header";
import { GenerationSourcePopover } from "./generation-source-popover";
import { CTA_BUTTON_CLASS, optionRowClass } from "./option-row";
import type { BaseMaterialFormProps, BriefFormData } from "./types";

// ============================================================================
// Module Constants
// ============================================================================

const QUESTION_PRESETS = [5, 10, 15, 20] as const;

const DIFFICULTIES = [
  { id: "easy", title: "Warmup", description: "Basic recall & definitions" },
  { id: "medium", title: "Standard", description: "Balanced application" },
  { id: "hard", title: "Challenge", description: "Deep reasoning & edge cases" },
] as const;

type DifficultyId = (typeof DIFFICULTIES)[number]["id"];

// ============================================================================
// Quiz Brief Form Component
// ============================================================================

export function QuizBriefForm({
  notebookId,
  value,
  onChange,
  onSubmit,
  submitLabel = "Generate Quiz Now",
  disabled = false,
}: BaseMaterialFormProps) {
  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // State
  const [step, setStep] = useState<1 | 2>(1);
  const [questionCount, setQuestionCount] = useState<number>(value.questionCount ?? 10);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customVal, setCustomVal] = useState("25");
  const [difficulty, setDifficulty] = useState<DifficultyId>(value.difficulty ?? "medium");

  // Queries
  const { data: sources = [] } = useQuery(sourcesQueryOptions(notebookId));

  // Derived state: sources OR instructions required (at least one)
  const hasSources = value.sourceIds.length > 0;
  const hasInstructions = value.brief.trim().length > 0;
  const canSubmit = !disabled && (hasSources || hasInstructions);

  const questionLabel = `${questionCount} ${
    questionCount === 1 ? "Question" : "Questions"
  }${questionCount >= 50 ? " (Max 50)" : ""}`;

  // Handlers
  const update = (patch: Partial<BriefFormData>) => {
    onChange(patch);
  };

  const handleCustomChange = (raw: string) => {
    setCustomVal(raw);
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed > 0) {
      const clamped = Math.min(50, Math.max(1, parsed));
      setQuestionCount(clamped);
      update({ questionCount: clamped });
    }
  };

  const handleCustomBlur = () => {
    let parsed = parseInt(customVal, 10);
    if (isNaN(parsed) || parsed < 1) parsed = 10;
    if (parsed > 50) parsed = 50;
    setCustomVal(String(parsed));
    setQuestionCount(parsed);
    update({ questionCount: parsed });
  };

  // Section Render Helpers
  function renderStepOne() {
    return (
      <div className="flex flex-col gap-5 min-h-[380px] justify-between animate-in fade-in slide-in-from-right-2 duration-150">
        <div className="flex flex-col gap-5">
          <DifficultySelector
            value={difficulty}
            onChange={(val) => {
              setDifficulty(val);
              update({ difficulty: val });
            }}
          />

          <QuestionSelector
            questionLabel={questionLabel}
            questionCount={questionCount}
            isCustomMode={isCustomMode}
            customVal={customVal}
            onSelectPreset={(cnt) => {
              setIsCustomMode(false);
              setQuestionCount(cnt);
              update({ questionCount: cnt });
            }}
            onEnableCustom={() => {
              setIsCustomMode(true);
              const parsed = parseInt(customVal, 10) || 25;
              const clamped = Math.min(50, Math.max(1, parsed));
              setQuestionCount(clamped);
              update({ questionCount: clamped });
            }}
            onCustomChange={handleCustomChange}
            onCustomBlur={handleCustomBlur}
          />

          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium text-text-primary">
              3. Knowledge Sources
              {!hasInstructions && <span className="text-destructive ml-0.5">*</span>}
            </Label>
            <GenerationSourcePopover
              sources={sources}
              selectedIds={value.sourceIds}
              onChange={(sourceIds) => update({ sourceIds })}
              emptyMessage="No sources in notebook. Quiz will generate using general knowledge."
            />
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-transparent">
          <span className="text-xs text-text-faint">Configure custom instructions next</span>
          <Button
            type="button"
            onClick={() => setStep(2)}
            className={cn(
              "h-9 px-5 rounded-full text-sm font-medium gap-1.5 cursor-pointer transition-colors",
              CTA_BUTTON_CLASS,
            )}
          >
            Next Step
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  function renderStepTwo() {
    return (
      <div className="flex flex-col gap-5 min-h-[380px] justify-between animate-in fade-in slide-in-from-right-2 duration-150">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="brief-quiz" className="text-sm font-medium text-text-primary">
              Custom Instructions{!hasSources && <span className="text-destructive ml-0.5">*</span>}
            </Label>
            <Textarea
              id="brief-quiz"
              ref={textareaRef}
              value={value.brief}
              onChange={(e) => update({ brief: e.target.value })}
              placeholder="Provide specific focus areas, topics, or instructions for this quiz..."
              className="min-h-[120px] max-h-[200px] text-xs resize-none break-all max-w-full overflow-x-hidden w-full"
              disabled={disabled}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-text-tertiary">Destination Folder</Label>
            <FolderPicker
              notebookId={notebookId}
              value={value.folderId}
              onChange={(folderId) => update({ folderId })}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-transparent">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep(1)}
            className="h-9 px-4 text-sm text-text-faint hover:text-text-secondary gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>

          <Button
            type="button"
            className={cn(
              "h-10 px-6 rounded-full font-medium text-sm gap-2 cursor-pointer transition-colors",
              CTA_BUTTON_CLASS,
            )}
            disabled={!canSubmit}
            onClick={onSubmit}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 font-sans text-text-tertiary">
      <BriefWizardHeader title="Quiz Setup" step={step} onStepChange={setStep} />
      {step === 1 ? renderStepOne() : renderStepTwo()}
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
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium text-text-primary">1. Target Difficulty</Label>
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
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "text-sm font-semibold",
                  value === d.id ? "text-primary-foreground" : "text-text-tertiary",
                )}
              >
                {d.title}
              </span>
            </div>
            <span
              className={cn(
                "text-xs leading-tight",
                value === d.id ? "text-primary-foreground/80" : "text-text-faint",
              )}
            >
              {d.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function QuestionSelector({
  questionLabel,
  questionCount,
  isCustomMode,
  customVal,
  onSelectPreset,
  onEnableCustom,
  onCustomChange,
  onCustomBlur,
}: {
  questionLabel: string;
  questionCount: number;
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
        <Label className="text-sm font-medium text-text-primary">2. Number of Questions</Label>
        <span className="text-xs font-medium text-primary">{questionLabel}</span>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {QUESTION_PRESETS.map((cnt) => {
          const selected = questionCount === cnt && !isCustomMode;
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
              {cnt} Qs
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
