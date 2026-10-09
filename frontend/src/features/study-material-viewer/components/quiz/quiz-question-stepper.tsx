import { ArrowLeft, Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { TFunction } from "i18next";
import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils/cn";
import {
  formatExplanationText,
  getCorrectOptionIndex,
  handleExplainInChat,
  type QuizQuestion,
  type QuizQuestionOption,
} from "./quiz-helpers";

function getOptionStatus(
  checked: boolean,
  correct: boolean,
  selected: boolean,
  t: TFunction<"viewer", undefined>,
): string | null {
  if (!checked) return null;
  if (correct) return selected ? t("quiz.options.yourAnswerCorrect") : t("quiz.options.correctAnswer");
  if (selected) return t("quiz.options.yourAnswerIncorrect");
  return null;
}

function getOptionContainerClass(checked: boolean, correct: boolean, selected: boolean): string {
  if (!checked) return "border-surface-border bg-surface-2 hover:bg-surface-3";
  if (correct) return "border-success/60 bg-success/10 text-text-primary";
  if (selected) return "border-destructive/60 bg-destructive/10 text-text-primary";
  return "border-surface-border bg-surface-2/60 opacity-80";
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
    <div id={id} className="space-y-1 pb-3 pl-12 pr-3.5 sm:pb-4 sm:pl-13 sm:pr-4 text-sm leading-relaxed break-words">
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
  const { t } = useTranslation("viewer");
  const status = getOptionStatus(checked, correct, selected, t);

  return (
    <div
      className={cn(
        "rounded-xl border text-text-primary transition-all",
        !checked && "cursor-pointer active:scale-98",
        getOptionContainerClass(checked, correct, selected),
      )}
    >
      <label
        className={cn(
          "flex min-h-12 w-full items-start gap-3 px-3.5 py-3 sm:p-4 touch-manipulation select-none",
          !checked && "cursor-pointer",
        )}
      >
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
        <span className="min-w-0 flex-1 text-sm leading-relaxed break-words">{option.text}</span>
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
  const { t } = useTranslation("viewer");
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
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-2 text-text-primary sm:py-6">
      {isReviewMode && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onBackToResults}
          className="self-start min-h-11 sm:min-h-8 sm:h-8 touch-manipulation active:scale-97"
        >
          <ArrowLeft aria-hidden="true" className="size-4" /> {t("quiz.backToResults")}
        </Button>
      )}
      <div className="space-y-3">
        <div className="flex flex-wrap justify-between gap-2 text-xs sm:text-sm text-text-secondary">
          <span>{t("quiz.question", { number: currentIdx + 1 })}</span>
          <span>{t("quiz.answeredOf", { answered: answeredCount, total: questions.length })}</span>
        </div>
        <div
          role="progressbar"
          aria-label={t("quiz.questionsAnswered")}
          aria-valuemin={0}
          aria-valuemax={questions.length}
          aria-valuenow={answeredCount}
          className="h-1.5 overflow-hidden rounded-full bg-surface-4"
        >
          <div
            className="h-full rounded-full bg-text-secondary transition-width motion-reduce:transition-none w-(--quiz-progress)"
            style={{ "--quiz-progress": (answeredCount / questions.length) * 100 + "%" } as React.CSSProperties}
          />
        </div>
      </div>
      <div className="space-y-3">
        <h2
          id={id}
          ref={headingRef}
          tabIndex={-1}
          className="text-base font-semibold leading-snug break-words focus-visible:outline-none sm:text-xl sm:leading-relaxed"
        >
          {q.prompt}
        </h2>
        {!isChecked && (
          <p className="text-xs sm:text-sm text-text-secondary">{t("quiz.selectNotice")}</p>
        )}
        {isReviewMode && selectedIdx === undefined && (
          <p className="text-xs sm:text-sm text-text-secondary">{t("quiz.unansweredNotice")}</p>
        )}
      </div>
      <div role="status" aria-live="polite" className="sr-only">
        {!isReviewMode && selectedIdx !== undefined
          ? selectedIdx === correctIdx
            ? t("quiz.correctStatus")
            : t("quiz.incorrectStatus", { answer: q.options[correctIdx]?.text })
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
      <footer className="sticky bottom-0 z-10 -mx-3 px-3 py-2.5 sm:static sm:mx-0 sm:px-0 sm:py-0 sm:pt-2 flex items-center justify-between gap-2 border-t border-surface-border-subtle bg-surface-1/95 backdrop-blur-sm sm:border-t-0 sm:bg-transparent pb-safe">
        {isChecked && (
          <Button
            variant="ghost"
            onClick={() => handleExplainInChat(q, selectedIdx)}
            className="min-h-11 sm:min-h-8 sm:h-8 touch-manipulation active:scale-97 text-xs sm:text-sm"
          >
            {t("common.explain")}
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={onPrev}
            disabled={currentIdx === 0}
            className="min-h-11 px-3 sm:min-h-8 sm:h-8 sm:px-3 touch-manipulation active:scale-97"
          >
            <ChevronLeft aria-hidden="true" className="size-4" /> {t("common.previous")}
          </Button>
          {isLast && !isReviewMode ? (
            <Button
              onClick={onSubmit}
              className="min-h-11 px-4 sm:min-h-8 sm:h-8 sm:px-3 touch-manipulation active:scale-97 font-medium"
            >
              {t("quiz.submit")}
            </Button>
          ) : (
            <Button
              onClick={onNext}
              disabled={isLast}
              className="min-h-11 px-4 sm:min-h-8 sm:h-8 sm:px-3 touch-manipulation active:scale-97"
            >
              {t("common.next")} <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
          )}
        </div>
      </footer>
    </section>
  );
}
