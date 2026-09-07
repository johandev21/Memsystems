import { useCallback, useState } from "react";

export interface CaseStudyQuestionProgress {
  response: string;
  revealed: boolean;
  checklist: boolean[];
  contentHash: string;
  updatedAt: string;
}

export type CaseStudyProgressMap = Record<string, CaseStudyQuestionProgress>;

export function hashCaseStudyQuestion(question: { id: string; prompt: string }): string {
  const base = `${question.id}||${question.prompt}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

function storageKey(materialId: string): string {
  return `case-study-progress-${materialId}`;
}

function loadStored(materialId: string): CaseStudyProgressMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(storageKey(materialId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CaseStudyProgressMap;
    if (parsed && typeof parsed === "object") return parsed;
    return {};
  } catch {
    return {};
  }
}

function ensureEntry(
  prev: CaseStudyProgressMap,
  questionId: string,
  contentHash: string,
  checklistLength: number,
): CaseStudyQuestionProgress {
  const existing = prev[questionId];
  if (existing && existing.contentHash === contentHash) {
    if (existing.checklist.length === checklistLength) return existing;
    return { ...existing, checklist: normalizeChecklist(existing.checklist, checklistLength) };
  }
  return {
    response: "",
    revealed: false,
    checklist: Array(checklistLength).fill(false),
    contentHash,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeChecklist(current: boolean[], length: number): boolean[] {
  const next = Array(length).fill(false);
  for (let i = 0; i < Math.min(current.length, length); i++) {
    next[i] = current[i] === true;
  }
  return next;
}

function writeStored(materialId: string, next: CaseStudyProgressMap): boolean {
  try {
    localStorage.setItem(storageKey(materialId), JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export interface UseCaseStudyProgressResult {
  entries: CaseStudyProgressMap;
  storageError: string | null;
  getEntry: (
    questionId: string,
    contentHash: string,
    checklistLength: number,
  ) => CaseStudyQuestionProgress;
  saveResponse: (
    questionId: string,
    response: string,
    contentHash: string,
    checklistLength: number,
  ) => void;
  setRevealed: (
    questionId: string,
    revealed: boolean,
    contentHash: string,
    checklistLength: number,
  ) => void;
  setChecklistItem: (
    questionId: string,
    index: number,
    checked: boolean,
    contentHash: string,
    checklistLength: number,
  ) => void;
  resetAll: () => void;
}

export function useCaseStudyProgress(materialId: string): UseCaseStudyProgressResult {
  const [entries, setEntries] = useState<CaseStudyProgressMap>(() => loadStored(materialId));
  const [storageError, setStorageError] = useState<string | null>(null);

  const applyUpdate = useCallback(
    (
      questionId: string,
      contentHash: string,
      checklistLength: number,
      update: Partial<CaseStudyQuestionProgress>,
    ) => {
      setEntries((prev) => {
        const next = {
          ...prev,
          [questionId]: {
            ...ensureEntry(prev, questionId, contentHash, checklistLength),
            ...update,
            contentHash,
            updatedAt: new Date().toISOString(),
          },
        };
        if (writeStored(materialId, next)) {
          setStorageError(null);
        } else {
          setStorageError(
            "Progress could not be saved on this device. Your current session is kept in memory.",
          );
        }
        return next;
      });
    },
    [materialId],
  );

  const getEntry = useCallback(
    (questionId: string, contentHash: string, checklistLength: number) => {
      const existing = entries[questionId];
      if (!existing || existing.contentHash !== contentHash) {
        return {
          response: "",
          revealed: false,
          checklist: Array(checklistLength).fill(false),
          contentHash,
          updatedAt: new Date().toISOString(),
        };
      }
      return {
        ...existing,
        checklist: normalizeChecklist(existing.checklist, checklistLength),
      };
    },
    [entries],
  );

  const saveResponse = useCallback(
    (questionId: string, response: string, contentHash: string, checklistLength: number) => {
      applyUpdate(questionId, contentHash, checklistLength, { response });
    },
    [applyUpdate],
  );

  const setRevealed = useCallback(
    (questionId: string, revealed: boolean, contentHash: string, checklistLength: number) => {
      applyUpdate(questionId, contentHash, checklistLength, { revealed });
    },
    [applyUpdate],
  );

  const setChecklistItem = useCallback(
    (
      questionId: string,
      index: number,
      checked: boolean,
      contentHash: string,
      checklistLength: number,
    ) => {
      const current = ensureEntry(entries, questionId, contentHash, checklistLength);
      const next = [...normalizeChecklist(current.checklist, checklistLength)];
      next[index] = checked;
      applyUpdate(questionId, contentHash, checklistLength, { checklist: next });
    },
    [applyUpdate, entries],
  );

  const resetAll = useCallback(() => {
    try {
      localStorage.removeItem(storageKey(materialId));
      setStorageError(null);
    } catch {
      setStorageError("Reset failed on this device, but the session was cleared in memory.");
    }
    setEntries({});
  }, [materialId]);

  return { entries, storageError, getEntry, saveResponse, setRevealed, setChecklistItem, resetAll };
}
