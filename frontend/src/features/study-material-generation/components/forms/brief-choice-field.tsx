import { Label } from "@/components/ui/label";
import { cn } from "@/shared/utils/cn";
import { optionRowClass } from "./option-row";

export function BriefChoiceField<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { id: T; title: string; desc: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium text-text-primary">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => {
          const selected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(opt.id)}
              className={cn(
                optionRowClass(selected),
                "p-3 flex items-start gap-3 cursor-pointer text-left",
              )}
            >
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold">{opt.title}</span>
                <span className="block text-sm leading-tight opacity-80">{opt.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
