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
import { BriefChoiceField } from "./brief-choice-field";
import { BriefWizardHeader } from "./brief-wizard-header";
import { GenerationSourcePopover } from "./generation-source-popover";
import { optionRowClass } from "./option-row";
import type { BaseMaterialFormProps, BriefFormData } from "./types";

type StudyGuideFormat = "detailed" | "revision";

const SECTION_PRESETS = [4, 6, 8, 12] as const;
const MAX_SECTIONS = 12;

export function StudyGuideBriefForm({
  notebookId,
  value,
  onChange,
  onSubmit,
  submitLabel,
  disabled = false,
}: BaseMaterialFormProps) {
  const { t } = useTranslation("generation");
  const formatOptions = [
    {
      id: "detailed" as StudyGuideFormat,
      title: t("studyGuide.format.detailed.title"),
      desc: t("studyGuide.format.detailed.desc"),
    },
    {
      id: "revision" as StudyGuideFormat,
      title: t("studyGuide.format.revision.title"),
      desc: t("studyGuide.format.revision.desc"),
    },
  ] as const;
  const [step, setStep] = useState<1 | 2>(1);
  const [format, setFormat] = useState<StudyGuideFormat>(
    value.studyGuideOptions?.format ?? "detailed",
  );
  const [sectionCount, setSectionCount] = useState<number>(
    value.studyGuideOptions?.sectionCount ?? 6,
  );
  const [isCustomMode, setIsCustomMode] = useState(() => {
    const initial = value.studyGuideOptions?.sectionCount ?? 6;
    return !SECTION_PRESETS.includes(initial as (typeof SECTION_PRESETS)[number]);
  });
  const [customVal, setCustomVal] = useState<string>(String(sectionCount));

  const { data: sources = [] } = useQuery(sourcesQueryOptions(notebookId));

  const hasSources = value.sourceIds.length > 0;
  const hasInstructions = value.brief.trim().length > 0;
  const canSubmit = !disabled && (hasSources || hasInstructions);

  const sectionLabel = t("studyGuide.sectionCount", { count: sectionCount });

  const update = (patch: Partial<BriefFormData>) => {
    onChange(patch);
  };

  const updateStudyGuideOptions = (patch: {
    format?: StudyGuideFormat;
    sectionCount?: number;
  }) => {
    const nextFormat = patch.format ?? format;
    const nextCount = patch.sectionCount ?? sectionCount;
    onChange({
      studyGuideOptions: {
        format: nextFormat,
        sectionCount: nextCount,
      },
    });
  };

  const handleCustomChange = (raw: string) => {
    setCustomVal(raw);
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed > 0) {
      const clamped = Math.min(MAX_SECTIONS, Math.max(1, parsed));
      setSectionCount(clamped);
      updateStudyGuideOptions({ sectionCount: clamped });
    }
  };

  const handleCustomBlur = () => {
    let parsed = parseInt(customVal, 10);
    if (isNaN(parsed) || parsed < 1) parsed = 6;
    if (parsed > MAX_SECTIONS) parsed = MAX_SECTIONS;
    setCustomVal(String(parsed));
    setSectionCount(parsed);
    updateStudyGuideOptions({ sectionCount: parsed });
  };

  return (
    <div className="flex flex-col gap-5 font-sans text-text-tertiary">
      <BriefWizardHeader
        title={t("wizard.title", { kind: t("kinds.study_guide") })}
        step={step}
        onStepChange={setStep}
      />

      {step === 1 ? (
        <div className="flex flex-col gap-5 min-h-95 justify-between animate-in fade-in slide-in-from-right-2 duration-150">
          <div className="flex flex-col gap-5">
            <BriefChoiceField
              label={t("studyGuide.formatLabel")}
              options={formatOptions}
              value={format}
              onChange={(nextFormat) => {
                setFormat(nextFormat);
                updateStudyGuideOptions({ format: nextFormat });
              }}
            />

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-medium text-text-primary">
                  {t("studyGuide.sectionsLabel")}
                </Label>
                <span className="text-sm font-medium text-primary">{sectionLabel}</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {SECTION_PRESETS.map((cnt) => {
                  const selected = sectionCount === cnt && !isCustomMode;
                  return (
                    <button
                      key={cnt}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setIsCustomMode(false);
                        setSectionCount(cnt);
                        updateStudyGuideOptions({ sectionCount: cnt });
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
                      max={MAX_SECTIONS}
                      value={customVal}
                      onChange={(e) => handleCustomChange(e.target.value)}
                      onBlur={handleCustomBlur}
                      placeholder="1-12"
                      aria-label={t("studyGuide.customSectionAria")}
                      className="w-full h-9 px-2 text-center text-sm font-semibold bg-surface-2 border border-primary text-text-primary rounded-2xl outline-none focus:ring-1 focus:ring-surface-border-strong shadow-2xs"
                      autoFocus
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomMode(true);
                      const parsed = parseInt(customVal, 10) || 6;
                      const clamped = Math.min(MAX_SECTIONS, Math.max(1, parsed));
                      setSectionCount(clamped);
                      updateStudyGuideOptions({ sectionCount: clamped });
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
                  kind: t("kinds.study_guide"),
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
              <Label htmlFor="brief-study-guide" className="text-sm font-medium text-text-primary">
                {t("fields.customInstructions")}
                {!hasSources && <span className="text-destructive ml-0.5">*</span>}
              </Label>
              <Textarea
                id="brief-study-guide"
                value={value.brief}
                onChange={(e) => update({ brief: e.target.value })}
                placeholder={t("studyGuide.instructionsPlaceholder")}
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
              {submitLabel ?? t("actions.generateKind", { kind: t("kinds.study_guide") })}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
