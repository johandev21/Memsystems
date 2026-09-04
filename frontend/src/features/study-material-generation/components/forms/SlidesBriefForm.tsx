import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FolderPicker } from "@/features/notebooks";
import { sourcesQueryOptions } from "@/features/sources";
import { cn } from "@/shared/utils/cn";
import type { BaseMaterialFormProps, BriefFormData } from "./types";
import { CTA_BUTTON_CLASS, optionRowClass } from "./option-row";
import { GenerationSourcePopover } from "./generation-source-popover";

type SlidesTheme = "dark" | "light" | "accent";
type DetailLevel = "basic" | "detailed";

const SLIDE_PRESETS = [5, 8, 10, 12];
const MAX_SLIDE_COUNT = 20;

const THEME_OPTIONS = [
  { id: "dark" as SlidesTheme, title: "Dark", desc: "Slate deck, cyan accent" },
  { id: "light" as SlidesTheme, title: "Light", desc: "Bright, print-friendly" },
  { id: "accent" as SlidesTheme, title: "Accent", desc: "Bold gradient energy" },
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
  const [slideCount, setSlideCount] = useState<number>(initialCount);
  const [isAutoMode, setIsAutoMode] = useState<boolean>(initialCount === 0);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(
    initialCount > 0 && !SLIDE_PRESETS.includes(initialCount),
  );
  const [customValue, setCustomValue] = useState<string>(
    initialCount > 0 && !SLIDE_PRESETS.includes(initialCount) ? String(initialCount) : "15",
  );
  const [theme, setTheme] = useState<SlidesTheme>(value.slidesOptions?.theme ?? "dark");
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
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-text-primary">Number of Slides</Label>
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
                  Math.min(MAX_SLIDE_COUNT, Math.max(1, Number.parseInt(customValue, 10) || 15)),
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
        <Label className="text-sm font-medium text-text-primary">Theme</Label>
        <div className="grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map((opt) => {
            const selected = theme === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => setTheme(opt.id)}
                className={cn(
                  optionRowClass(selected),
                  "p-3 flex items-start gap-3 cursor-pointer",
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold">{opt.title}</div>
                  <span className="text-xs leading-tight opacity-80">{opt.desc}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium text-text-primary">Detail Level</Label>
        <div className="grid grid-cols-2 gap-2">
          {DETAIL_OPTIONS.map((opt) => {
            const selected = detailLevel === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => setDetailLevel(opt.id)}
                className={cn(
                  optionRowClass(selected),
                  "p-3 flex items-start gap-3 cursor-pointer",
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold">{opt.title}</div>
                  <span className="text-xs leading-tight opacity-80">{opt.desc}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium text-text-primary">
          Knowledge Sources{!hasInstructions && <span className="text-destructive ml-0.5">*</span>}
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
          Custom Instructions{!hasSources && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        <Textarea
          id="brief-slides"
          value={value.brief}
          onChange={(e) => update({ brief: e.target.value })}
          placeholder="What should this deck explain? Describe the topic, audience, or narrative arc..."
          className="min-h-[70px] max-h-[180px] text-xs resize-none w-full"
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

      <Button
        type="button"
        className={cn(
          "w-full h-10 rounded-full font-medium text-sm gap-2 cursor-pointer transition-colors mt-1",
          CTA_BUTTON_CLASS,
        )}
        disabled={!canSubmit}
        onClick={onSubmit}
      >
        {submitLabel}
      </Button>
    </div>
  );
}
