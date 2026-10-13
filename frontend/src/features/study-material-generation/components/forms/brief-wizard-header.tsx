import { cn } from "@/shared/utils/cn";
import { useTranslation } from "react-i18next";

export function BriefWizardHeader({
  title,
  step,
  totalSteps,
  onStepChange,
}: {
  title: string;
  step: number;
  totalSteps: number;
  onStepChange: (step: number) => void;
}) {
  const { t } = useTranslation("generation");

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 font-medium text-text-primary">
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {t("wizard.stepOf", { step, total: totalSteps })}
        </span>
      </div>
      <div
        className="grid gap-2 grid-cols-(--wizard-steps)"
        style={{ "--wizard-steps": `repeat(${totalSteps}, minmax(0, 1fr))` } as React.CSSProperties}
      >
        {Array.from({ length: totalSteps }, (_, index) => (
          <button
            key={index + 1}
            type="button"
            aria-label={t("wizard.stepAria", { step: index + 1 })}
            onClick={() => onStepChange(index + 1)}
            className={cn(
              "h-1.5 rounded-full transition-all cursor-pointer p-0 border-0 touch-manipulation active:scale-95",
              index < step ? "bg-primary" : "bg-surface-4",
            )}
          />
        ))}
      </div>
    </div>
  );
}
