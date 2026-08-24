import { cn } from "@/shared/lib/utils";

/**
 * Shared surface-ladder class strings for the generation dialog forms.
 * See docs/design/study-materials-ladder-spec.md §2.
 */

/** Primary CTA button (submit / next-step) resting on the dialog surface. */
export const CTA_BUTTON_CLASS =
  "border border-surface-border-subtle bg-surface-2 text-text-primary hover:bg-surface-3 hover:text-text-secondary disabled:bg-surface-2 disabled:text-text-faint";

/**
 * Option row / preset chip tones (difficulty pickers, count presets,
 * card-style radios, detail cards).
 */
export function optionRowClass(selected: boolean, className?: string) {
  return cn(
    "cursor-pointer rounded-2xl border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-border-strong",
    selected
      ? "border-surface-border bg-surface-3 text-text-secondary"
      : "border-surface-border-subtle bg-surface-2 text-text-tertiary hover:bg-surface-3",
    className,
  );
}
