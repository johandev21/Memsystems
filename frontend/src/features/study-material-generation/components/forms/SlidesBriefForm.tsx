import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils/cn";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BriefChoiceField } from "./brief-choice-field";
import { BriefKnowledgeStep } from "./brief-knowledge-step";
import { BriefWizardHeader } from "./brief-wizard-header";
import { CTA_BUTTON_CLASS } from "./option-row";
import { SlideCountSection, SlideThemeSection } from "./slides-form-sections";
import {
  DEFAULT_SLIDES_OPTIONS,
  DETAIL_OPTIONS,
  MAX_SLIDE_COUNT,
  SLIDE_PRESETS,
  normalizeTheme,
  type SlidesThemeOption,
} from "./slides-theme-options";
import type { BaseMaterialFormProps, BriefFormData } from "./types";
import { useBriefWizard } from "./use-brief-wizard";

export function SlidesBriefForm({
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

  const currentOptions = value.slidesOptions ?? DEFAULT_SLIDES_OPTIONS;
  const slideCount = currentOptions.slideCount;
  const theme = normalizeTheme(currentOptions.theme as SlidesThemeOption | undefined);
  const detailLevel = currentOptions.detailLevel;
  const isAutoMode = slideCount === 0;
  const detailOptions = DETAIL_OPTIONS.map((opt) => ({
    id: opt.id,
    title: t(opt.titleKey),
    desc: t(opt.descKey),
  }));

  const isPreset = slideCount > 0 && SLIDE_PRESETS.includes(slideCount);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(!isAutoMode && !isPreset);
  const [customValue, setCustomValue] = useState<string>(() =>
    !isAutoMode && !isPreset ? String(slideCount) : "15",
  );

  const updateSlidesOptions = (patch: Partial<NonNullable<BriefFormData["slidesOptions"]>>) => {
    onChange({
      slidesOptions: {
        slideCount: patch.slideCount !== undefined ? patch.slideCount : slideCount,
        theme: patch.theme ?? theme,
        detailLevel: patch.detailLevel ?? detailLevel,
      },
    });
  };

  const handleCustomChange = (raw: string) => {
    setCustomValue(raw);
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      const count = Math.min(MAX_SLIDE_COUNT, Math.max(1, parsed));
      updateSlidesOptions({ slideCount: count });
    }
  };

  const handleCustomBlur = () => {
    let parsed = Number.parseInt(customValue, 10);
    if (Number.isNaN(parsed) || parsed < 1) parsed = 8;
    if (parsed > MAX_SLIDE_COUNT) parsed = MAX_SLIDE_COUNT;
    setCustomValue(String(parsed));
    updateSlidesOptions({ slideCount: parsed });
  };

  const countLabel = isAutoMode
    ? t("actions.autoDecides")
    : slideCount >= MAX_SLIDE_COUNT
      ? t("slides.countMax", { count: slideCount, max: MAX_SLIDE_COUNT })
      : t("slides.count", { count: slideCount });

  return (
    <div className="flex flex-col gap-5 font-sans text-text-tertiary">
      <BriefWizardHeader
        title={t("wizard.title", { kind: t("kinds.slides") })}
        step={step}
        onStepChange={setStep}
      />

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
                setIsCustomMode(false);
                updateSlidesOptions({ slideCount: 0 });
              }}
              onPreset={(preset) => {
                setIsCustomMode(false);
                updateSlidesOptions({ slideCount: preset });
              }}
              onCustomMode={() => {
                setIsCustomMode(true);
                const parsed = Number.parseInt(customValue, 10) || 15;
                const count = Math.min(MAX_SLIDE_COUNT, Math.max(1, parsed));
                updateSlidesOptions({ slideCount: count });
              }}
              onCustomChange={handleCustomChange}
              onCustomBlur={handleCustomBlur}
            />

            <SlideThemeSection
              theme={theme}
              onThemeChange={(nextTheme) => {
                updateSlidesOptions({ theme: nextTheme });
              }}
            />

            <BriefChoiceField
              label={t("fields.detailLevelStep3")}
              options={detailOptions}
              value={detailLevel}
              onChange={(id) => {
                updateSlidesOptions({ detailLevel: id });
              }}
            />
          </div>

          <div className="flex items-center justify-between border-t border-transparent pt-2">
            <span className="text-xs text-text-faint">{t("wizard.nextHintKnowledge")}</span>
            <Button
              type="button"
              onClick={() => {
                if (!value.slidesOptions) {
                  updateSlidesOptions({});
                }
                setStep(2);
              }}
              className={cn(
                "h-9 cursor-pointer gap-1.5 rounded-full px-5 text-sm font-medium transition-colors",
                CTA_BUTTON_CLASS,
              )}
            >
              {t("actions.nextStep")}
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
          submitLabel={submitLabel ?? t("actions.generateKind", { kind: t("kinds.slides") })}
          disabled={disabled}
          placeholder={t("slides.instructionsPlaceholder")}
          textareaId="brief-slides"
          emptySourcesMessage={t("knowledge.emptySources", { kind: t("kinds.slides") })}
          onPatch={patchFormData}
          onBack={() => setStep(1)}
          onSubmit={() => {
            if (!value.slidesOptions) {
              updateSlidesOptions({});
            }
            onSubmit();
          }}
        />
      )}
    </div>
  );
}

