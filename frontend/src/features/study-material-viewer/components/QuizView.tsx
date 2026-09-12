import { useMemo, useRef } from "react";
import {
  EmptyQuizState,
  QuizCompletionSummary,
  QuizUnansweredModal,
} from "./quiz/quiz-summary-modal";
import { QuizQuestionStepper } from "./quiz/quiz-question-stepper";
import { useQuizSession } from "./quiz/use-quiz-session";
import type { QuizQuestion, QuizQuestionOption } from "./quiz/quiz-helpers";

export type { QuizQuestion, QuizQuestionOption };

export interface QuizViewProps {
  content: {
    title?: string;
    questions: QuizQuestion[];
  };
}

export function QuizView({ content }: QuizViewProps) {
  const questions = useMemo(() => content?.questions || [], [content?.questions]);
  const quizRef = useRef<HTMLDivElement>(null);

  const {
    viewMode,
    setViewMode,
    currentIdx,
    selectedOptions,
    showUnansweredModal,
    setShowUnansweredModal,
    unansweredCount,
    correctCount,
    scorePercent,
    handleSelectOption,
    handleNext,
    handlePrev,
    handleSubmit,
    handleReviewUnanswered,
    handleSubmitAnyway,
    handleRetakeQuiz,
    handleReviewQuiz,
  } = useQuizSession(questions, quizRef);

  if (questions.length === 0) {
    return <EmptyQuizState />;
  }

  return (
    <div ref={quizRef}>
      {viewMode === "summary" && (
        <QuizCompletionSummary
          scorePercent={scorePercent}
          correctCount={correctCount}
          totalQuestions={questions.length}
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
