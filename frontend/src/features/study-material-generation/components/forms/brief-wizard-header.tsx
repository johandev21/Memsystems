import { Badge } from "@/components/ui/badge";
import { cn } from "@/shared/utils/cn";
import { useTranslation } from "react-i18next";

export function BriefWizardHeader({
  title,
  step,
  onStepChange,
}: {
  title: string;
  step: 1 | 2;
  onStepChange: (step: 1 | 2) => void;
}) {
  const { t } = useTranslation("generation");

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 font-medium text-text-primary">
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <Badge variant="outline" className="text-sm font-normal">
          {t("wizard.stepOfTwo", { step })}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          aria-label={t("wizard.stepAria", { step: 1 })}
          onClick={() => onStepChange(1)}
          className={cn(
            "h-1.5 rounded-full transition-all cursor-pointer p-0 border-0",
            step >= 1 ? "bg-primary" : "bg-surface-4",
          )}
        />
        <button
          type="button"
          aria-label={t("wizard.stepAria", { step: 2 })}
          onClick={() => onStepChange(2)}
          className={cn(
            "h-1.5 rounded-full transition-all cursor-pointer p-0 border-0",
            step === 2 ? "bg-primary" : "bg-surface-4",
          )}
        />
      </div>
    </div>
  );
}
