import { Label } from "@/components/ui/label";
import { cn } from "@/shared/utils/cn";
import { optionRowClass } from "./option-row";

const COLUMN_CLASS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
};

/**
 * Radio-card field shared by the generation dialogs. Cards match the Quiz
 * difficulty cards: title on top, description below, solid primary when
 * selected. Include an `"auto"` option to let the model choose.
 */
export function BriefChoiceField<T extends string>({
  label,
  options,
  value,
  onChange,
  columns = 2,
  disabled = false,
}: {
  label: string;
  options: readonly { id: T; title: string; desc: string }[];
  value: T;
  onChange: (value: T) => void;
  columns?: 2 | 3 | 4;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium text-text-primary">{label}</Label>
      <div className={cn("grid gap-2", COLUMN_CLASS[columns])}>
        {options.map((opt) => {
          const selected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange(opt.id)}
              className={cn(
                optionRowClass(selected),
                "flex flex-col justify-between gap-1.5 p-3 text-left",
              )}
            >
              <span
                className={cn(
                  "text-sm font-semibold",
                  selected ? "text-primary-foreground" : "text-text-tertiary",
                )}
              >
                {opt.title}
              </span>
              <span
                className={cn(
                  "text-xs leading-tight",
                  selected ? "text-primary-foreground/80" : "text-text-faint",
                )}
              >
                {opt.desc}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
