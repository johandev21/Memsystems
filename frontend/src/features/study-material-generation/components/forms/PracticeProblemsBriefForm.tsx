import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FolderPicker } from "@/features/notebooks/components/studio/folder-picker";
import { sourcesQueryOptions } from "@/features/sources/api/sources";
import { cn } from "@/shared/utils/cn";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BriefWizardHeader } from "./brief-wizard-header";
import { GenerationSourcePopover } from "./generation-source-popover";
import { optionRowClass } from "./option-row";
import type { BaseMaterialFormProps, BriefFormData } from "./types";

const PROBLEM_PRESETS = [4, 6, 8, 12] as const;
const MAX_PROBLEMS = 30;

const DIFFICULTIES = [
  { id: "easy", titleKey: "practice.difficulty.easy.title", descKey: "practice.difficulty.easy.desc" },
  {
    id: "medium",
    titleKey: "practice.difficulty.medium.title",
    descKey: "practice.difficulty.medium.desc",
  },
  { id: "hard", titleKey: "practice.difficulty.hard.title", descKey: "practice.difficulty.hard.desc" },
] as const;

type DifficultyId = (typeof DIFFICULTIES)[number]["id"];

export function PracticeProblemsBriefForm({
  notebookId,
  value,
  onChange,
  onSubmit,
  submitLabel,
  disabled = false,
}: BaseMaterialFormProps) {
  const { t } = useTranslation("generation");
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

  const problemLabel =
    problemCount >= MAX_PROBLEMS
      ? t("practice.problemCountMax", { count: problemCount, max: MAX_PROBLEMS })
      : t("practice.problemCount", { count: problemCount });

  const update = (patch: Partial<BriefFormData>) => {
    onChange(patch);
  };

  const updatePracticeProblems = (patch: {
    problemCount?: number;
    difficulty?: DifficultyId;
  }) => {
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

  const handleCustomChange = (raw: string) => {
    setCustomVal(raw);
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed > 0) {
      const clamped = Math.min(MAX_PROBLEMS, Math.max(1, parsed));
      setProblemCount(clamped);
      updatePracticeProblems({ problemCount: clamped });
    }
  };

  const handleCustomBlur = () => {
    let parsed = parseInt(customVal, 10);
    if (isNaN(parsed) || parsed < 1) parsed = 8;
    if (parsed > MAX_PROBLEMS) parsed = MAX_PROBLEMS;
    setCustomVal(String(parsed));
    setProblemCount(parsed);
    updatePracticeProblems({ problemCount: parsed });
  };

  return (
    <div className="flex flex-col gap-5 font-sans text-text-tertiary">
      <BriefWizardHeader
        title={t("wizard.title", { kind: t("kinds.practice_problems") })}
        step={step}
        onStepChange={setStep}
      />

      {step === 1 ? (
        <div className="flex flex-col gap-5 min-h-95 justify-between animate-in fade-in slide-in-from-right-2 duration-150">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium text-text-primary">
                {t("fields.targetDifficulty")}
              </Label>
              <div className="grid grid-cols-3 gap-3">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={difficulty === d.id}
                    onClick={() => {
                      setDifficulty(d.id);
                      updatePracticeProblems({ difficulty: d.id });
                    }}
                    className={cn(
                      optionRowClass(difficulty === d.id),
                      "p-3 flex flex-col justify-between gap-1.5 text-left cursor-pointer",
                    )}
                  >
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        difficulty === d.id ? "text-primary-foreground" : "text-text-tertiary",
                      )}
                    >
                      {t(d.titleKey)}
                    </span>
                    <span
                      className={cn(
                        "text-sm leading-tight",
                        difficulty === d.id ? "text-primary-foreground/80" : "text-text-faint",
                      )}
                    >
                      {t(d.descKey)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-medium text-text-primary">
                  {t("practice.problemsLabel")}
                </Label>
                <span className="text-sm font-medium text-primary">{problemLabel}</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {PROBLEM_PRESETS.map((cnt) => {
                  const selected = problemCount === cnt && !isCustomMode;
                  return (
                    <button
                      key={cnt}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setIsCustomMode(false);
                        setProblemCount(cnt);
                        updatePracticeProblems({ problemCount: cnt });
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
                      aria-label="1-30"
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
                      const clamped = Math.min(MAX_PROBLEMS, Math.max(1, parsed));
                      setProblemCount(clamped);
                      updatePracticeProblems({ problemCount: clamped });
                    }}
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

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium text-text-primary">
                {t("fields.knowledgeSourcesStep3")}
                {!hasInstructions && <span className="text-destructive ml-0.5">*</span>}
              </Label>
              <GenerationSourcePopover
                sources={sources}
                selectedIds={value.sourceIds}
                onChange={(sourceIds) => update({ sourceIds })}
                emptyMessage={t("knowledge.emptySources", {
                  kind: t("kinds.practice_problems"),
                })}
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-transparent">
            <span className="text-xs text-text-faint">{t("wizard.nextHintInstructions")}</span>
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
      ) : (
        <div className="flex flex-col gap-5 min-h-95 justify-between animate-in fade-in slide-in-from-right-2 duration-150">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="brief-practice-problems"
                className="text-sm font-medium text-text-primary"
              >
                {t("fields.customInstructions")}
                {!hasSources && <span className="text-destructive ml-0.5">*</span>}
              </Label>
              <Textarea
                id="brief-practice-problems"
                value={value.brief}
                onChange={(e) => update({ brief: e.target.value })}
                placeholder={t("practice.instructionsPlaceholder")}
                className="min-h-30 max-h-50 text-sm resize-none break-all max-w-full overflow-x-hidden w-full"
                disabled={disabled}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-text-tertiary">
                {t("fields.destinationFolder")}
              </Label>
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
              {t("actions.back")}
            </Button>
            <Button
              variant="surface"
              type="button"
              className={cn(
                "h-10 px-6 rounded-full font-medium text-sm gap-2 cursor-pointer transition-colors",
              )}
              disabled={!canSubmit}
              onClick={onSubmit}
            >
              {submitLabel ?? t("actions.generateNow", { kind: t("kinds.practice_problems") })}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
