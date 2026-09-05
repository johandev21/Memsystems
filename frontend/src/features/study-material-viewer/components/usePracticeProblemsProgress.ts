import { useCallback, useState } from "react";

export type PracticeRating = "independent" | "with_help" | "needs_practice";

export interface PracticeProblemAttempt {
  response: string;
  previousResponse?: string;
  rating?: PracticeRating | null;
  hintsRevealed: number;
  stepsRevealed: number;
  solutionRevealed: boolean;
  contentHash: string;
  updatedAt: string;
}

export type PracticeProgressMap = Record<string, PracticeProblemAttempt>;

export function hashProblemContent(problem: {
  prompt: string;
  answer: string;
  steps?: Array<{ id: string }>;
  hints?: string[];
}): string {
  const base = `${problem.prompt}||${problem.answer}||${(problem.steps ?? []).map((s) => s.id).join(",")}||${(problem.hints ?? []).length}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

function storageKey(materialId: string): string {
  return `practice-progress-${materialId}`;
}

function loadStored(materialId: string): PracticeProgressMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(storageKey(materialId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PracticeProgressMap;
    if (parsed && typeof parsed === "object") return parsed;
    return {};
  } catch {
    return {};
  }
}

function ensureAttempt(
  prev: PracticeProgressMap,
  problemId: string,
  contentHash: string,
): PracticeProblemAttempt {
  const existing = prev[problemId];
  if (existing && existing.contentHash === contentHash) return existing;
  return {
    response: "",
    rating: null,
    hintsRevealed: 0,
    stepsRevealed: 0,
    solutionRevealed: false,
    contentHash,
    updatedAt: new Date().toISOString(),
  };
}

function writeStored(materialId: string, next: PracticeProgressMap): boolean {
  try {
    localStorage.setItem(storageKey(materialId), JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export interface UsePracticeProblemsProgressResult {
  attempts: PracticeProgressMap;
  storageError: string | null;
  getAttempt: (problemId: string, contentHash: string) => PracticeProblemAttempt | null;
  saveResponse: (problemId: string, response: string, contentHash: string) => void;
  setRating: (problemId: string, rating: PracticeRating | null, contentHash: string) => void;
  setHintsRevealed: (problemId: string, count: number, contentHash: string) => void;
  setStepsRevealed: (problemId: string, count: number, contentHash: string) => void;
  setSolutionRevealed: (problemId: string, revealed: boolean, contentHash: string) => void;
  startRetry: (problemId: string, contentHash: string) => void;
  resetAll: () => void;
}

export function usePracticeProblemsProgress(materialId: string): UsePracticeProblemsProgressResult {
  const [attempts, setAttempts] = useState<PracticeProgressMap>(() => loadStored(materialId));
  const [storageError, setStorageError] = useState<string | null>(null);

  const applyUpdate = useCallback(
    (problemId: string, contentHash: string, update: Partial<PracticeProblemAttempt>) => {
      setAttempts((prev) => {
        const next = {
          ...prev,
          [problemId]: {
            ...ensureAttempt(prev, problemId, contentHash),
            ...update,
            contentHash,
            updatedAt: new Date().toISOString(),
          },
        };
        if (writeStored(materialId, next)) {
          setStorageError(null);
        } else {
          setStorageError("Progress could not be saved on this device. Your current session is kept in memory.");
        }
        return next;
      });
    },
    [materialId],
  );

  const getAttempt = useCallback(
    (problemId: string, contentHash: string) => {
      const existing = attempts[problemId];
      if (!existing) return null;
      if (existing.contentHash !== contentHash) return null;
      return existing;
    },
    [attempts],
  );

  const saveResponse = useCallback(
    (problemId: string, response: string, contentHash: string) => {
      applyUpdate(problemId, contentHash, { response });
    },
    [applyUpdate],
  );

  const setRating = useCallback(
    (problemId: string, rating: PracticeRating | null, contentHash: string) => {
      applyUpdate(problemId, contentHash, { rating });
    },
    [applyUpdate],
  );

  const setHintsRevealed = useCallback(
    (problemId: string, count: number, contentHash: string) => {
      applyUpdate(problemId, contentHash, { hintsRevealed: count });
    },
    [applyUpdate],
  );

  const setStepsRevealed = useCallback(
    (problemId: string, count: number, contentHash: string) => {
      applyUpdate(problemId, contentHash, { stepsRevealed: count });
    },
    [applyUpdate],
  );

  const setSolutionRevealed = useCallback(
    (problemId: string, revealed: boolean, contentHash: string) => {
      applyUpdate(problemId, contentHash, { solutionRevealed: revealed });
    },
    [applyUpdate],
  );

  const startRetry = useCallback(
    (problemId: string, contentHash: string) => {
      setAttempts((prev) => {
        const current = ensureAttempt(prev, problemId, contentHash);
        const next = {
          ...prev,
          [problemId]: {
            response: "",
            previousResponse: current.response || undefined,
            rating: null,
            hintsRevealed: 0,
            stepsRevealed: 0,
            solutionRevealed: false,
            contentHash,
            updatedAt: new Date().toISOString(),
          },
        };
        if (writeStored(materialId, next)) {
          setStorageError(null);
        } else {
          setStorageError("Progress could not be saved on this device. Your current session is kept in memory.");
        }
        return next;
      });
    },
    [materialId],
  );

  const resetAll = useCallback(() => {
    try {
      localStorage.removeItem(storageKey(materialId));
      setStorageError(null);
    } catch {
      setStorageError("Reset failed on this device, but the session was cleared in memory.");
    }
    setAttempts({});
  }, [materialId]);

  return {
    attempts,
    storageError,
    getAttempt,
    saveResponse,
    setRating,
    setHintsRevealed,
    setStepsRevealed,
    setSolutionRevealed,
    startRetry,
    resetAll,
  };
}
