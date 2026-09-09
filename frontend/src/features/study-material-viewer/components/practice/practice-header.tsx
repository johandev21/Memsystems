import { ChevronLeft, ChevronRight } from "lucide-react";
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
  return (
    <div className="sticky top-0 z-10 bg-surface-1/95 backdrop-blur-sm px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <Badge variant="outline" className={cn("text-xs font-medium", difficultyClassName)}>
            {difficultyLabel}
          </Badge>
          <span className="text-sm font-medium text-text-secondary">
            Problem {activeIdx + 1} of {totalProblems}
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
                  title={`Go to problem ${idx + 1}`}
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
              title="Previous problem"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Previous</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onNext}
              disabled={activeIdx === totalProblems - 1}
              className="h-8 px-2.5 text-xs text-text-secondary hover:text-text-primary"
              title="Next problem"
            >
              <span className="hidden sm:inline mr-1">Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
