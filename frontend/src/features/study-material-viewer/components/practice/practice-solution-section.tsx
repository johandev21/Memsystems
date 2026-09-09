import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  HelpCircle,
  Lock,
  MessageSquare,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/ui/markdown";
import type { Source } from "@/features/sources";
import { cn } from "@/shared/utils/cn";

export function AttemptFeedbackCard({
  evaluation,
}: {
  evaluation: {
    status: string;
    feedback: string;
    strengths: string[];
    missingPoints: string[];
  };
}) {
  return (
    <div
      className={cn(
        "mt-4 rounded-xl border p-5 space-y-4 transition-all",
        evaluation.status === "correct"
          ? "bg-emerald-500/10 border-emerald-500/30"
          : evaluation.status === "partially_correct"
            ? "bg-amber-500/10 border-amber-500/30"
            : "bg-rose-500/10 border-rose-500/30",
      )}
    >
      <div className="flex items-center gap-2">
        {evaluation.status === "correct" && (
          <>
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-xs font-semibold">
              Correct
            </Badge>
          </>
        )}
        {evaluation.status === "partially_correct" && (
          <>
            <AlertCircle className="h-5 w-5 text-amber-400" />
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-xs font-semibold">
              Partially Correct
            </Badge>
          </>
        )}
        {evaluation.status === "needs_improvement" && (
          <>
            <XCircle className="h-5 w-5 text-rose-400" />
            <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/40 text-xs font-semibold">
              Needs Revision
            </Badge>
          </>
        )}
      </div>

      <div className="text-sm text-text-primary leading-relaxed">
        <MarkdownRenderer>{evaluation.feedback}</MarkdownRenderer>
      </div>

      {evaluation.strengths.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <h5 className="text-sm font-semibold text-text-primary">Key Strengths</h5>
          <ul className="list-disc list-inside space-y-1 text-sm text-text-secondary">
            {evaluation.strengths.map((str) => (
              <li key={str}>{str}</li>
            ))}
          </ul>
        </div>
      )}

      {evaluation.missingPoints.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <h5 className="text-sm font-semibold text-text-primary">Areas for Improvement</h5>
          <ul className="list-disc list-inside space-y-1 text-sm text-text-secondary">
            {evaluation.missingPoints.map((missing) => (
              <li key={missing}>{missing}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function HintsSection({
  hints,
  hintsRevealed,
  showCount,
  onRevealNext,
  onAskSocratic,
}: {
  hints: string[];
  hintsRevealed: number;
  showCount: boolean;
  onRevealNext: () => void;
  onAskSocratic: () => void;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="space-y-0.5">
          <h3 className="text-base font-semibold text-text-primary">Hints</h3>
          {showCount && (
            <span className="text-xs text-text-secondary">
              {Math.min(hintsRevealed, hints.length)} of {hints.length} hints revealed
            </span>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onAskSocratic}
          className="self-start text-xs text-text-secondary hover:text-text-primary gap-1.5"
          title="Ask AI in chat for a Socratic hint without revealing the solution"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          Ask for Socratic Hint in Chat
        </Button>
      </div>

      <div className="space-y-2.5">
        {hints.map((hint, idx) => {
          const isRevealed = idx < hintsRevealed;
          if (!isRevealed) return null;
          return (
            <div
              key={hint}
              className="rounded-xl border border-surface-border-subtle bg-surface-2 p-4 text-sm text-text-secondary space-y-1"
            >
              <span className="text-xs font-semibold text-text-secondary">Hint {idx + 1}</span>
              <p>{hint}</p>
            </div>
          );
        })}

        {hintsRevealed < hints.length && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRevealNext}
            className="mt-2 text-xs text-text-secondary hover:text-text-primary"
          >
            Reveal hint {hintsRevealed + 1} of {hints.length}
          </Button>
        )}
      </div>
    </section>
  );
}

export function SolutionSection({
  difficulty,
  isRevealed,
  answer,
  steps,
  sourceMap,
  onToggleReveal,
  onGiveUp,
  onExplainStep,
  onOpenSource,
}: {
  difficulty: string;
  isRevealed: boolean;
  answer: string;
  steps: Array<{ id: string; title: string; explanation: string; sourceIds: string[] }>;
  sourceMap: Map<string, Source>;
  onToggleReveal: () => void;
  onGiveUp: () => void;
  onExplainStep: (stepNumber: number, title: string, explanation: string) => void;
  onOpenSource: (id: string) => void;
}) {
  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-text-primary">Solution</h3>

        {difficulty === "medium" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onToggleReveal}
            className="gap-1.5 text-xs text-text-secondary hover:text-text-primary"
          >
            {isRevealed ? (
              <>
                <EyeOff className="h-3.5 w-3.5" />
                Hide Solution
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5" />
                Reveal Full Solution
              </>
            )}
          </Button>
        )}
      </div>

      {difficulty === "hard" && !isRevealed ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-400 font-medium text-sm">
            <Lock className="h-4 w-4" />
            Challenge Mode: Solution Locked
          </div>
          <p className="text-sm text-text-secondary">
            In Challenge mode, the reference solution unlocks once you evaluate your answer with AI.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onGiveUp}
            className="text-xs text-text-secondary hover:text-text-primary"
          >
            Give up and reveal solution
          </Button>
        </div>
      ) : null}

      {difficulty === "medium" && !isRevealed ? (
        <p className="text-sm text-text-secondary">
          The solution is hidden to give you time to think and write your own attempt.
        </p>
      ) : null}

      {isRevealed && (
        <div className="space-y-6 pt-1">
          <div className="rounded-xl border border-surface-border-subtle bg-surface-2 p-5 space-y-2">
            <h4 className="text-sm font-semibold text-text-primary">Reference Answer</h4>
            <div className="text-base text-text-primary leading-relaxed font-medium">
              <MarkdownRenderer>{answer}</MarkdownRenderer>
            </div>
          </div>

          {steps.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-text-primary">Worked Steps</h4>

              <div className="space-y-3">
                {steps.map((step, sIdx) => (
                  <div
                    key={step.id}
                    className="rounded-xl border border-surface-border-subtle bg-surface-2 p-4 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <h5 className="text-sm font-semibold text-text-primary">
                        Step {sIdx + 1}: {step.title}
                      </h5>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onExplainStep(sIdx + 1, step.title, step.explanation)}
                        className="self-start text-xs text-text-secondary hover:text-text-primary gap-1"
                        title="Ask AI in chat to explain this step"
                      >
                        <MessageSquare className="h-3 w-3" />
                        Explain this step in Chat
                      </Button>
                    </div>

                    <div className="text-sm text-text-secondary leading-relaxed">
                      <MarkdownRenderer>{step.explanation}</MarkdownRenderer>
                    </div>

                    {step.sourceIds.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-xs text-text-secondary">Step Sources:</span>
                        {step.sourceIds.map((srcId) => {
                          const src = sourceMap.get(srcId);
                          return (
                            <Button
                              key={srcId}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => onOpenSource(srcId)}
                              className="h-6 px-2 text-xs text-text-secondary hover:text-text-primary"
                            >
                              {src?.title || "Source unavailable"}
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
