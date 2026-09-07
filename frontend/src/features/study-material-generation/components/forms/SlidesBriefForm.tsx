import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FolderPicker } from "@/features/notebooks";
import { sourcesQueryOptions } from "@/features/sources";
import { cn } from "@/shared/utils/cn";
import type { BaseMaterialFormProps, BriefFormData } from "./types";
import { CTA_BUTTON_CLASS, optionRowClass } from "./option-row";
import { GenerationSourcePopover } from "./generation-source-popover";

type SlidesThemeOption =
  | "dark"
  | "light"
  | "accent"
  | "editorial"
  | "academic"
  | "technical"
  | "warm";
type DetailLevel = "basic" | "detailed";

const SLIDE_PRESETS = [5, 8, 10, 12];
const MAX_SLIDE_COUNT = 20;

function normalizeTheme(
  theme: SlidesThemeOption | undefined,
): Exclude<SlidesThemeOption, "accent"> {
  if (theme === "accent") return "warm";
  return theme ?? "dark";
}

const THEME_OPTIONS = [
  {
    id: "dark" as const,
    title: "Dark",
    desc: "Slate deck, cyan accent",
    swatch: { bg: "#0F172A", surface: "#1E293B", accent: "#38BDF8", text: "#F8FAFC" },
  },
  {
    id: "light" as const,
    title: "Light",
    desc: "Bright, print-friendly",
    swatch: { bg: "#FFFFFF", surface: "#F1F5F9", accent: "#0EA5E9", text: "#0F172A" },
  },
  {
    id: "editorial" as const,
    title: "Editorial",
    desc: "Warm paper, serif voice",
    swatch: { bg: "#FDFBF7", surface: "#F5EFE6", accent: "#B45309", text: "#1C1917" },
  },
  {
    id: "academic" as const,
    title: "Academic",
    desc: "Classic lecture style",
    swatch: { bg: "#FFFFFF", surface: "#EFF6FF", accent: "#1D4ED8", text: "#111827" },
  },
  {
    id: "technical" as const,
    title: "Technical",
    desc: "Deep navy, neon detail",
    swatch: { bg: "#020617", surface: "#0F172A", accent: "#22D3EE", text: "#E2E8F0" },
  },
  {
    id: "warm" as const,
    title: "Warm",
    desc: "Bold ember energy",
    swatch: { bg: "#FFF7ED", surface: "#FFEDD5", accent: "#EA580C", text: "#431407" },
  },
] as const;

const DETAIL_OPTIONS = [
  { id: "basic" as DetailLevel, title: "Basic", desc: "Concise bullets" },
  { id: "detailed" as DetailLevel, title: "Detailed", desc: "Rich bullets + body" },
] as const;

export function SlidesBriefForm({
  notebookId,
  value,
  onChange,
  onSubmit,
  submitLabel = "Generate Slides",
  disabled = false,
}: BaseMaterialFormProps) {
  const initialCount = value.slidesOptions?.slideCount ?? 8;
  const [step, setStep] = useState<1 | 2>(1);
  const [slideCount, setSlideCount] = useState<number>(initialCount);
  const [isAutoMode, setIsAutoMode] = useState<boolean>(initialCount === 0);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(
    initialCount > 0 && !SLIDE_PRESETS.includes(initialCount),
  );
  const [customValue, setCustomValue] = useState<string>(
    initialCount > 0 && !SLIDE_PRESETS.includes(initialCount) ? String(initialCount) : "15",
  );
  const [theme, setTheme] = useState<Exclude<SlidesThemeOption, "accent">>(
    normalizeTheme(value.slidesOptions?.theme as SlidesThemeOption | undefined),
  );
  const [detailLevel, setDetailLevel] = useState<DetailLevel>(
    value.slidesOptions?.detailLevel ?? "detailed",
  );

  const { data: sources = [] } = useQuery(sourcesQueryOptions(notebookId));

  const hasSources = value.sourceIds.length > 0;
  const hasInstructions = value.brief.trim().length > 0;
  const canSubmit = !disabled && (hasSources || hasInstructions);

  const update = (patch: Partial<BriefFormData>) => onChange(patch);

  useEffect(() => {
    update({
      slidesOptions: {
        slideCount: isAutoMode ? 0 : slideCount,
        theme,
        detailLevel,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideCount, isAutoMode, theme, detailLevel]);

  const handleCustomChange = (raw: string) => {
    setCustomValue(raw);
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      setSlideCount(Math.min(MAX_SLIDE_COUNT, Math.max(1, parsed)));
    }
  };

  const handleCustomBlur = () => {
    const parsed = Number.parseInt(customValue, 10);
    const next = Number.isNaN(parsed) ? 8 : Math.min(MAX_SLIDE_COUNT, Math.max(1, parsed));
    setCustomValue(String(next));
    setSlideCount(next);
  };

  const countLabel = isAutoMode
    ? "Auto (AI decides)"
    : `${slideCount} slide${slideCount === 1 ? "" : "s"}${slideCount >= MAX_SLIDE_COUNT ? " (max 20)" : ""}`;

  return (
    <div className="flex w-full flex-col gap-4 font-sans text-text-tertiary">
      <WizardHeader step={step} onStepChange={setStep} />
      {step === 1 ? (
        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-2 duration-150">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-text-primary">1. Number of Slides</Label>
                <span className="text-xs font-medium text-primary">{countLabel}</span>
              </div>
              <div className="grid grid-cols-6 gap-2">
                <button
                  type="button"
                  aria-pressed={isAutoMode}
                  onClick={() => {
                    setIsAutoMode(true);
                    setIsCustomMode(false);
                    setSlideCount(0);
                  }}
                  className={cn(
                    optionRowClass(isAutoMode),
                    "flex h-9 items-center justify-center text-xs",
                    isAutoMode ? "font-semibold" : "font-medium",
                  )}
                >
                  Auto
                </button>
                {SLIDE_PRESETS.map((count) => {
                  const selected = !isAutoMode && !isCustomMode && slideCount === count;
                  return (
                    <button
                      key={count}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setIsAutoMode(false);
                        setIsCustomMode(false);
                        setSlideCount(count);
                      }}
                      className={cn(
                        optionRowClass(selected),
                        "flex h-9 items-center justify-center text-xs",
                        selected ? "font-semibold" : "font-medium",
                      )}
                    >
                      {count}
                    </button>
                  );
                })}
                {isCustomMode && !isAutoMode ? (
                  <input
                    type="number"
                    min={1}
                    max={MAX_SLIDE_COUNT}
                    value={customValue}
                    onChange={(e) => handleCustomChange(e.target.value)}
                    onBlur={handleCustomBlur}
                    placeholder="1-20"
                    aria-label="Custom slide count"
                    className="h-9 w-full rounded-2xl border border-primary bg-surface-2 px-2 text-center text-xs font-semibold text-text-primary outline-none focus:ring-1 focus:ring-surface-border-strong"
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAutoMode(false);
                      setIsCustomMode(true);
                      setSlideCount(
                        Math.min(
                          MAX_SLIDE_COUNT,
                          Math.max(1, Number.parseInt(customValue, 10) || 15),
                        ),
                      );
                    }}
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

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium text-text-primary">2. Design Direction</Label>
              <div className="grid grid-cols-6 gap-2">
                <TooltipProvider delay={200}>
                  {THEME_OPTIONS.map((opt) => {
                    const selected = theme === opt.id;
                    return (
                      <Tooltip key={opt.id}>
                        <TooltipTrigger
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setTheme(opt.id)}
                          className={cn(
                            optionRowClass(selected),
                            "p-1.5 flex flex-col gap-1.5 cursor-pointer text-left",
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className="relative block aspect-video w-full overflow-hidden rounded-[9px] border border-surface-border-subtle"
                            style={{ backgroundColor: opt.swatch.bg }}
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

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium text-text-primary">3. Detail Level</Label>
              <div className="grid grid-cols-2 gap-2">
                {DETAIL_OPTIONS.map((opt) => {
                  const selected = detailLevel === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setDetailLevel(opt.id)}
                      className={cn(
                        optionRowClass(selected),
                        "p-3 flex items-start gap-3 cursor-pointer text-left",
                      )}
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs font-semibold">{opt.title}</span>
                        <span className="block text-xs leading-tight opacity-80">{opt.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
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
        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-2 duration-150">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-text-primary">
                Knowledge Sources
                {!hasInstructions && <span className="text-destructive ml-0.5">*</span>}
              </Label>
              <GenerationSourcePopover
                sources={sources}
                selectedIds={value.sourceIds}
                onChange={(sourceIds) => update({ sourceIds })}
                emptyMessage="No sources in notebook. Slides will generate using general knowledge."
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="brief-slides" className="text-sm font-medium text-text-primary">
                Custom Instructions
                {!hasSources && <span className="text-destructive ml-0.5">*</span>}
              </Label>
              <Textarea
                id="brief-slides"
                value={value.brief}
                onChange={(e) => update({ brief: e.target.value })}
                placeholder="What should this deck explain? Describe the topic, audience, or narrative arc..."
                className="min-h-[120px] max-h-[200px] text-xs resize-none w-full"
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
          <span className="text-sm font-semibold">Slides Setup</span>
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
