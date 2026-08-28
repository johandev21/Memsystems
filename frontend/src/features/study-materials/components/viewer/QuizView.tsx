import { useState, useEffect, useCallback, useMemo } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  XCircle,
  Sparkles,
  RotateCcw,
  Check,
  ArrowLeft,
  BookOpen,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/ui/dialog";
import { cn } from "@/shared/lib/utils";

// -----------------------------------------------------------------------------
// 1. Types & Interfaces
// -----------------------------------------------------------------------------

export interface QuizQuestionOption {
  id: string;
  text: string;
  explanation: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: QuizQuestionOption[];
  correctOptionId: string;
  hint?: string;
  topic?: string;
}

export interface QuizViewProps {
  content: {
    title?: string;
    questions: QuizQuestion[];
  };
}

type ViewMode = "active" | "summary" | "review";

function EmptyQuizState() {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center text-text-tertiary">
      <AlertCircle className="size-8 mb-2 text-warning" />
      <p>No quiz questions available.</p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 2. Helper Functions
// -----------------------------------------------------------------------------

/**
 * Resolves the correct option by its stable ID so answer order can change safely.
 */
function getCorrectOptionIndex(q: QuizQuestion): number {
  return q.options.findIndex((option) => option.id === q.correctOptionId);
}

function formatExplanationText(explanation: string): string {
  if (!explanation) return "";
  const cleaned = explanation
    .replace(/^(correct|incorrect|not quite|right answer)[.:!\s]*/i, "")
    .trim();
  return cleaned || explanation;
}

function handleExplainInChat(question: QuizQuestion, selectedIdx: number | undefined) {
  const correctIdx = getCorrectOptionIndex(question);
  const selectedOption = selectedIdx !== undefined ? question.options[selectedIdx] : null;
  const correctOption = question.options[correctIdx];
  const isCorrect = selectedIdx === correctIdx;

  const promptText = `I'm reviewing a quiz question and would like a deeper explanation of the concepts.

Question: ${question.prompt}
${
  selectedOption
    ? `My Selected Answer: "${selectedOption.text}" (${isCorrect ? "Correct" : "Incorrect"})`
    : "No answer selected"
}
Correct Answer: "${correctOption.text}"
${
  selectedOption?.explanation
    ? `Provided Explanation: "${formatExplanationText(selectedOption.explanation)}"`
    : `Correct Explanation: "${formatExplanationText(correctOption.explanation)}"`
}

Please explain why "${correctOption.text}" is correct${
    selectedOption && !isCorrect ? `, why "${selectedOption.text}" was incorrect` : ""
  }, and break down the underlying concepts in detail.`;

  window.dispatchEvent(
    new CustomEvent("send-chat-prompt", {
      detail: { prompt: promptText, autoSend: true },
    }),
  );
}

// -----------------------------------------------------------------------------
// 3. Sub-Components
// -----------------------------------------------------------------------------

/**
 * Donut Score Indicator with smooth SVG ring animation & dark/light support
 */
function ScoreDonut({
  percent,
  correctCount,
  totalQuestions,
}: {
  percent: number;
  correctCount: number;
  totalQuestions: number;
}) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;
  const wrongCount = totalQuestions - correctCount;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-6 rounded-3xl bg-surface-2 border border-surface-border">
      <div className="flex items-center gap-6">
        <div className="relative size-32 flex items-center justify-center shrink-0">
          <svg className="size-full -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r={radius}
              className="stroke-surface-4 fill-none"
              strokeWidth="10"
            />
            <circle
              cx="60"
              cy="60"
              r={radius}
              className="stroke-success fill-none transition-all duration-700 ease-out"
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-xl font-extrabold text-text-primary leading-none">
              {correctCount}/{totalQuestions}
            </span>
            <span className="text-xs font-semibold text-success mt-1">{percent}%</span>
          </div>
        </div>

        <div className="flex flex-col justify-center gap-2 text-sm">
          <div className="flex items-center gap-3">
            <span className="size-2.5 rounded-full bg-success shrink-0" />
            <span className="text-text-tertiary font-medium">Right</span>
            <span className="font-bold text-success ml-4">{correctCount}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="size-2.5 rounded-full bg-destructive shrink-0" />
            <span className="text-text-tertiary font-medium">Wrong</span>
            <span className="font-bold text-text-primary ml-4">{wrongCount}</span>
          </div>
        </div>
      </div>

      <div className="text-right hidden sm:block">
        <Badge
          variant="outline"
          className={cn(
            "px-3 py-1 text-xs font-semibold rounded-full",
            percent >= 70
              ? "border-success bg-success/10 text-success"
              : "border-warning bg-warning/10 text-warning",
          )}
        >
          {percent === 100 ? "Perfect Score!" : percent >= 70 ? "Passed" : "Practice Needed"}
        </Badge>
      </div>
    </div>
  );
}

/**
 * Confirmation dialog shown when submitting with skipped/unanswered questions
 */
function QuizUnansweredModal({
  isOpen,
  unansweredCount,
  onReviewUnanswered,
  onSubmitAnyway,
  onClose,
}: {
  isOpen: boolean;
  unansweredCount: number;
  onReviewUnanswered: () => void;
  onSubmitAnyway: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-warning">
            <AlertCircle className="size-5" /> Unanswered Questions
          </DialogTitle>
          <DialogDescription className="pt-2 text-sm text-text-tertiary leading-relaxed">
            You still have <span className="font-bold text-text-primary">{unansweredCount}</span>{" "}
            unanswered question{unansweredCount > 1 ? "s" : ""}. Would you like to review them
            before submitting?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onReviewUnanswered}
            className="cursor-pointer text-xs h-9 rounded-xl font-medium"
          >
            Review Unanswered
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={onSubmitAnyway}
            className="cursor-pointer text-xs h-9 rounded-xl font-semibold"
          >
            Submit Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Completion Summary Screen matching clean layout
 */
function QuizCompletionSummary({
  scorePercent,
  correctCount,
  totalQuestions,
  onReviewQuiz,
  onRetakeQuiz,
}: {
  scorePercent: number;
  correctCount: number;
  totalQuestions: number;
  onReviewQuiz: () => void;
  onRetakeQuiz: () => void;
}) {
  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-300">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-text-primary">
          You did it! Quiz Complete.
        </h2>
        <p className="text-xs text-text-tertiary">Review your performance summary.</p>
      </div>

      {/* Donut Score Card */}
      <ScoreDonut
        percent={scorePercent}
        correctCount={correctCount}
        totalQuestions={totalQuestions}
      />

      {/* Bottom Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onReviewQuiz}
          className="gap-1.5 cursor-pointer text-xs h-9 rounded-xl font-medium border-surface-border text-text-secondary hover:bg-surface-2 hover:text-text-primary"
        >
          <BookOpen className="size-3.5" />
          Review Quiz
        </Button>

        <Button
          type="button"
          onClick={onRetakeQuiz}
          className="gap-1.5 cursor-pointer text-xs h-9 rounded-xl font-semibold border border-surface-border bg-surface-3 text-text-primary hover:bg-surface-4"
        >
          <RotateCcw className="size-3.5" />
          Retake Quiz
        </Button>
      </div>
    </div>
  );
}

/**
 * Question Stepper view used for active taking & read-only review
 */
function QuizQuestionStepper({
  questions,
  currentIdx,
  selectedOptions,
  checkedQuestions,
  onSelectOption,
  onPrev,
  onNext,
  onSubmit,
  isReviewMode,
  onBackToResults,
}: {
  questions: QuizQuestion[];
  currentIdx: number;
  selectedOptions: Record<string, number>;
  checkedQuestions: Record<string, boolean>;
  onSelectOption: (questionId: string, optionIndex: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
  isReviewMode?: boolean;
  onBackToResults?: () => void;
}) {
  const q = questions[currentIdx];
  const selectedIdx = selectedOptions[q.id];
  const isChecked = checkedQuestions[q.id] || isReviewMode || selectedIdx !== undefined;

  const correctOptionIdx = getCorrectOptionIndex(q);
  const isCorrect = selectedIdx === correctOptionIdx;
  const isLastQuestion = currentIdx === questions.length - 1;
  const progressPercent = ((currentIdx + 1) / questions.length) * 100;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4 animate-in fade-in duration-300">
      {/* Container Card */}
      <div className="rounded-3xl border border-surface-border bg-surface-2 p-6 md:p-8 flex flex-col gap-6">
        {/* Top Progress & Header Bar */}
        <div className="flex flex-col gap-2.5">
          <div className="flex justify-between items-center text-xs font-medium text-text-faint">
            <div className="flex items-center gap-2">
              {isReviewMode && onBackToResults && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onBackToResults}
                  className="h-7 px-2 text-xs gap-1.5 text-text-secondary hover:text-text-primary cursor-pointer rounded-lg"
                >
                  <ArrowLeft className="size-3.5" /> Back to Results
                </Button>
              )}
              <span>
                {Object.keys(selectedOptions).length} of {questions.length} answered
              </span>
            </div>
            <span className="font-semibold">
              {currentIdx + 1} / {questions.length}
            </span>
          </div>

          <div className="h-1.5 w-full bg-surface-4 rounded-full overflow-hidden">
            <div
              className="h-full bg-text-faint rounded-full transition-all duration-300 ease-in-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Question Prompt */}
        <fieldset
          key={currentIdx}
          className="flex flex-col animate-in fade-in duration-300 border-none p-0 m-0"
        >
          <legend className="text-base sm:text-lg font-bold leading-relaxed text-text-primary mb-6 tracking-tight">
            {currentIdx + 1}. {q.prompt}
          </legend>

          {/* Options List */}
          <div className="flex flex-col gap-2.5" role="radiogroup" aria-label={q.prompt}>
            {q.options.map((opt, oi) => {
              const isCurrentSelected = selectedIdx === oi;
              const isCurrentCorrect = oi === correctOptionIdx;

              let optionStyle = isCurrentSelected
                ? "border-surface-border-strong bg-surface-4 text-text-secondary transition-colors duration-200"
                : "border-surface-border bg-surface-3 text-text-tertiary hover:bg-surface-4 hover:text-text-secondary transition-colors duration-200";
              let badge = (
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border border-surface-border-strong text-[16px] font-semibold transition-all",
                    isCurrentSelected ? "text-text-primary" : "text-text-secondary",
                  )}
                >
                  {String.fromCharCode(65 + oi)}
                </span>
              );
              let statusTag: React.ReactNode = null;
              let explanationStyle = "text-text-tertiary";

              if (isChecked) {
                if (isCurrentCorrect) {
                  optionStyle = "border-success bg-success/10 text-success font-medium";
                  explanationStyle = "text-success";
                  badge = (
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-success bg-success/10 text-success">
                      <CheckCircle2 className="size-4" />
                    </span>
                  );
                  statusTag = (
                    <span className="text-xs font-bold text-success flex items-center gap-1">
                      <Check className="size-3.5" /> Right answer
                    </span>
                  );
                } else if (isCurrentSelected && !isCorrect) {
                  optionStyle = "border-destructive bg-destructive/10 text-destructive font-medium";
                  explanationStyle = "text-destructive";
                  badge = (
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-destructive bg-destructive/10 text-destructive">
                      <XCircle className="size-4" />
                    </span>
                  );
                  statusTag = (
                    <span className="text-xs font-bold text-destructive flex items-center gap-1">
                      <XCircle className="size-3.5" /> Not quite
                    </span>
                  );
                } else {
                  optionStyle =
                    "border-surface-border bg-surface-3 text-text-faint pointer-events-none";
                  badge = (
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-surface-border-strong text-text-faint text-[16px] font-semibold">
                      {String.fromCharCode(65 + oi)}
                    </span>
                  );
                }
              }

              return (
                <div
                  key={`${q.id}-${oi}`}
                  className={cn(
                    "w-full p-4 rounded-2xl border text-sm flex flex-col gap-2 relative overflow-hidden focus-within:ring-2 focus-within:ring-surface-border-strong focus-within:ring-offset-2",
                    optionStyle,
                    !isChecked && !isReviewMode && "cursor-pointer",
                  )}
                  onClick={() => {
                    if (!isChecked && !isReviewMode) {
                      onSelectOption(q.id, oi);
                    }
                  }}
                >
                  <button
                    type="button"
                    disabled={isChecked || isReviewMode}
                    aria-pressed={isCurrentSelected}
                    className="w-full text-left flex items-start gap-3 group focus-visible:outline-none cursor-pointer"
                  >
                    {badge}
                    <span className="flex-1 leading-snug mt-1">{opt.text}</span>
                  </button>

                  {/* Option Explanation on Evaluation */}
                  {isChecked && (
                    <div className="pl-10 pt-1 flex flex-col gap-1 text-xs leading-relaxed">
                      {statusTag}
                      <p className={explanationStyle}>{formatExplanationText(opt.explanation)}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>

        {/* Footer Navigation & Actions Bar */}
        <div className="flex justify-between items-center pt-3 gap-3">
          {/* Left Assistance Trigger: Explain (after answer) */}
          {isChecked ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleExplainInChat(q, selectedIdx)}
              className="text-xs gap-1.5 h-8 rounded-lg cursor-pointer border-primary/30 text-primary hover:bg-primary/10"
            >
              <Sparkles className="size-3.5" />
              Explain
            </Button>
          ) : (
            <div />
          )}

          {/* Right Stepper Buttons */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onPrev}
              disabled={currentIdx === 0}
              className="flex items-center gap-1 hover:bg-surface-3 text-text-secondary hover:text-text-primary cursor-pointer text-xs h-8 rounded-lg"
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>

            {isLastQuestion && !isReviewMode ? (
              <Button
                type="button"
                size="sm"
                onClick={onSubmit}
                className="min-w-[100px] cursor-pointer text-xs h-8 font-semibold rounded-lg border border-surface-border bg-surface-3 text-text-primary hover:bg-surface-4"
              >
                Submit Quiz
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={onNext}
                disabled={isLastQuestion && isReviewMode}
                className="flex items-center gap-1 min-w-[90px] cursor-pointer text-xs h-8 rounded-lg border border-surface-border bg-surface-3 text-text-primary font-semibold hover:bg-surface-4"
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 4. Main Component Controller
// -----------------------------------------------------------------------------

export function QuizView({ content }: QuizViewProps) {
  const questions = content?.questions || [];
  const totalQuestions = questions.length;

  const [viewMode, setViewMode] = useState<ViewMode>("active");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, number>>({});
  const [checkedQuestions, setCheckedQuestions] = useState<Record<string, boolean>>({});
  const [showUnansweredModal, setShowUnansweredModal] = useState(false);

  const answeredCount = Object.keys(selectedOptions).length;
  const unansweredCount = totalQuestions - answeredCount;

  const correctCount = useMemo(() => {
    let count = 0;
    questions.forEach((q) => {
      const correctIdx = getCorrectOptionIndex(q);
      if (selectedOptions[q.id] === correctIdx) {
        count++;
      }
    });
    return count;
  }, [questions, selectedOptions]);

  const scorePercent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  const handleSelectOption = useCallback(
    (questionId: string, optionIndex: number) => {
      if (viewMode !== "active") return;
      if (selectedOptions[questionId] !== undefined) return;

      setSelectedOptions((prev) => ({
        ...prev,
        [questionId]: optionIndex,
      }));
      setCheckedQuestions((prev) => ({
        ...prev,
        [questionId]: true,
      }));
    },
    [viewMode, selectedOptions],
  );

  const handleNext = useCallback(() => {
    if (currentIdx < totalQuestions - 1) {
      setCurrentIdx((prev) => prev + 1);
    }
  }, [currentIdx, totalQuestions]);

  const handlePrev = useCallback(() => {
    if (currentIdx > 0) {
      setCurrentIdx((prev) => prev - 1);
    }
  }, [currentIdx]);

  const handleSubmit = useCallback(() => {
    if (unansweredCount > 0) {
      setShowUnansweredModal(true);
    } else {
      setViewMode("summary");
    }
  }, [unansweredCount]);

  const handleReviewUnanswered = useCallback(() => {
    setShowUnansweredModal(false);
    const firstUnansweredIndex = questions.findIndex((q) => selectedOptions[q.id] === undefined);
    if (firstUnansweredIndex !== -1) {
      setCurrentIdx(firstUnansweredIndex);
    }
  }, [questions, selectedOptions]);

  const handleSubmitAnyway = useCallback(() => {
    setShowUnansweredModal(false);
    setViewMode("summary");
  }, []);

  const handleRetakeQuiz = useCallback(() => {
    setSelectedOptions({});
    setCheckedQuestions({});
    setCurrentIdx(0);
    setViewMode("active");
  }, []);

  const handleReviewQuiz = useCallback(() => {
    setCurrentIdx(0);
    setViewMode("review");
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.isComposing || e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      const target = e.target as HTMLElement;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest("input, textarea, select, [contenteditable='true']") !== null)
      ) {
        return;
      }

      if (viewMode === "summary") return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (currentIdx === totalQuestions - 1 && viewMode === "active") {
          handleSubmit();
        } else {
          handleNext();
        }
      } else if (["a", "b", "c", "d", "1", "2", "3", "4"].includes(e.key.toLowerCase())) {
        if (viewMode === "active" && questions[currentIdx]) {
          const key = e.key.toLowerCase();
          let optIdx = -1;
          if (["a", "b", "c", "d"].includes(key)) {
            optIdx = key.charCodeAt(0) - 97;
          } else {
            optIdx = parseInt(key, 10) - 1;
          }
          if (optIdx >= 0 && optIdx < questions[currentIdx].options.length) {
            e.preventDefault();
            e.stopPropagation();
            handleSelectOption(questions[currentIdx].id, optIdx);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    viewMode,
    currentIdx,
    totalQuestions,
    questions,
    handlePrev,
    handleNext,
    handleSubmit,
    handleSelectOption,
  ]);

  if (totalQuestions === 0) {
    return <EmptyQuizState />;
  }

  return (
    <>
      {viewMode === "summary" && (
        <QuizCompletionSummary
          scorePercent={scorePercent}
          correctCount={correctCount}
          totalQuestions={totalQuestions}
          onReviewQuiz={handleReviewQuiz}
          onRetakeQuiz={handleRetakeQuiz}
        />
      )}

      {viewMode === "active" && (
        <div data-quiz-active="true">
          <QuizQuestionStepper
            questions={questions}
            currentIdx={currentIdx}
            selectedOptions={selectedOptions}
            checkedQuestions={checkedQuestions}
            onSelectOption={handleSelectOption}
            onPrev={handlePrev}
            onNext={handleNext}
            onSubmit={handleSubmit}
          />
        </div>
      )}

      {viewMode === "review" && (
        <QuizQuestionStepper
          questions={questions}
          currentIdx={currentIdx}
          selectedOptions={selectedOptions}
          checkedQuestions={checkedQuestions}
          onSelectOption={handleSelectOption}
          onPrev={handlePrev}
          onNext={handleNext}
          onSubmit={handleSubmit}
          isReviewMode
          onBackToResults={() => setViewMode("summary")}
        />
      )}

      <QuizUnansweredModal
        isOpen={showUnansweredModal}
        unansweredCount={unansweredCount}
        onReviewUnanswered={handleReviewUnanswered}
        onSubmitAnyway={handleSubmitAnyway}
        onClose={() => setShowUnansweredModal(false)}
      />
    </>
  );
}
