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

const QUESTION_PRESETS = [2, 4, 6, 8] as const;
const MAX_QUESTIONS = 10;

const PERSPECTIVE_OPTIONS = [
  {
    id: false,
    titleKey: "caseStudy.perspective.single.title",
    descKey: "caseStudy.perspective.single.desc",
  },
  {
    id: true,
    titleKey: "caseStudy.perspective.compare.title",
    descKey: "caseStudy.perspective.compare.desc",
  },
] as const;

export function CaseStudyBriefForm({
  notebookId,
  value,
  onChange,
  onSubmit,
  submitLabel,
  disabled = false,
}: BaseMaterialFormProps) {
  const { t } = useTranslation("generation");
  const [step, setStep] = useState<1 | 2>(1);
  const [questionCount, setQuestionCount] = useState<number>(
    value.caseStudyOptions?.questionCount ?? value.questionCount ?? 4,
  );
  const [isCustomMode, setIsCustomMode] = useState(() => {
    const initial = value.caseStudyOptions?.questionCount ?? 4;
    return !QUESTION_PRESETS.includes(initial as (typeof QUESTION_PRESETS)[number]);
  });
  const [customVal, setCustomVal] = useState<string>(String(questionCount));
  const [comparePerspectives, setComparePerspectives] = useState<boolean>(
    value.caseStudyOptions?.comparePerspectives ?? false,
  );
  const [focus, setFocus] = useState<string>(value.caseStudyOptions?.focus ?? "");

  const { data: sources = [] } = useQuery(sourcesQueryOptions(notebookId));

  const hasSources = value.sourceIds.length > 0;
  const hasInstructions = value.brief.trim().length > 0 || focus.trim().length > 0;
  const canSubmit = !disabled && (hasSources || hasInstructions);

  const questionLabel = t("caseStudy.questionCount", { count: questionCount });

  const update = (patch: Partial<BriefFormData>) => {
    onChange(patch);
  };

  const updateCaseStudyOptions = (patch: {
    questionCount?: number;
    comparePerspectives?: boolean;
    focus?: string;
  }) => {
    const nextCount = patch.questionCount ?? questionCount;
    const nextCompare = patch.comparePerspectives ?? comparePerspectives;
    const nextFocus = patch.focus ?? focus;
    onChange({
      questionCount: nextCount,
      caseStudyOptions: {
        questionCount: nextCount,
        focus: nextFocus,
        comparePerspectives: nextCompare,
      },
    });
  };

  const handleCustomChange = (raw: string) => {
    setCustomVal(raw);
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed > 0) {
      const clamped = Math.min(MAX_QUESTIONS, Math.max(1, parsed));
      setQuestionCount(clamped);
      updateCaseStudyOptions({ questionCount: clamped });
    }
  };

  const handleCustomBlur = () => {
    let parsed = parseInt(customVal, 10);
    if (isNaN(parsed) || parsed < 1) parsed = 4;
    if (parsed > MAX_QUESTIONS) parsed = MAX_QUESTIONS;
    setCustomVal(String(parsed));
    setQuestionCount(parsed);
    updateCaseStudyOptions({ questionCount: parsed });
  };

  return (
    <div className="flex flex-col gap-5 font-sans text-text-tertiary">
      <BriefWizardHeader
        title={t("wizard.title", { kind: t("kinds.case_study") })}
        step={step}
        onStepChange={setStep}
      />

      {step === 1 ? (
        <div className="flex flex-col gap-5 min-h-95 justify-between animate-in fade-in slide-in-from-right-2 duration-150">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-medium text-text-primary">
                  {t("caseStudy.discussionQuestionsLabel")}
                </Label>
                <span className="text-sm font-medium text-primary">{questionLabel}</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {QUESTION_PRESETS.map((cnt) => {
                  const selected = questionCount === cnt && !isCustomMode;
                  return (
                    <button
                      key={cnt}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setIsCustomMode(false);
                        setQuestionCount(cnt);
                        updateCaseStudyOptions({ questionCount: cnt });
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
                      max={MAX_QUESTIONS}
                      value={customVal}
                      onChange={(e) => handleCustomChange(e.target.value)}
                      onBlur={handleCustomBlur}
                      placeholder="1-10"
                      aria-label={t("caseStudy.customQuestionAria")}
                      className="w-full h-9 px-2 text-center text-sm font-semibold bg-surface-2 border border-primary text-text-primary rounded-2xl outline-none focus:ring-1 focus:ring-surface-border-strong shadow-2xs"
                      autoFocus
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomMode(true);
                      const parsed = parseInt(customVal, 10) || 4;
                      const clamped = Math.min(MAX_QUESTIONS, Math.max(1, parsed));
                      setQuestionCount(clamped);
                      updateCaseStudyOptions({ questionCount: clamped });
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
                {t("caseStudy.perspectiveLabel")}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {PERSPECTIVE_OPTIONS.map((opt) => {
                  const selected = comparePerspectives === opt.id;
                  return (
                    <button
                      key={opt.titleKey}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setComparePerspectives(opt.id);
                        updateCaseStudyOptions({ comparePerspectives: opt.id });
                      }}
                      className={cn(
                        optionRowClass(selected),
                        "p-3 flex items-start gap-3 cursor-pointer text-left",
                      )}
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold">{t(opt.titleKey)}</span>
                        <span className="block text-sm leading-tight opacity-80">
                          {t(opt.descKey)}
                        </span>
                      </span>
                    </button>
                  );
                })}
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
                emptyMessage={t("knowledge.emptySources", { kind: t("kinds.case_study") })}
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-transparent">
            <span className="text-xs text-text-faint">{t("wizard.nextHintFocus")}</span>
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
                htmlFor="brief-case-study-focus"
                className="text-sm font-medium text-text-primary"
              >
                {t("caseStudy.conceptsToApplyLabel")}
              </Label>
              <Textarea
                id="brief-case-study-focus"
                value={focus}
                onChange={(e) => {
                  setFocus(e.target.value);
                  updateCaseStudyOptions({ focus: e.target.value });
                }}
                placeholder={t("caseStudy.conceptsPlaceholder")}
                className="min-h-20 max-h-40 text-sm resize-none break-all max-w-full overflow-x-hidden w-full"
                disabled={disabled}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="brief-case-study" className="text-sm font-medium text-text-primary">
                {t("fields.customInstructions")}
                {!hasSources && <span className="text-destructive ml-0.5">*</span>}
              </Label>
              <Textarea
                id="brief-case-study"
                value={value.brief}
                onChange={(e) => update({ brief: e.target.value })}
                placeholder={t("caseStudy.instructionsPlaceholder")}
                className="min-h-20 max-h-40 text-sm resize-none break-all max-w-full overflow-x-hidden w-full"
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
              {submitLabel ?? t("actions.generateKind", { kind: t("kinds.case_study") })}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
