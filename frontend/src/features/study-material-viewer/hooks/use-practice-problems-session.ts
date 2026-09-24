import { useCallback, useMemo, useState, useEffect } from "react";
import i18n from "@/shared/i18n";
import { classifyAiError, isStructuredOutputUnsupportedError } from "@/features/ai";
import type {
  ProblemEvaluationResult,
  PracticeProblemsContentType,
  PracticeProblemsDifficulty,
} from "../shapes/practice-problems";
import { evaluatePracticeProblem } from "../api/study-materials";

export interface ProblemSessionState {
  studentAnswer: string;
  evaluation: ProblemEvaluationResult | null;
  isEvaluating: boolean;
  evaluationError: string | null;
  hintsRevealed: number;
  isSolutionRevealed: boolean;
  gaveUp: boolean;
}

export function usePracticeProblemsSession(
  materialId: string,
  set: PracticeProblemsContentType,
  onClose?: () => void,
  modelId?: string,
) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [session, setSession] = useState<Record<string, ProblemSessionState>>({});
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);

  const difficulty: PracticeProblemsDifficulty = set.difficulty ?? "medium";

  const getProblemState = useCallback(
    (problemId: string): ProblemSessionState => {
      if (session[problemId]) return session[problemId];
      return {
        studentAnswer: "",
        evaluation: null,
        isEvaluating: false,
        evaluationError: null,
        hintsRevealed: difficulty === "easy" ? 999 : 0,
        isSolutionRevealed: difficulty === "easy",
        gaveUp: false,
      };
    },
    [session, difficulty],
  );

  const updateProblemState = useCallback(
    (
      problemId: string,
      updater:
        | Partial<ProblemSessionState>
        | ((prev: ProblemSessionState) => Partial<ProblemSessionState>),
    ) => {
      setSession((prev) => {
        const current = prev[problemId] ?? {
          studentAnswer: "",
          evaluation: null,
          isEvaluating: false,
          evaluationError: null,
          hintsRevealed: difficulty === "easy" ? 999 : 0,
          isSolutionRevealed: difficulty === "easy",
          gaveUp: false,
        };
        const nextPartial = typeof updater === "function" ? updater(current) : updater;
        return {
          ...prev,
          [problemId]: { ...current, ...nextPartial },
        };
      });
    },
    [difficulty],
  );

  const setAnswer = useCallback(
    (problemId: string, answer: string) => {
      updateProblemState(problemId, { studentAnswer: answer });
    },
    [updateProblemState],
  );

  const revealNextHint = useCallback(
    (problemId: string) => {
      updateProblemState(problemId, (prev) => ({
        hintsRevealed: prev.hintsRevealed + 1,
      }));
    },
    [updateProblemState],
  );

  const revealSolution = useCallback(
    (problemId: string) => {
      updateProblemState(problemId, { isSolutionRevealed: true });
    },
    [updateProblemState],
  );

  const hideSolution = useCallback(
    (problemId: string) => {
      updateProblemState(problemId, { isSolutionRevealed: false });
    },
    [updateProblemState],
  );

  const giveUpAndReveal = useCallback(
    (problemId: string) => {
      updateProblemState(problemId, { gaveUp: true, isSolutionRevealed: true });
    },
    [updateProblemState],
  );

  const evaluateAnswer = useCallback(
    async (problemId: string) => {
      const state = getProblemState(problemId);
      if (!state.studentAnswer.trim()) return;
      if (!modelId) {
        updateProblemState(problemId, {
          isEvaluating: false,
          evaluationError: i18n.t("practice.selectModel", { ns: "viewer" }),
        });
        return;
      }

      updateProblemState(problemId, { isEvaluating: true, evaluationError: null });
      try {
        console.debug("[EVAL-DEBUG] request", {
          materialId,
          problemId,
          modelId,
          answerLength: state.studentAnswer.trim().length,
        });
        const result = await evaluatePracticeProblem(materialId, {
          problemId,
          studentAnswer: state.studentAnswer.trim(),
          modelId,
        });
        console.debug("[EVAL-DEBUG] response ok", {
          problemId,
          status: result.status,
        });
        updateProblemState(problemId, {
          evaluation: result,
          isEvaluating: false,
          isSolutionRevealed: difficulty === "hard" ? true : state.isSolutionRevealed,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : i18n.t("practice.evaluateFailed", { ns: "viewer" });
        console.error("[EVAL-DEBUG] response failed", {
          materialId,
          problemId,
          modelId,
          message,
        });
        // The structured-output preflight rejection is a capability block, not
        // a transport failure: surface it with its friendly capability copy.
        const friendlyMessage = isStructuredOutputUnsupportedError(message)
          ? classifyAiError(message).message
          : message;
        updateProblemState(problemId, {
          isEvaluating: false,
          evaluationError: friendlyMessage,
        });
      }
    },
    [materialId, modelId, getProblemState, updateProblemState, difficulty],
  );

  const hasUnsavedWork = useMemo(() => {
    return Object.values(session).some(
      (s) => s.studentAnswer.trim().length > 0 || s.evaluation !== null,
    );
  }, [session]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedWork) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedWork]);

  const requestClose = useCallback(() => {
    if (hasUnsavedWork) {
      setConfirmExitOpen(true);
    } else {
      onClose?.();
    }
  }, [hasUnsavedWork, onClose]);

  const confirmExit = useCallback(() => {
    setConfirmExitOpen(false);
    onClose?.();
  }, [onClose]);

  const cancelExit = useCallback(() => {
    setConfirmExitOpen(false);
  }, []);

  const totalProblems = set.problems.length;
  const currentProblem = set.problems[activeIdx] ?? set.problems[0];
  const currentState = getProblemState(currentProblem?.id ?? "");

  const nextProblem = useCallback(() => {
    setActiveIdx((i) => Math.min(i + 1, totalProblems - 1));
  }, [totalProblems]);

  const prevProblem = useCallback(() => {
    setActiveIdx((i) => Math.max(i - 1, 0));
  }, []);

  const goToProblem = useCallback(
    (idx: number) => {
      if (idx >= 0 && idx < totalProblems) {
        setActiveIdx(idx);
      }
    },
    [totalProblems],
  );

  return {
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
  };
}
