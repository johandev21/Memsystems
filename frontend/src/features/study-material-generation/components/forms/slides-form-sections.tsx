import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/shared/utils/cn";
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
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-text-primary">1. Number of Slides</Label>
        <span className="text-xs font-medium text-primary">{countLabel}</span>
      </div>
      <div className="grid grid-cols-6 gap-2">
        <button
          type="button"
          aria-pressed={isAutoMode}
          onClick={onAuto}
          className={cn(
            optionRowClass(isAutoMode),
            "flex h-9 items-center justify-center text-xs",
            isAutoMode ? "font-semibold" : "font-medium",
          )}
        >
          Auto
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
                "flex h-9 items-center justify-center text-xs",
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
              aria-label="Custom slide count"
              className="h-9 w-full rounded-2xl border border-primary bg-surface-2 px-1 text-center text-xs font-semibold text-text-primary shadow-2xs outline-none focus:ring-1 focus:ring-surface-border-strong"
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
              "flex h-9 items-center justify-center text-xs font-medium",
            )}
          >
            Custom
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
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-text-primary">2. Visual Theme</Label>
        <span className="text-xs font-medium text-text-muted">
          {THEME_OPTIONS.find((t) => t.id === theme)?.desc}
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
                    optionRowClass(selected),
                    "flex flex-col items-center gap-1.5 p-2 transition-all",
                    selected ? "font-semibold" : "font-medium",
                  )}
                >
                  <span
                    className="relative block h-7 w-full overflow-hidden rounded-md border"
                    style={{
                      backgroundColor: opt.swatch.bg,
                      borderColor: selected ? opt.swatch.accent : "transparent",
                    }}
                  >
                    <span
                      className="absolute inset-x-0 top-0 block h-[3px]"
                      style={{ backgroundColor: opt.swatch.accent }}
                    />
                    <span
                      className="absolute left-[4px] top-[6px] block h-[3px] w-3/5 rounded-full"
                      style={{ backgroundColor: opt.swatch.text }}
                    />
                    <span
                      className="absolute left-[4px] top-[11px] block h-[2px] w-2/5 rounded-full opacity-70"
                      style={{ backgroundColor: opt.swatch.text }}
                    />
                    <span className="absolute bottom-[3px] left-[4px] flex gap-[2px]">
                      <span
                        className="block size-[6px] rounded-[2px]"
                        style={{
                          backgroundColor: opt.swatch.surface,
                          border: `1px solid ${opt.swatch.accent}`,
                        }}
                      />
                      <span
                        className="block size-[6px] rounded-full"
                        style={{ backgroundColor: opt.swatch.accent }}
                      />
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-center text-xs font-semibold">
                      {opt.title}
                    </span>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {opt.title}: {opt.desc}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </div>
    </div>
  );
}
