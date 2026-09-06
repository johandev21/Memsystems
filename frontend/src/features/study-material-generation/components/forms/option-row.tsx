import { cn } from "@/shared/utils/cn";

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
    "cursor-pointer rounded-2xl border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    selected
      ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
      : "border-surface-border-subtle bg-surface-2 text-text-tertiary hover:bg-surface-3",
    className,
  );
}

/**
 * Knowledge-source option row inside the generation source popovers
 * (Quiz / Flashcards / Mind Map / Roadmap brief forms).
 */
export function generationSourceOptionClass(selected: boolean, className?: string) {
  return cn(
    "flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors",
    selected
      ? "bg-primary font-medium text-primary-foreground"
      : "text-text-tertiary hover:bg-surface-2",
    className,
  );
}

/**
 * Leading icon tone for a knowledge-source option row.
 */
export function generationSourceIconClass(checked: boolean, className?: string) {
  return cn("size-4 shrink-0", checked ? "text-primary-foreground" : "text-primary", className);
}

/**
 * Checkbox tone for a selected knowledge-source option row.
 *
 * The box is inverted (primary-foreground on a primary row) so it stays
 * visible on the solid selected background. The `dark:` counterparts are
 * required: the base Checkbox ships `dark:data-checked:bg-primary`, which
 * has higher specificity than a bare `data-checked:` rule and would
 * otherwise repaint the box with the row color in dark mode (invisible
 * checkbox + invisible check). Matching the variant stack lets tailwind-merge
 * drop the base dark rule instead of fighting it in the cascade.
 */
export function generationSourceCheckboxClass(selected: boolean, className?: string) {
  return cn(
    selected &&
      "border-primary-foreground/40 data-checked:border-primary-foreground data-checked:bg-primary-foreground data-checked:text-primary dark:border-primary-foreground/60 dark:data-checked:border-primary-foreground dark:data-checked:bg-primary-foreground dark:data-checked:text-primary",
    className,
  );
}
