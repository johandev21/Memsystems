import { ArrowLeft, Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils/cn";
import {
  formatExplanationText,
  getCorrectOptionIndex,
  handleExplainInChat,
  type QuizQuestion,
  type QuizQuestionOption,
} from "./quiz-helpers";

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

export function QuizQuestionStepper({
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
