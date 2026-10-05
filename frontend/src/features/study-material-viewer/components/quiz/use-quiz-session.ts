import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  getCorrectOptionIndex,
  shuffleQuestionsOptions,
  type QuizQuestion,
} from "./quiz-helpers";

export type ViewMode = "active" | "summary" | "review";

export interface UseQuizSessionOptions {
  shuffle?: boolean;
}

export function useQuizSession(
  questions: QuizQuestion[],
  quizRef: RefObject<HTMLDivElement | null>,
  options?: UseQuizSessionOptions,
) {
  const shuffle = options?.shuffle ?? true;
  const [sessionQuestions, setSessionQuestions] = useState<QuizQuestion[]>(() =>
    shuffle ? shuffleQuestionsOptions(questions) : questions,
  );

  const prevQuestionsRef = useRef(questions);
  useEffect(() => {
    if (prevQuestionsRef.current !== questions) {
      prevQuestionsRef.current = questions;
      setSessionQuestions(shuffle ? shuffleQuestionsOptions(questions) : questions);
      setSelectedOptions({});
      setCurrentIdx(0);
      setViewMode("active");
    }
  }, [questions, shuffle]);

  const totalQuestions = sessionQuestions.length;

  const [viewMode, setViewMode] = useState<ViewMode>("active");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, number>>({});
  const [showUnansweredModal, setShowUnansweredModal] = useState(false);

  const answeredCount = Object.keys(selectedOptions).length;
  const unansweredCount = totalQuestions - answeredCount;

  const correctCount = useMemo(() => {
    let count = 0;
    sessionQuestions.forEach((q) => {
      const correctIdx = getCorrectOptionIndex(q);
      if (selectedOptions[q.id] === correctIdx) {
        count++;
      }
    });
    return count;
  }, [sessionQuestions, selectedOptions]);

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
    const firstUnansweredIndex = sessionQuestions.findIndex((q) => selectedOptions[q.id] === undefined);
    if (firstUnansweredIndex !== -1) {
      setCurrentIdx(firstUnansweredIndex);
    }
  }, [sessionQuestions, selectedOptions]);

  const handleSubmitAnyway = useCallback(() => {
    setShowUnansweredModal(false);
    setViewMode("summary");
  }, []);

  const handleRetakeQuiz = useCallback(() => {
    if (shuffle) {
      setSessionQuestions(shuffleQuestionsOptions(questions));
    }
    setSelectedOptions({});
    setCurrentIdx(0);
    setViewMode("active");
  }, [questions, shuffle]);

  const handleReviewQuiz = useCallback(() => {
    setCurrentIdx(0);
    setViewMode("review");
  }, []);

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
        if (viewMode === "active" && sessionQuestions[currentIdx]) {
          const key = e.key.toLowerCase();
          let optIdx = -1;
          if (["a", "b", "c", "d"].includes(key)) {
            optIdx = key.charCodeAt(0) - 97;
          } else {
            optIdx = Number.parseInt(key, 10) - 1;
          }
          if (optIdx >= 0 && optIdx < sessionQuestions[currentIdx].options.length) {
            e.preventDefault();
            e.stopPropagation();
            handleSelectOption(sessionQuestions[currentIdx].id, optIdx);
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

  return {
    questions: sessionQuestions,
    viewMode,
    setViewMode,
    currentIdx,
    selectedOptions,
    showUnansweredModal,
    setShowUnansweredModal,
    answeredCount,
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
  };
}
