import { useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  Search,
  Cpu,
  BookOpen,
  Globe,
  FileText,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Checkbox } from "@/shared/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Badge } from "@/shared/ui/badge";
import { FolderPicker } from "@/features/notebooks";
import type { ModelOption } from "@/shared/api/models";
import { sourcesQueryOptions } from "@/shared/api/sources";
import { cn } from "@/shared/lib/utils";
import type { BaseMaterialFormProps, BriefFormData } from "./types";
import { CTA_BUTTON_CLASS, optionRowClass } from "./option-row";

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
  models,
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
    onChange({ ...value, ...patch });
  };

  // Sync internal state to parent brief form values
  useEffect(() => {
    update({ questionCount, difficulty });
  }, [questionCount, difficulty]);

  const handleCustomChange = (raw: string) => {
    setCustomVal(raw);
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed > 0) {
      const clamped = Math.min(50, Math.max(1, parsed));
      setQuestionCount(clamped);
    }
  };

  const handleCustomBlur = () => {
    let parsed = parseInt(customVal, 10);
    if (isNaN(parsed) || parsed < 1) parsed = 10;
    if (parsed > 50) parsed = 50;
    setCustomVal(String(parsed));
    setQuestionCount(parsed);
  };

  // Section Render Helpers
  function renderStepOne() {
    return (
      <div className="flex flex-col gap-5 min-h-[380px] justify-between animate-in fade-in slide-in-from-right-2 duration-150">
        <div className="flex flex-col gap-5">
          <DifficultySelector value={difficulty} onChange={setDifficulty} />

          <QuestionSelector
            questionLabel={questionLabel}
            questionCount={questionCount}
            isCustomMode={isCustomMode}
            customVal={customVal}
            onSelectPreset={(cnt) => {
              setIsCustomMode(false);
              setQuestionCount(cnt);
            }}
            onEnableCustom={() => {
              setIsCustomMode(true);
              const parsed = parseInt(customVal, 10) || 25;
              setQuestionCount(Math.min(50, Math.max(1, parsed)));
            }}
            onCustomChange={handleCustomChange}
            onCustomBlur={handleCustomBlur}
          />

          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium text-text-primary">
              3. Knowledge Sources
              {!hasInstructions && <span className="text-destructive ml-0.5">*</span>}
            </Label>
            <QuizSourcePopover
              sources={sources}
              selectedIds={value.sourceIds}
              onChange={(sourceIds) => update({ sourceIds })}
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

          <div className="grid grid-cols-2 gap-4 items-center">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-text-tertiary">
                Destination Folder
              </Label>
              <FolderPicker
                notebookId={notebookId}
                value={value.folderId}
                onChange={(folderId) => update({ folderId })}
                disabled={disabled}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-text-tertiary">
                AI Intelligence Model
              </Label>
              <QuizModelPopover
                models={models}
                selectedModel={value.model}
                onModelChange={(model) => update({ model })}
                disabled={disabled}
              />
            </div>
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
      <WizardHeader step={step} onStepChange={setStep} />
      {step === 1 ? renderStepOne() : renderStepTwo()}
    </div>
  );
}

// ============================================================================
// Quiz Source Popover Component
// ============================================================================

function QuizSourcePopover({
  sources,
  selectedIds,
  onChange,
}: {
  sources: Array<{ id: string; title: string; kind: string }>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = sources.filter((s) => s.title.toLowerCase().includes(search.toLowerCase()));

  const allSelected = filtered.length > 0 && filtered.every((s) => selectedIds.includes(s.id));

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
    if (selectedIds.includes(id)) {
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
          No sources in notebook. Quiz will generate using general knowledge.
        </div>
      );
    }

    return (
      <div className="max-h-[220px] overflow-y-auto p-2 space-y-1">
        {filtered.map((src) => {
          const checked = selectedIds.includes(src.id);
          return (
            <div
              key={src.id}
              onClick={() => toggleOne(src.id)}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors",
                checked
                  ? "bg-surface-3 text-text-secondary font-medium"
                  : "hover:bg-surface-2 text-text-tertiary",
              )}
            >
              <div className="flex items-center gap-2 truncate pr-2">
                {src.kind === "web" ? (
                  <Globe className="size-4 text-primary shrink-0" />
                ) : src.kind === "file" ? (
                  <FileText className="size-4 text-primary shrink-0" />
                ) : (
                  <BookOpen className="size-4 text-primary shrink-0" />
                )}
                <span className="truncate">{src.title}</span>
              </div>
              <Checkbox checked={checked} onCheckedChange={() => toggleOne(src.id)} />
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
// Quiz Model Popover Component
// ============================================================================

export function QuizModelPopover({
  models,
  selectedModel,
  onModelChange,
  disabled,
}: {
  models: ModelOption[];
  selectedModel: string;
  onModelChange: (model: string) => void;
  disabled?: boolean;
}) {
  const selected = models.find((m) => m.id === selectedModel) ?? models[0];

  function renderModelRow(m: ModelOption) {
    const isSelected = m.id === selectedModel;
    return (
      <div
        key={m.id}
        onClick={() => onModelChange(m.id)}
        className={cn(
          "flex items-center justify-between p-2.5 rounded-xl text-xs cursor-pointer transition-colors",
          isSelected
            ? "bg-surface-3 text-text-secondary font-semibold"
            : "hover:bg-surface-2 text-text-tertiary",
        )}
      >
        <div className="flex flex-col min-w-0">
          <span className="truncate">{m.displayName}</span>
          <span className="text-xs text-text-faint font-normal">{m.id}</span>
        </div>
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
            disabled={disabled}
            className="h-9 rounded-2xl border border-surface-border-subtle bg-surface-2 text-text-tertiary hover:bg-surface-3 hover:text-text-secondary text-xs font-medium gap-2 px-3.5 justify-between w-full"
          >
            <div className="flex items-center gap-2 truncate">
              <Cpu className="size-4 text-primary shrink-0" />
              <span className="truncate">
                {selected?.displayName || selectedModel || "Select Model"}
              </span>
            </div>
            <ChevronDown className="size-4 text-text-faint shrink-0" />
          </Button>
        }
      />
      <PopoverContent
        align="end"
        className="w-[280px] p-2 bg-surface-1 border-surface-border shadow-xl rounded-2xl"
      >
        <div className="px-2 py-1 text-xs font-medium text-text-faint">Select Model</div>
        <div className="space-y-1 mt-1">{models.map(renderModelRow)}</div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Small Local Helper Components
// ============================================================================

function WizardHeader({
  step,
  onStepChange,
}: {
  step: 1 | 2;
  onStepChange: (step: 1 | 2) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 font-medium text-text-primary">
          <span className="text-sm font-semibold">Quiz Setup</span>
        </div>
        <Badge variant="outline" className="text-xs font-normal">
          Step {step} of 2
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div
          onClick={() => onStepChange(1)}
          className={cn(
            "h-1.5 rounded-full transition-all cursor-pointer",
            step >= 1 ? "bg-primary" : "bg-surface-4",
          )}
        />
        <div
          onClick={() => onStepChange(2)}
          className={cn(
            "h-1.5 rounded-full transition-all cursor-pointer",
            step === 2 ? "bg-primary" : "bg-surface-4",
          )}
        />
      </div>
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
          <div
            key={d.id}
            onClick={() => onChange(d.id)}
            className={cn(
              optionRowClass(value === d.id),
              "p-3 flex flex-col justify-between gap-1.5",
            )}
          >
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "text-sm font-semibold",
                  value === d.id ? "text-text-secondary" : "text-text-tertiary",
                )}
              >
                {d.title}
              </span>
            </div>
            <span className="text-xs text-text-faint leading-tight">{d.description}</span>
          </div>
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
