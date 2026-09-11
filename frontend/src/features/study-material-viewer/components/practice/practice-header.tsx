import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/shared/utils/cn";


export function PracticeStepperHeader({
  difficultyClassName,
  difficultyLabel,
  activeIdx,
  totalProblems,
  problems,
  onGoToProblem,
  onPrev,
  onNext,
}: {
  difficultyClassName: string;
  difficultyLabel: string;
  activeIdx: number;
  totalProblems: number;
  problems: Array<{ id: string }>;
  onGoToProblem: (idx: number) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { t } = useTranslation("viewer");

  return (
    <div className="sticky top-0 z-10 bg-surface-1/95 backdrop-blur-sm px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <Badge variant="outline" className={cn("text-xs font-medium", difficultyClassName)}>
            {difficultyLabel}
          </Badge>
          <span className="text-sm font-medium text-text-secondary">
            {t("practice.problemOf", { current: activeIdx + 1, total: totalProblems })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 overflow-x-auto py-1">
            {problems.map((prob, idx) => {
              const isActive = idx === activeIdx;
              return (
                <button
                  key={prob.id}
                  type="button"
                  onClick={() => onGoToProblem(idx)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-all cursor-pointer border",
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs border-transparent"
                      : "bg-surface-2 border-surface-border-subtle text-text-secondary hover:bg-surface-3 hover:text-text-primary",
                  )}
                  title={t("practice.goToProblem", { number: idx + 1 })}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 pl-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onPrev}
              disabled={activeIdx === 0}
              className="h-8 px-2.5 text-xs text-text-secondary hover:text-text-primary"
              title={t("practice.previousProblem")}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">{t("common.previous")}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onNext}
              disabled={activeIdx === totalProblems - 1}
              className="h-8 px-2.5 text-xs text-text-secondary hover:text-text-primary"
              title={t("practice.nextProblem")}
            >
              <span className="hidden sm:inline mr-1">{t("common.next")}</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
