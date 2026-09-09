import { useState, useEffect, useCallback, useMemo, useRef, useId } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, X, Check, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/shared/utils/cn";

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

export function QuizView({ content }: QuizViewProps) {
  const questions = useMemo(() => content?.questions || [], [content?.questions]);
  const totalQuestions = questions.length;

  const [viewMode, setViewMode] = useState<ViewMode>("active");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, number>>({});
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
    setCurrentIdx(0);
    setViewMode("active");
  }, []);

  const handleReviewQuiz = useCallback(() => {
    setCurrentIdx(0);
    setViewMode("review");
  }, []);

  const quizRef = useRef<HTMLDivElement>(null);
  const handleKeyDownRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    handleKeyDownRef.current = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.isComposing || e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      if (showUnansweredModal || document.querySelector('[role="dialog"][aria-modal="true"]'))
        return;
      const target = e.target as HTMLElement;
      if (!quizRef.current?.contains(target)) return;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest(
            "button, a, input, textarea, select, [role=button], [contenteditable='true']",
          ) !== null)
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
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      handleKeyDownRef.current(e);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  if (totalQuestions === 0) {
    return <EmptyQuizState />;
  }

  return (
    <div ref={quizRef}>
      {viewMode === "summary" && (
        <QuizCompletionSummary
          scorePercent={scorePercent}
          correctCount={correctCount}
          totalQuestions={totalQuestions}
          unansweredCount={unansweredCount}
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
    </div>
  );
}

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
      detail: { prompt: promptText, autoSend: false, focusChat: true },
    }),
  );
}

// -----------------------------------------------------------------------------
// 3. Sub-Components
// -----------------------------------------------------------------------------

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
            className="cursor-pointer text-sm h-9 rounded-xl font-medium"
          >
            Review Unanswered
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={onSubmitAnyway}
            className="cursor-pointer text-sm h-9 rounded-xl font-semibold"
          >
            Submit Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuizCompletionSummary({
  scorePercent,
  correctCount,
  totalQuestions,
  unansweredCount,
  onReviewQuiz,
  onRetakeQuiz,
}: {
  scorePercent: number;
  correctCount: number;
  totalQuestions: number;
  unansweredCount: number;
  onReviewQuiz: () => void;
  onRetakeQuiz: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <section className="mx-auto w-full max-w-2xl space-y-8 py-3 text-text-primary sm:py-6">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-xl font-semibold focus-visible:outline-none"
      >
        Quiz Complete
      </h2>
      <div className="space-y-2">
        <p className="text-3xl font-semibold tabular-nums">{scorePercent}%</p>
        <p className="text-sm text-text-secondary">
          {correctCount} of {totalQuestions} Correct
        </p>
      </div>
      <dl className="flex flex-wrap gap-x-10 gap-y-4">
        {[
          ["Correct", correctCount],
          ["Incorrect", totalQuestions - unansweredCount - correctCount],
          ["Unanswered", unansweredCount],
        ].map(([label, count]) => (
          <div key={label} className="space-y-1">
            <dt className="text-sm text-text-secondary">{label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{count}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="ghost" onClick={onRetakeQuiz}>
          Retake Quiz
        </Button>
        <Button onClick={onReviewQuiz}>Review Quiz</Button>
      </div>
    </section>
  );
}

function getOptionStatus(checked: boolean, correct: boolean, selected: boolean): string | null {
  if (!checked) return null;
  if (correct) return selected ? "Your Answer · Correct" : "Correct Answer";
  if (selected) return "Your Answer was incorrect";
  return null;
}

function getOptionContainerClass(checked: boolean, correct: boolean, selected: boolean): string {
  if (!checked) return "border-surface-border bg-surface-2 hover:bg-surface-3";
  if (correct) return "border-success/60 bg-success/5";
  if (selected) return "border-destructive/60 bg-destructive/5";
  return "border-surface-border bg-surface-2";
}

function OptionIndicator({
  checked,
  correct,
  selected,
  index,
}: {
  checked: boolean;
  correct: boolean;
  selected: boolean;
  index: number;
}) {
  if (checked && correct) {
    return <Check aria-hidden="true" className="size-6 shrink-0 text-success" />;
  }
  if (checked && selected) {
    return <X aria-hidden="true" className="size-6 shrink-0 text-destructive" />;
  }
  return (
    <span
      aria-hidden="true"
      className="w-6 shrink-0 text-center text-sm font-semibold leading-6 text-text-secondary"
    >
      {String.fromCharCode(65 + index)}
    </span>
  );
}

function OptionFeedback({
  id,
  status,
  correct,
  explanation,
}: {
  id: string;
  status: string | null;
  correct: boolean;
  explanation?: string;
}) {
  return (
    <div id={id} className="space-y-1 pb-4 pl-[3.25rem] pr-4 text-sm leading-relaxed break-words">
      {status && (
        <p className={cn("font-semibold", correct ? "text-success" : "text-destructive")}>
          {status}
        </p>
      )}
      {explanation && (
        <p className="text-text-secondary">{formatExplanationText(explanation)}</p>
      )}
    </div>
  );
}

function QuizOption({
  option,
  index,
  selected,
  correct,
  checked,
  review,
  name,
  onSelect,
}: {
  option: QuizQuestionOption;
  index: number;
  selected: boolean;
  correct: boolean;
  checked: boolean;
  review: boolean;
  name: string;
  onSelect: () => void;
}) {
  const id = useId();
  const showFeedback = checked && (review || selected || correct);
  const status = getOptionStatus(checked, correct, selected);

  return (
    <div
      className={cn(
        "rounded-xl border text-text-primary transition-colors focus-within:ring-2 focus-within:ring-primary",
        getOptionContainerClass(checked, correct, selected),
      )}
    >
      <label className={cn("flex items-start gap-3 p-4", !checked && "cursor-pointer")}>
        <input
          type="radio"
          name={name}
          value={option.id}
          checked={selected}
          disabled={checked}
          onChange={onSelect}
          aria-label={String.fromCharCode(65 + index) + ". " + option.text}
          aria-describedby={showFeedback ? id : undefined}
          className="sr-only"
        />
        <OptionIndicator
          checked={checked}
          correct={correct}
          selected={selected}
          index={index}
        />
        <span className="min-w-0 text-sm leading-relaxed break-words">{option.text}</span>
      </label>
      {showFeedback && (
        <OptionFeedback
          id={id}
          status={status}
          correct={correct}
          explanation={option.explanation}
        />
      )}
    </div>
  );
}

function QuizQuestionStepper({
  questions,
  currentIdx,
  selectedOptions,
  onSelectOption,
  onPrev,
  onNext,
  onSubmit,
  isReviewMode = false,
  onBackToResults,
}: {
  questions: QuizQuestion[];
  currentIdx: number;
  selectedOptions: Record<string, number>;
  onSelectOption: (questionId: string, optionIndex: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
  isReviewMode?: boolean;
  onBackToResults?: () => void;
}) {
  const q = questions[currentIdx];
  const selectedIdx = selectedOptions[q.id];
  const isChecked = isReviewMode || selectedIdx !== undefined;
  const correctIdx = getCorrectOptionIndex(q);
  const answeredCount = Object.keys(selectedOptions).length;
  const isLast = currentIdx === questions.length - 1;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const id = useId();
  useEffect(() => {
    headingRef.current?.focus();
    headingRef.current?.scrollIntoView({ block: "nearest" });
  }, [currentIdx, isReviewMode]);
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-3 text-text-primary sm:py-6">
      {isReviewMode && (
        <Button variant="ghost" size="sm" onClick={onBackToResults} className="self-start">
          <ArrowLeft aria-hidden="true" className="size-4" /> Back to Results
        </Button>
      )}
      <div className="space-y-3">
        <div className="flex flex-wrap justify-between gap-2 text-sm text-text-secondary">
          <span>Question {currentIdx + 1}</span>
          <span>
            {answeredCount} of {questions.length} Answered
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Questions Answered"
          aria-valuemin={0}
          aria-valuemax={questions.length}
          aria-valuenow={answeredCount}
          className="h-1.5 overflow-hidden rounded-full bg-surface-4"
        >
          <div
            className="h-full rounded-full bg-text-secondary transition-[width] motion-reduce:transition-none"
            style={{ width: (answeredCount / questions.length) * 100 + "%" }}
          />
        </div>
      </div>
      <div className="space-y-3">
        <h2
          id={id}
          ref={headingRef}
          tabIndex={-1}
          className="text-lg font-semibold leading-relaxed break-words focus-visible:outline-none sm:text-xl"
        >
          {q.prompt}
        </h2>
        {!isChecked && (
          <p className="text-sm text-text-secondary">
            Selecting an answer checks it immediately. You cannot change it afterward.
          </p>
        )}
        {isReviewMode && selectedIdx === undefined && (
          <p className="text-sm text-text-secondary">You left this question unanswered.</p>
        )}
      </div>
      <div role="status" aria-live="polite" className="sr-only">
        {!isReviewMode && selectedIdx !== undefined
          ? selectedIdx === correctIdx
            ? "Your answer is correct."
            : "Your answer is incorrect. The correct answer is " + q.options[correctIdx]?.text
          : ""}
      </div>
      <fieldset aria-labelledby={id} className="min-w-0 space-y-3 border-0 p-0">
        {q.options.map((option, index) => (
          <QuizOption
            key={q.id + option.id}
            option={option}
            index={index}
            selected={selectedIdx === index}
            correct={correctIdx === index}
            checked={isChecked}
            review={isReviewMode}
            name={id + q.id}
            onSelect={() => onSelectOption(q.id, index)}
          />
        ))}
      </fieldset>
      <footer className="flex flex-wrap items-center justify-between gap-3 pt-2">
        {isChecked && (
          <Button variant="ghost" onClick={() => handleExplainInChat(q, selectedIdx)}>
            Explain
          </Button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={onPrev} disabled={currentIdx === 0}>
            <ChevronLeft aria-hidden="true" className="size-4" /> Previous
          </Button>
          {isLast && !isReviewMode ? (
            <Button onClick={onSubmit}>Submit Quiz</Button>
          ) : (
            <Button onClick={onNext} disabled={isLast}>
              Next <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
          )}
        </div>
      </footer>
    </section>
  );
}
