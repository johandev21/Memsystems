import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FolderPicker } from "@/features/notebooks";
import { sourcesQueryOptions } from "@/features/sources";
import { cn } from "@/shared/utils/cn";
import type { BaseMaterialFormProps, BriefFormData } from "./types";
import { CTA_BUTTON_CLASS } from "./option-row";
import { GenerationSourcePopover } from "./generation-source-popover";
import { optionRowClass } from "./option-row";

const PROBLEM_PRESETS = [4, 6, 8, 12] as const;
const MAX_PROBLEMS = 30;

const DIFFICULTIES = [
  { id: "easy", title: "Warmup", description: "Foundations & single steps" },
  { id: "medium", title: "Standard", description: "Balanced application" },
  { id: "hard", title: "Challenge", description: "Multi-step & transfer" },
] as const;

type DifficultyId = (typeof DIFFICULTIES)[number]["id"];

export function PracticeProblemsBriefForm({
  notebookId,
  value,
  onChange,
  onSubmit,
  submitLabel = "Generate Practice Problems Now",
  disabled = false,
}: BaseMaterialFormProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [problemCount, setProblemCount] = useState<number>(
    value.practiceProblemsOptions?.problemCount ?? value.questionCount ?? 8,
  );
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customVal, setCustomVal] = useState("16");
  const [difficulty, setDifficulty] = useState<DifficultyId>(
    value.practiceProblemsOptions?.difficulty ?? value.difficulty ?? "medium",
  );

  const { data: sources = [] } = useQuery(sourcesQueryOptions(notebookId));

  const hasSources = value.sourceIds.length > 0;
  const hasInstructions = value.brief.trim().length > 0;
  const canSubmit = !disabled && (hasSources || hasInstructions);

  const problemLabel = `${problemCount} ${problemCount === 1 ? "Problem" : "Problems"}${problemCount >= MAX_PROBLEMS ? " (Max 30)" : ""}`;

  const update = (patch: Partial<BriefFormData>) => {
    onChange(patch);
  };

  useEffect(() => {
    update({
      questionCount: problemCount,
      difficulty,
      practiceProblemsOptions: { problemCount, difficulty },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemCount, difficulty]);

  const handleCustomChange = (raw: string) => {
    setCustomVal(raw);
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setProblemCount(Math.min(MAX_PROBLEMS, Math.max(1, parsed)));
    }
  };

  const handleCustomBlur = () => {
    let parsed = parseInt(customVal, 10);
    if (isNaN(parsed) || parsed < 1) parsed = 8;
    if (parsed > MAX_PROBLEMS) parsed = MAX_PROBLEMS;
    setCustomVal(String(parsed));
    setProblemCount(parsed);
  };

  return (
    <div className="flex flex-col gap-5 font-sans text-text-tertiary">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 font-medium text-text-primary">
            <span className="text-sm font-semibold">Practice Problems Setup</span>
          </div>
          <Badge variant="outline" className="text-xs font-normal">
            Step {step} of 2
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div
            onClick={() => setStep(1)}
            className={cn(
              "h-1.5 rounded-full transition-all cursor-pointer",
              step >= 1 ? "bg-primary" : "bg-surface-4",
            )}
          />
          <div
            onClick={() => setStep(2)}
            className={cn(
              "h-1.5 rounded-full transition-all cursor-pointer",
              step === 2 ? "bg-primary" : "bg-surface-4",
            )}
          />
        </div>
      </div>

      {step === 1 ? (
        <div className="flex flex-col gap-5 min-h-[380px] justify-between animate-in fade-in slide-in-from-right-2 duration-150">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium text-text-primary">1. Target Difficulty</Label>
              <div className="grid grid-cols-3 gap-3">
                {DIFFICULTIES.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => setDifficulty(d.id)}
                    className={cn(
                      optionRowClass(difficulty === d.id),
                      "p-3 flex flex-col justify-between gap-1.5",
                    )}
                  >
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        difficulty === d.id ? "text-primary-foreground" : "text-text-tertiary",
                      )}
                    >
                      {d.title}
                    </span>
                    <span
                      className={cn(
                        "text-xs leading-tight",
                        difficulty === d.id ? "text-primary-foreground/80" : "text-text-faint",
                      )}
                    >
                      {d.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-medium text-text-primary">
                  2. Number of Problems
                </Label>
                <span className="text-xs font-medium text-primary">{problemLabel}</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {PROBLEM_PRESETS.map((cnt) => {
                  const selected = problemCount === cnt && !isCustomMode;
                  return (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => {
                        setIsCustomMode(false);
                        setProblemCount(cnt);
                      }}
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
                      max={MAX_PROBLEMS}
                      value={customVal}
                      onChange={(e) => handleCustomChange(e.target.value)}
                      onBlur={handleCustomBlur}
                      placeholder="1-30"
                      className="w-full h-9 px-2 text-center text-sm font-semibold bg-surface-2 border border-primary text-text-primary rounded-2xl outline-none focus:ring-1 focus:ring-surface-border-strong shadow-2xs"
                      autoFocus
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomMode(true);
                      const parsed = parseInt(customVal, 10) || 16;
                      setProblemCount(Math.min(MAX_PROBLEMS, Math.max(1, parsed)));
                    }}
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

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium text-text-primary">
                3. Knowledge Sources
                {!hasInstructions && <span className="text-destructive ml-0.5">*</span>}
              </Label>
              <GenerationSourcePopover
                sources={sources}
                selectedIds={value.sourceIds}
                onChange={(sourceIds) => update({ sourceIds })}
                emptyMessage="No sources in notebook. Problems will generate using general knowledge."
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
      ) : (
        <div className="flex flex-col gap-5 min-h-[380px] justify-between animate-in fade-in slide-in-from-right-2 duration-150">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="brief-practice-problems"
                className="text-sm font-medium text-text-primary"
              >
                Custom Instructions
                {!hasSources && <span className="text-destructive ml-0.5">*</span>}
              </Label>
              <Textarea
                id="brief-practice-problems"
                value={value.brief}
                onChange={(e) => update({ brief: e.target.value })}
                placeholder="Topics, skills, problem types (calculations, code reasoning, explanations)..."
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
      )}
    </div>
  );
}
