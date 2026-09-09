import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils/cn";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { BriefChoiceField } from "./brief-choice-field";
import { BriefKnowledgeStep } from "./brief-knowledge-step";
import { BriefWizardHeader } from "./brief-wizard-header";
import { CTA_BUTTON_CLASS } from "./option-row";
import { SlideCountSection, SlideThemeSection } from "./slides-form-sections";
import {
  DETAIL_OPTIONS,
  MAX_SLIDE_COUNT,
  SLIDE_PRESETS,
  normalizeTheme,
  type DetailLevel,
  type SlidesThemeOption,
} from "./slides-theme-options";
import type { BaseMaterialFormProps, BriefFormData } from "./types";
import { useBriefWizard } from "./use-brief-wizard";

export function SlidesBriefForm({
  notebookId,
  value,
  onChange,
  onSubmit,
  submitLabel = "Generate Slides",
  disabled = false,
}: BaseMaterialFormProps) {
  const initialCount = value.slidesOptions?.slideCount ?? 8;
  const { step, setStep, sources, hasSources, hasInstructions, canSubmit, patchFormData } =
    useBriefWizard({ notebookId, value, onChange, disabled });

  const [slideCount, setSlideCount] = useState<number>(initialCount);
  const [isAutoMode, setIsAutoMode] = useState<boolean>(initialCount === 0);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(
    initialCount > 0 && !SLIDE_PRESETS.includes(initialCount),
  );
  const [customValue, setCustomValue] = useState<string>(
    initialCount > 0 && !SLIDE_PRESETS.includes(initialCount) ? String(initialCount) : "15",
  );
  const [theme, setTheme] = useState<Exclude<SlidesThemeOption, "accent">>(() =>
    normalizeTheme(value.slidesOptions?.theme as SlidesThemeOption | undefined),
  );
  const [detailLevel, setDetailLevel] = useState<DetailLevel>(
    value.slidesOptions?.detailLevel ?? "detailed",
  );

  useEffect(() => {
    onChange({
      slidesOptions: {
        slideCount: isAutoMode ? 0 : slideCount,
        theme,
        detailLevel,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideCount, isAutoMode, theme, detailLevel]);

  const updateSlidesOptions = (patch: Partial<NonNullable<BriefFormData["slidesOptions"]>>) => {
    const nextCount =
      patch.slideCount !== undefined ? patch.slideCount : isAutoMode ? 0 : slideCount;
    const nextTheme = patch.theme ?? theme;
    const nextDetail = patch.detailLevel ?? detailLevel;
    onChange({
      slidesOptions: {
        slideCount: nextCount,
        theme: nextTheme,
        detailLevel: nextDetail,
      },
    });
  };

  const handleCustomChange = (raw: string) => {
    setCustomValue(raw);
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      const count = Math.min(MAX_SLIDE_COUNT, Math.max(1, parsed));
      setSlideCount(count);
      updateSlidesOptions({ slideCount: count });
    }
  };

  const handleCustomBlur = () => {
    let parsed = Number.parseInt(customValue, 10);
    if (Number.isNaN(parsed) || parsed < 1) parsed = 8;
    if (parsed > MAX_SLIDE_COUNT) parsed = MAX_SLIDE_COUNT;
    setCustomValue(String(parsed));
    setSlideCount(parsed);
    updateSlidesOptions({ slideCount: parsed });
  };

  const countLabel = isAutoMode
    ? "Auto (AI decides)"
    : `${slideCount} ${slideCount === 1 ? "Slide" : "Slides"}${slideCount >= MAX_SLIDE_COUNT ? ` (Max ${MAX_SLIDE_COUNT})` : ""}`;

  return (
    <div className="flex flex-col gap-5 font-sans text-text-tertiary">
      <BriefWizardHeader title="Slides Setup" step={step} onStepChange={setStep} />

      {step === 1 ? (
        <div className="flex min-h-[380px] flex-col justify-between gap-5 animate-in fade-in slide-in-from-right-2 duration-150">
          <div className="flex flex-col gap-5">
            <SlideCountSection
              isAutoMode={isAutoMode}
              isCustomMode={isCustomMode}
              slideCount={slideCount}
              customValue={customValue}
              countLabel={countLabel}
              onAuto={() => {
                setIsAutoMode(true);
                setIsCustomMode(false);
                setSlideCount(0);
                updateSlidesOptions({ slideCount: 0 });
              }}
              onPreset={(preset) => {
                setIsAutoMode(false);
                setIsCustomMode(false);
                setSlideCount(preset);
                updateSlidesOptions({ slideCount: preset });
              }}
              onCustomMode={() => {
                setIsAutoMode(false);
                setIsCustomMode(true);
                const parsed = Number.parseInt(customValue, 10) || 15;
                const count = Math.min(MAX_SLIDE_COUNT, Math.max(1, parsed));
                setSlideCount(count);
                updateSlidesOptions({ slideCount: count });
              }}
              onCustomChange={handleCustomChange}
              onCustomBlur={handleCustomBlur}
            />

            <SlideThemeSection
              theme={theme}
              onThemeChange={(nextTheme) => {
                setTheme(nextTheme);
                updateSlidesOptions({ theme: nextTheme });
              }}
            />

            <BriefChoiceField
              label="3. Detail Level"
              options={DETAIL_OPTIONS}
              value={detailLevel}
              onChange={(id) => {
                setDetailLevel(id);
                updateSlidesOptions({ detailLevel: id });
              }}
            />
          </div>

          <div className="flex items-center justify-between border-t border-transparent pt-2">
            <span className="text-xs text-text-faint">
              Configure knowledge sources & brief next
            </span>
            <Button
              type="button"
              onClick={() => setStep(2)}
              className={cn(
                "h-9 cursor-pointer gap-1.5 rounded-full px-5 text-sm font-medium transition-colors",
                CTA_BUTTON_CLASS,
              )}
            >
              Next Step
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <BriefKnowledgeStep
          notebookId={notebookId}
          value={value}
          sources={sources}
          hasSources={hasSources}
          hasInstructions={hasInstructions}
          canSubmit={canSubmit}
          submitLabel={submitLabel}
          disabled={disabled}
          placeholder="What should this deck explain? Describe the topic, audience, or narrative arc..."
          textareaId="brief-slides"
          emptySourcesMessage="No sources in notebook. Slides will generate using general knowledge."
          onPatch={patchFormData}
          onBack={() => setStep(1)}
          onSubmit={onSubmit}
        />
      )}
    </div>
  );
}
