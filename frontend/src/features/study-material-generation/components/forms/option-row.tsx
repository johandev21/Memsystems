import { cn } from "@/shared/utils/cn";

export function optionRowClass(selected: boolean, className?: string) {
  return cn(
    "cursor-pointer rounded-2xl border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    selected
      ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
      : "border-surface-border-subtle bg-surface-2 text-text-tertiary hover:bg-surface-3",
    className,
  );
}

export function generationSourceOptionClass(selected: boolean, className?: string) {
  return cn(
    "flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors",
    selected
      ? "bg-primary font-medium text-primary-foreground"
      : "text-text-tertiary hover:bg-surface-2",
    className,
  );
}

export function generationSourceIconClass(checked: boolean, className?: string) {
  return cn("size-4 shrink-0", checked ? "text-primary-foreground" : "text-primary", className);
}

export function generationSourceCheckboxClass(selected: boolean, className?: string) {
  return cn(
    selected &&
      "border-primary-foreground/40 data-checked:border-primary-foreground data-checked:bg-primary-foreground data-checked:text-primary dark:border-primary-foreground/60 dark:data-checked:border-primary-foreground dark:data-checked:bg-primary-foreground dark:data-checked:text-primary",
    className,
  );
}
