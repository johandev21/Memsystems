import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/shared/utils/cn";
import { useTranslation } from "react-i18next";
import { optionRowClass } from "./option-row";
import {
  MAX_SLIDE_COUNT,
  SLIDE_PRESETS,
  THEME_OPTIONS,
  type SlidesThemeOption,
} from "./slides-theme-options";

export interface SlideCountSectionProps {
  isAutoMode: boolean;
  isCustomMode: boolean;
  slideCount: number;
  customValue: string;
  countLabel: string;
  onAuto: () => void;
  onPreset: (count: number) => void;
  onCustomMode: () => void;
  onCustomChange: (raw: string) => void;
  onCustomBlur: () => void;
}

export function SlideCountSection({
  isAutoMode,
  isCustomMode,
  slideCount,
  customValue,
  countLabel,
  onAuto,
  onPreset,
  onCustomMode,
  onCustomChange,
  onCustomBlur,
}: SlideCountSectionProps) {
  const { t } = useTranslation("generation");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-text-primary">
          {t("slides.numberOfSlidesLabel")}
        </Label>
        <span className="text-sm font-medium text-primary">{countLabel}</span>
      </div>
      <div className="grid grid-cols-6 gap-2">
        <button
          type="button"
          aria-pressed={isAutoMode}
          onClick={onAuto}
          className={cn(
            optionRowClass(isAutoMode),
            "flex h-9 items-center justify-center text-sm",
            isAutoMode ? "font-semibold" : "font-medium",
          )}
        >
          {t("actions.auto")}
        </button>
        {SLIDE_PRESETS.map((preset) => {
          const selected = !isAutoMode && !isCustomMode && slideCount === preset;
          return (
            <button
              key={preset}
              type="button"
              aria-pressed={selected}
              onClick={() => onPreset(preset)}
              className={cn(
                optionRowClass(selected),
                "flex h-9 items-center justify-center text-sm",
                selected ? "font-semibold" : "font-medium",
              )}
            >
              {preset}
            </button>
          );
        })}
        {isCustomMode ? (
          <div className="relative flex h-9 items-center">
            <input
              type="number"
              min={1}
              max={MAX_SLIDE_COUNT}
              value={customValue}
              onChange={(e) => onCustomChange(e.target.value)}
              onBlur={onCustomBlur}
              aria-label={t("slides.customCountAria")}
              className="h-9 w-full rounded-2xl border border-primary bg-surface-2 px-1 text-center text-sm font-semibold text-text-primary shadow-2xs outline-none focus:ring-1 focus:ring-surface-border-strong"
              autoFocus
            />
          </div>
        ) : (
          <button
            type="button"
            aria-pressed={false}
            onClick={onCustomMode}
            className={cn(
              optionRowClass(false),
              "flex h-9 items-center justify-center text-sm font-medium",
            )}
          >
            {t("actions.custom")}
          </button>
        )}
      </div>
    </div>
  );
}

export interface SlideThemeSectionProps {
  theme: Exclude<SlidesThemeOption, "accent">;
  onThemeChange: (theme: Exclude<SlidesThemeOption, "accent">) => void;
}

export function SlideThemeSection({
  theme,
  onThemeChange,
}: SlideThemeSectionProps) {
  const { t } = useTranslation("generation");
  const themeDesc = THEME_OPTIONS.find((opt) => opt.id === theme)?.descKey;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-text-primary">
          {t("slides.visualThemeLabel")}
        </Label>
        <span className="text-sm font-medium text-text-tertiary">
          {themeDesc ? t(themeDesc) : null}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <TooltipProvider delay={200}>
          {THEME_OPTIONS.map((opt) => {
            const selected = theme === opt.id;
            return (
              <Tooltip key={opt.id}>
                <TooltipTrigger
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onThemeChange(opt.id)}
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
  );
}
