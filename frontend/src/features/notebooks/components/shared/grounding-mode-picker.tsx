import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/cn";
import { GROUNDING_MODES, type GroundingMode } from "../../model/grounding-mode";

export interface GroundingModePickerProps {
  value: GroundingMode;
  onChange: (mode: GroundingMode) => void;
  disabled?: boolean;
  /** "compact" renders a segmented control; "full" adds the one-line descriptions. */
  variant?: "compact" | "full";
  className?: string;
}

export function GroundingModePicker({
  value,
  onChange,
  disabled = false,
  variant = "compact",
  className,
}: GroundingModePickerProps) {
  const { t } = useTranslation("notebooks");

  if (variant === "full") {
    return (
      <div className={cn("flex flex-col gap-1", className)} role="radiogroup" aria-label={t("groundingMode.label")}>
        {GROUNDING_MODES.map((mode) => {
          const selected = mode === value;
          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(mode)}
              className={cn(
                "flex cursor-pointer flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left transition-colors",
                selected
                  ? "border-primary bg-primary/10"
                  : "border-surface-border hover:bg-popover-hover",
              )}
            >
              <span className="text-sm font-medium text-text-primary">
                {t(`groundingMode.${mode}`)}
              </span>
              <span className="text-xs text-text-secondary">
                {t(`groundingMode.descriptions.${mode}`)}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={cn("flex rounded-xl border border-surface-border p-0.5", className)}
      role="group"
      aria-label={t("groundingMode.label")}
    >
      {GROUNDING_MODES.map((mode) => {
        const selected = mode === value;
        return (
          <button
            key={mode}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(mode)}
            className={cn(
              "flex-1 cursor-pointer rounded-lg px-2 py-1 text-xs font-medium transition-colors",
              selected ? "bg-primary/15 text-text-primary" : "text-text-secondary hover:text-text-primary",
            )}
          >
            {t(`groundingMode.${mode}`)}
          </button>
        );
      })}
    </div>
  );
}
