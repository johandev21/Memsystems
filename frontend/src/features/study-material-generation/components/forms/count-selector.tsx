import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { cn } from "@/shared/utils/cn";
import { optionRowClass } from "./option-row";

/**
 * Count selector shared by every generation dialog.
 *
 * Value contract: explicit counts only (`>= min`); "Custom"
 * reveals a numeric input clamped to `[min, max]`.
 */

const COLUMN_CLASS: Record<number, string> = {
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
  5: "sm:grid-cols-5",
  6: "sm:grid-cols-6",
  7: "sm:grid-cols-7",
};

export const countInputClass =
  "h-9 w-full rounded-2xl border border-primary bg-surface-2 px-2 text-center text-sm font-semibold text-text-primary shadow-2xs outline-none focus:ring-1 focus:ring-surface-border-strong";

export interface CountSelectorProps {
  label: string;
  /** Right-side status text, e.g. "10 Questions (Max 50)". */
  summary: string;
  /** Explicit count (>= min). */
  value: number;
  presets: readonly number[];
  max: number;
  min?: number;
  /** Starting value when the user opens the Custom input. */
  customDefault?: number;
  customAriaLabel: string;
  presetLabel?: (value: number) => string;
  disabled?: boolean;
  onValueChange: (value: number) => void;
}

export function CountSelector({
  label,
  summary,
  value,
  presets,
  max,
  min = 1,
  customDefault,
  customAriaLabel,
  presetLabel,
  disabled = false,
  onValueChange,
}: CountSelectorProps) {
  const { t } = useTranslation("generation");

  const isPreset = presets.includes(value);
  const isCustom = value > 0 && !isPreset;
  const fallback =
    customDefault ?? presets[Math.floor(presets.length / 2)] ?? Math.min(max, Math.max(min, 10));
  const [customText, setCustomText] = useState(() => (isCustom ? String(value) : String(fallback)));

  const clamp = (raw: number) => Math.min(max, Math.max(min, raw));

  const handleCustomChange = (raw: string) => {
    setCustomText(raw);
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      onValueChange(clamp(parsed));
    }
  };

  const handleCustomBlur = () => {
    const parsed = Number.parseInt(customText, 10);
    const next = Number.isNaN(parsed) || parsed < min ? fallback : clamp(parsed);
    setCustomText(String(next));
    onValueChange(next);
  };

  const handleEnableCustom = () => {
    const next = value > 0 && !isPreset ? value : fallback;
    setCustomText(String(next));
    onValueChange(next);
  };

  const columns = presets.length + 1;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-text-primary">{label}</Label>
        <span className="text-xs font-medium text-primary">{summary}</span>
      </div>

      <div className={cn("grid grid-cols-3 gap-2", COLUMN_CLASS[columns])}>
        {presets.map((preset) => {
          const selected = !isCustom && value === preset;
          return (
            <button
              key={preset}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onValueChange(preset)}
              className={cn(
                optionRowClass(selected),
                "flex h-9 items-center justify-center gap-1.5 text-center text-sm",
                selected ? "font-semibold" : "font-medium",
              )}
            >
              {presetLabel ? presetLabel(preset) : preset}
            </button>
          );
        })}

        {isCustom ? (
          <div className="relative flex h-9 items-center">
            <input
              type="number"
              min={min}
              max={max}
              value={customText}
              onChange={(event) => handleCustomChange(event.target.value)}
              onBlur={handleCustomBlur}
              placeholder={`${min}-${max}`}
              aria-label={customAriaLabel}
              className={countInputClass}
              disabled={disabled}
              autoFocus
            />
          </div>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={handleEnableCustom}
            className={cn(
              optionRowClass(false),
              "flex h-9 items-center justify-center gap-1.5 text-center text-sm font-medium",
            )}
          >
            {t("actions.custom")}
          </button>
        )}
      </div>
    </div>
  );
}
