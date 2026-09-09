import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AttemptFeedbackCard } from "./practice-solution-section";

export function AttemptSection({
  studentAnswer,
  isEvaluating,
  evaluation,
  evaluationError,
  difficulty,
  isSolutionRevealed,
  onAnswerChange,
  onEvaluate,
  onGiveUp,
}: {
  studentAnswer: string;
  isEvaluating: boolean;
  evaluation: { status: string; feedback: string; strengths: string[]; missingPoints: string[] } | null | undefined;
  evaluationError?: string | null;
  difficulty: string;
  isSolutionRevealed: boolean;
  onAnswerChange: (v: string) => void;
  onEvaluate: () => void;
  onGiveUp: () => void;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <label htmlFor="student-attempt-input" className="text-base font-semibold text-text-primary">
          Your Attempt
        </label>
        {evaluation && <span className="text-xs text-text-secondary">Evaluated with AI</span>}
      </div>

      <Textarea
        id="student-attempt-input"
        aria-label="Your attempt"
        value={studentAnswer}
        onChange={(e) => onAnswerChange(e.target.value)}
        placeholder="Write your solution, calculations, or reasoning here..."
        className="min-h-[140px] text-base leading-relaxed resize-y border-surface-border bg-surface-2 focus-visible:border-surface-border-strong"
      />

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onEvaluate}
            disabled={isEvaluating || !studentAnswer.trim()}
            className="gap-2 cursor-pointer"
          >
            {isEvaluating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Evaluating with AI...
              </>
            ) : (
              <>{evaluation ? "Re-evaluate" : "Evaluate answer"}</>
            )}
          </Button>

          {difficulty === "hard" && !isSolutionRevealed && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onGiveUp}
              className="text-xs text-text-secondary hover:text-text-primary"
            >
              Give up and reveal solution
            </Button>
          )}
        </div>

        {evaluationError && <p className="text-xs text-destructive">{evaluationError}</p>}
      </div>

      {evaluation && <AttemptFeedbackCard evaluation={evaluation} />}
    </section>
  );
}
