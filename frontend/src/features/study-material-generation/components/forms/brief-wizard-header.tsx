import { Badge } from "@/components/ui/badge";
import { cn } from "@/shared/utils/cn";

export function BriefWizardHeader({
  title,
  step,
  onStepChange,
}: {
  title: string;
  step: 1 | 2;
  onStepChange: (step: 1 | 2) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 font-medium text-text-primary">
          <span className="text-sm font-semibold">{title}</span>
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
