import { useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MarkdownRenderer } from "@/components/ui/markdown";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { sourcesQueryOptions, type Source } from "@/features/sources";
import { cn } from "@/shared/utils/cn";
import {
  PracticeProblemsContent,
  type PracticeProblemsContentType,
  type PracticeProblemsDifficulty,
} from "../shapes/practice-problems";
import { usePracticeProblemsSession } from "./usePracticeProblemsSession";
import { useModelPersistence } from "@/features/notebooks/hooks/use-model-persistence";

interface PracticeProblemsViewProps {
  materialId: string;
  content: unknown;
  notebookId: string;
  onOpenSource?: () => void;
  onClose?: () => void;
  registerBeforeClose?: (fn: () => boolean) => void;
}

const SEND_CHAT_PROMPT_EVENT = "send-chat-prompt";

function dispatchChatPrompt(promptText: string): void {
  window.dispatchEvent(
    new CustomEvent(SEND_CHAT_PROMPT_EVENT, {
      detail: { prompt: promptText, autoSend: false, focusChat: true },
    }),
  );
}

export function PracticeProblemsView({
  materialId,
  content,
  notebookId,
  onOpenSource,
  onClose,
  registerBeforeClose,
}: PracticeProblemsViewProps) {
  const parsed = PracticeProblemsContent.safeParse(content);
  if (!parsed.success) {
    return (
      <p role="alert" className="p-6 text-sm text-text-secondary">
        These practice problems could not be read. Try reopening them or generating a new set.
      </p>
    );
  }

  return (
    <PracticeProblemsReader
      set={parsed.data}
      materialId={materialId}
      notebookId={notebookId}
      onOpenSource={onOpenSource}
      onClose={onClose}
      registerBeforeClose={registerBeforeClose}
    />
  );
}

function usePracticeChatPrompts(currentProblem: {
  prompt: string;
  givens: string[];
  constraints: string[];
}) {
  const handleDiscussInChat = useCallback(() => {
    const givensText =
      currentProblem.givens.length > 0
        ? `\nGivens:\n${currentProblem.givens.map((g) => `- ${g}`).join("\n")}`
        : "";
    const constraintsText =
      currentProblem.constraints.length > 0
        ? `\nConstraints:\n${currentProblem.constraints.map((c) => `- ${c}`).join("\n")}`
        : "";
    dispatchChatPrompt(
      `I'm working on this practice problem and would like to discuss it:\n\n**Problem:**\n${currentProblem.prompt}\n${givensText}${constraintsText}\n\nCan you help me understand the core concepts and guide me on how to approach solving it?`,
    );
  }, [currentProblem]);

  const handleAskSocraticHint = useCallback(() => {
    dispatchChatPrompt(
      `I'm working on this practice problem and I'm feeling a bit stuck:\n\n**Problem:**\n${currentProblem.prompt}\n\nWithout giving away the complete answer or worked steps, could you give me a Socratic hint or guiding question to help me figure out the next step myself?`,
    );
  }, [currentProblem]);

  const handleExplainStepInChat = useCallback(
    (stepNumber: number, title: string, explanation: string) => {
      dispatchChatPrompt(
        `I'm reviewing the worked steps for this practice problem:\n\n**Problem:**\n${currentProblem.prompt}\n\n**Step ${stepNumber}: ${title}**\n${explanation}\n\nCan you explain this step in more detail, clarify why this method was chosen, and walk me through the reasoning?`,
      );
    },
    [currentProblem],
  );
  return { handleDiscussInChat, handleAskSocraticHint, handleExplainStepInChat };
}

function PracticeStepperHeader({
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

function ProblemStatementSection({
  activeIdx,
  prompt,
  givens,
  constraints,
  checklist,
  acceptableAlternatives,
  sourceIds,
  setSourceIds,
  sourceMap,
  onOpenSource,
  onDiscussInChat,
}: {
  activeIdx: number;
  prompt: string;
  givens: string[];
  constraints: string[];
  checklist: string[];
  acceptableAlternatives: string[];
  sourceIds: string[];
  setSourceIds: string[];
  sourceMap: Map<string, Source>;
  onOpenSource: (id: string) => void;
  onDiscussInChat: () => void;
}) {
  return (
    <section className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1.5 flex-1">
          <span className="text-sm font-medium text-text-secondary">Problem {activeIdx + 1}</span>
          <div className="text-lg md:text-xl font-semibold text-text-primary leading-relaxed">
            <MarkdownRenderer>{prompt}</MarkdownRenderer>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDiscussInChat}
          className="self-start text-xs text-text-secondary hover:text-text-primary shrink-0 gap-1.5"
          title="Discuss this problem in notebook chat"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Discuss in Chat
        </Button>
      </div>

      {(givens.length > 0 ||
        constraints.length > 0 ||
        checklist.length > 0 ||
        acceptableAlternatives.length > 0) && (
        <div className="rounded-xl border border-surface-border-subtle bg-surface-2 p-5 space-y-5 text-sm">
          {givens.length > 0 && (
            <div>
              <h4 className="font-medium text-text-primary mb-1.5">Givens</h4>
              <ul className="list-disc list-inside space-y-1 text-text-secondary">
                {givens.map((given) => (
                  <li key={given}>{given}</li>
                ))}
              </ul>
            </div>
          )}

          {constraints.length > 0 && (
            <div>
              <h4 className="font-medium text-text-primary mb-1.5">Constraints</h4>
              <ul className="list-disc list-inside space-y-1 text-text-secondary">
                {constraints.map((constraint) => (
                  <li key={constraint}>{constraint}</li>
                ))}
              </ul>
            </div>
          )}

          {checklist.length > 0 && (
            <div>
              <h4 className="font-medium text-text-primary mb-1.5">Verification Checklist</h4>
              <ul className="list-disc list-inside space-y-1 text-text-secondary">
                {checklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {acceptableAlternatives.length > 0 && (
            <div>
              <h4 className="font-medium text-text-primary mb-1.5">Acceptable Alternatives</h4>
              <ul className="list-disc list-inside space-y-1 text-text-secondary">
                {acceptableAlternatives.map((alt) => (
                  <li key={alt}>{alt}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {sourceIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-xs text-text-secondary">Sources:</span>
          {sourceIds.map((srcId) => {
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
      {setSourceIds.length === 0 && sourceIds.length === 0 && (
        <p className="text-xs text-text-secondary pt-1">Generated without notebook sources.</p>
      )}
    </section>
  );
}

function AttemptFeedbackCard({
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

function HintsSection({
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

function SolutionSection({
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

function AttemptSection({
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

const DIFFICULTY_LABELS: Record<PracticeProblemsDifficulty, { label: string; className: string }> =
  {
    easy: {
      label: "Warmup",
      className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    },
    medium: { label: "Standard", className: "bg-primary/15 text-primary border-primary/30" },
    hard: { label: "Challenge", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  };

function PracticeProblemsReader({
  set,
  materialId,
  notebookId,
  onOpenSource,
  onClose,
  registerBeforeClose,
}: {
  set: PracticeProblemsContentType;
  materialId: string;
  notebookId: string;
  onOpenSource?: () => void;
  onClose?: () => void;
  registerBeforeClose?: (fn: () => boolean) => void;
}) {
  const { model: selectedModel } = useModelPersistence(notebookId);
  const {
    activeIdx,
    totalProblems,
    currentProblem,
    currentState,
    difficulty,
    hasUnsavedWork,
    confirmExitOpen,
    setAnswer,
    revealNextHint,
    revealSolution,
    hideSolution,
    giveUpAndReveal,
    evaluateAnswer,
    nextProblem,
    prevProblem,
    goToProblem,
    requestClose,
    confirmExit,
    cancelExit,
  } = usePracticeProblemsSession(materialId, set, onClose, selectedModel);

  // Wire up close interceptor with parent viewer
  useEffect(() => {
    if (registerBeforeClose) {
      registerBeforeClose(() => {
        if (hasUnsavedWork) {
          requestClose();
          return false;
        }
        return true;
      });
      return () => {
        registerBeforeClose(() => true);
      };
    }
  }, [registerBeforeClose, hasUnsavedWork, requestClose]);

  const hasReferences = set.problems.some(
    (p) => p.sourceIds.length > 0 || p.steps.some((s) => s.sourceIds.length > 0),
  );
  const sources = useQuery({ ...sourcesQueryOptions(notebookId), enabled: hasReferences });

  const sourceMap = useMemo(() => {
    const map = new Map<string, Source>();
    if (sources.data) {
      for (const s of sources.data) map.set(s.id, s);
    }
    return map;
  }, [sources.data]);

  const handleOpenSource = useCallback(
    (sourceId: string) => {
      window.dispatchEvent(new CustomEvent("open-source-viewer", { detail: { sourceId } }));
      onOpenSource?.();
    },
    [onOpenSource],
  );

  const { handleDiscussInChat, handleAskSocraticHint, handleExplainStepInChat } =
    usePracticeChatPrompts(currentProblem);

  const difficultyConfig = DIFFICULTY_LABELS[difficulty] ?? DIFFICULTY_LABELS.medium;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface-1 text-text-primary">
      <PracticeStepperHeader
        difficultyClassName={difficultyConfig.className}
        difficultyLabel={difficultyConfig.label}
        activeIdx={activeIdx}
        totalProblems={totalProblems}
        problems={set.problems}
        onGoToProblem={goToProblem}
        onPrev={prevProblem}
        onNext={nextProblem}
      />

      <main className="flex-1 px-4 py-8 sm:px-6 md:py-10">
        <div className="mx-auto max-w-4xl space-y-10 md:space-y-12">
          <ProblemStatementSection
            activeIdx={activeIdx}
            prompt={currentProblem.prompt}
            givens={currentProblem.givens}
            constraints={currentProblem.constraints}
            checklist={currentProblem.checklist}
            acceptableAlternatives={currentProblem.acceptableAlternatives}
            sourceIds={currentProblem.sourceIds}
            setSourceIds={set.sourceIds}
            sourceMap={sourceMap}
            onOpenSource={handleOpenSource}
            onDiscussInChat={handleDiscussInChat}
          />

          <AttemptSection
            studentAnswer={currentState.studentAnswer}
            isEvaluating={currentState.isEvaluating}
            evaluation={currentState.evaluation}
            evaluationError={currentState.evaluationError}
            difficulty={difficulty}
            isSolutionRevealed={currentState.isSolutionRevealed}
            onAnswerChange={(v) => setAnswer(currentProblem.id, v)}
            onEvaluate={() => evaluateAnswer(currentProblem.id)}
            onGiveUp={() => giveUpAndReveal(currentProblem.id)}
          />

          {difficulty !== "hard" && currentProblem.hints.length > 0 && (
            <HintsSection
              hints={difficulty === "easy" ? currentProblem.hints : currentProblem.hints}
              hintsRevealed={
                difficulty === "easy" ? currentProblem.hints.length : currentState.hintsRevealed
              }
              showCount={difficulty === "medium"}
              onRevealNext={() => revealNextHint(currentProblem.id)}
              onAskSocratic={handleAskSocraticHint}
            />
          )}

          <SolutionSection
            difficulty={difficulty}
            isRevealed={currentState.isSolutionRevealed}
            answer={currentProblem.answer}
            steps={currentProblem.steps}
            sourceMap={sourceMap}
            onToggleReveal={() =>
              currentState.isSolutionRevealed
                ? hideSolution(currentProblem.id)
                : revealSolution(currentProblem.id)
            }
            onGiveUp={() => giveUpAndReveal(currentProblem.id)}
            onExplainStep={handleExplainStepInChat}
            onOpenSource={handleOpenSource}
          />
        </div>
      </main>

      {/* Exit Warning Dialog */}
      <AlertDialog open={confirmExitOpen} onOpenChange={(open) => !open && cancelExit()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Practice Session?</AlertDialogTitle>
            <AlertDialogDescription>
              You have answers or evaluations in this session. If you leave now, your session
              progress will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelExit}>Stay and Practice</AlertDialogCancel>
            <AlertDialogAction onClick={confirmExit} variant="destructive">
              Leave Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
