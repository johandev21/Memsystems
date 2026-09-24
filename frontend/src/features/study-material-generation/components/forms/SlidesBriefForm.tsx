import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/shared/utils/cn";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BriefChoiceField } from "./brief-choice-field";
import { BriefInstructionsStep } from "./brief-instructions-step";
import {
  BriefBackButton,
  BriefNextButton,
  BriefStep,
  BriefStepFields,
  BriefStepFooter,
  BriefStepHint,
} from "./brief-step";
import { BriefWizardHeader } from "./brief-wizard-header";
import { CountSelector } from "./count-selector";
import { GenerationSourcePopover } from "./generation-source-popover";
import {
  DETAIL_OPTIONS,
  MAX_SLIDE_COUNT,
  SLIDE_PRESETS,
  THEME_OPTIONS,
  normalizeTheme,
} from "./slides-theme-options";
import type { BaseMaterialFormProps, SlidesOptions } from "./types";
import { useBriefWizard } from "./use-brief-wizard";

const CUSTOM_SLIDE_DEFAULT = 15;

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
    useBriefWizard({ notebookId, value, onChange, disabled, totalSteps: 3 });

  const slideCount = value.slidesOptions?.slideCount ?? 0;
  const theme = normalizeTheme(value.slidesOptions?.theme);
  const detailLevel = value.slidesOptions?.detailLevel ?? "auto";

  const updateSlidesOptions = (patch: {
    slideCount?: number;
    theme?: SlidesOptions["theme"];
    detailLevel?: SlidesOptions["detailLevel"];
  }) => {
    onChange({
      slidesOptions: {
        slideCount: patch.slideCount ?? slideCount,
        theme: patch.theme ?? theme,
        detailLevel: patch.detailLevel ?? detailLevel,
      },
    });
  };

  const countLabel =
    slideCount === 0
      ? t("actions.autoDecides")
      : slideCount >= MAX_SLIDE_COUNT
        ? t("slides.countMax", { count: slideCount, max: MAX_SLIDE_COUNT })
        : t("slides.count", { count: slideCount });

  const themeOption = THEME_OPTIONS.find((opt) => opt.id === theme);
  const themeDescription =
    theme === "auto" ? t("actions.autoDecides") : themeOption ? t(themeOption.descKey) : null;

  const detailOptions = [
    { id: "auto" as const, title: t("actions.auto"), desc: t("options.auto.description") },
    ...DETAIL_OPTIONS.map((opt) => ({
      id: opt.id,
      title: t(opt.titleKey),
      desc: t(opt.descKey),
    })),
  ];

  return (
    <div className="flex flex-col gap-5 font-sans text-text-tertiary">
      <BriefWizardHeader
        title={t("wizard.title", { kind: t("kinds.slides") })}
        step={step}
        totalSteps={3}
        onStepChange={setStep}
      />
      {step === 1 ? (
        <BriefStep>
          <BriefStepFields>
            <CountSelector
              label={t("slides.numberOfSlidesLabel")}
              summary={countLabel}
              value={slideCount}
              presets={SLIDE_PRESETS}
              min={1}
              max={MAX_SLIDE_COUNT}
              customDefault={CUSTOM_SLIDE_DEFAULT}
              customAriaLabel={t("slides.customCountAria")}
              onValueChange={(next) => updateSlidesOptions({ slideCount: next })}
            />

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-text-primary">
                  {t("slides.visualThemeLabel")}
                </Label>
                <span className="text-xs font-medium text-text-tertiary">{themeDescription}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                <TooltipProvider delay={200}>
                  <Tooltip>
                    <TooltipTrigger
                      type="button"
                      aria-pressed={theme === "auto"}
                      onClick={() => updateSlidesOptions({ theme: "auto" })}
                      className={cn(
                        "cursor-pointer rounded-2xl border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        theme === "auto"
                          ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                          : "border-surface-border-subtle bg-surface-2 text-text-tertiary hover:bg-surface-3",
                        "flex flex-col items-center gap-1.5 p-2 transition-all",
                        theme === "auto" ? "font-semibold" : "font-medium",
                      )}
                    >
                      <span className="relative flex h-7 w-full items-center justify-center overflow-hidden rounded-md border border-transparent bg-surface-3">
                        <Sparkles className="size-3.5 text-primary" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-center text-sm font-semibold">
                          {t("actions.auto")}
                        </span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{t("options.auto.description")}</TooltipContent>
                  </Tooltip>

                  {THEME_OPTIONS.map((opt) => {
                    const selected = theme === opt.id;
                    return (
                      <Tooltip key={opt.id}>
                        <TooltipTrigger
                          type="button"
                          aria-pressed={selected}
                          onClick={() => updateSlidesOptions({ theme: opt.id })}
                          className={cn(
                            "cursor-pointer rounded-2xl border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            selected
                              ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                              : "border-surface-border-subtle bg-surface-2 text-text-tertiary hover:bg-surface-3",
                            "flex flex-col items-center gap-1.5 p-2 transition-all",
                            selected ? "font-semibold" : "font-medium",
                          )}
                        >
                          <span
                            className={cn(
                              "relative block h-7 w-full overflow-hidden rounded-md border bg-(--swatch-bg)",
                              selected ? "border-(--swatch-accent)" : "border-transparent",
                            )}
                            style={
                              {
                                "--swatch-bg": opt.swatch.bg,
                                "--swatch-accent": opt.swatch.accent,
                                "--swatch-text": opt.swatch.text,
                                "--swatch-surface": opt.swatch.surface,
                              } as React.CSSProperties
                            }
                          >
                            <span className="absolute inset-x-0 top-0 block h-0.75 bg-(--swatch-accent)" />
                            <span className="absolute left-1 top-1.5 block h-0.75 w-3/5 rounded-full bg-(--swatch-text)" />
                            <span className="absolute left-1 top-2.75 block h-0.5 w-2/5 rounded-full opacity-70 bg-(--swatch-text)" />
                            <span className="absolute bottom-0.75 left-1 flex gap-0.5">
                              <span className="block size-1.5 rounded-xs border border-(--swatch-accent) bg-(--swatch-surface)" />
                              <span className="block size-1.5 rounded-full bg-(--swatch-accent)" />
                            </span>
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-center text-sm font-semibold">
                              {t(opt.titleKey)}
                            </span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t("slides.themeTooltip", {
                            title: t(opt.titleKey),
                            desc: t(opt.descKey),
                          })}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </TooltipProvider>
              </div>
            </div>
          </BriefStepFields>

          <BriefStepFooter>
            <BriefStepHint>{t("wizard.nextHintOptions")}</BriefStepHint>
            <BriefNextButton onClick={() => setStep(2)}>
              {t("actions.nextStep")}
              <ArrowRight className="size-4" />
            </BriefNextButton>
          </BriefStepFooter>
        </BriefStep>
      ) : step === 2 ? (
        <BriefStep>
          <BriefStepFields>
            <BriefChoiceField
              columns={3}
              label={t("fields.detailLevelStep3")}
              options={detailOptions}
              value={detailLevel}
              onChange={(next) => updateSlidesOptions({ detailLevel: next })}
            />

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium text-text-primary">
                {t("fields.knowledgeSourcesStep4")}
                {!hasInstructions && <span className="text-destructive ml-0.5">*</span>}
              </Label>
              <GenerationSourcePopover
                sources={sources}
                selectedIds={value.sourceIds}
                onChange={(sourceIds) => patchFormData({ sourceIds })}
                emptyMessage={t("knowledge.emptySources", { kind: t("kinds.slides") })}
              />
            </div>
          </BriefStepFields>

          <BriefStepFooter>
            <BriefBackButton onClick={() => setStep(1)}>
              <ArrowLeft className="size-4" />
              {t("actions.back")}
            </BriefBackButton>
            <BriefStepHint>{t("wizard.nextHintInstructions")}</BriefStepHint>
            <BriefNextButton onClick={() => setStep(3)}>
              {t("actions.nextStep")}
              <ArrowRight className="size-4" />
            </BriefNextButton>
          </BriefStepFooter>
        </BriefStep>
      ) : (
        <BriefInstructionsStep
          notebookId={notebookId}
          brief={value.brief}
          folderId={value.folderId}
          hasSources={hasSources}
          canSubmit={canSubmit}
          submitLabel={submitLabel ?? t("actions.generateKind", { kind: t("kinds.slides") })}
          placeholder={t("slides.instructionsPlaceholder")}
          textareaId="brief-slides"
          disabled={disabled}
          onBriefChange={(brief) => patchFormData({ brief })}
          onFolderIdChange={(folderId) => patchFormData({ folderId })}
          onBack={() => setStep(2)}
          onSubmit={onSubmit}
        />
      )}
    </div>
  );
}
