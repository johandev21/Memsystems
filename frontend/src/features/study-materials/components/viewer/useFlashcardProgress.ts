import { useState } from "react";

export interface FlashcardCardProgress {
  reviewCount: number;
  status: "unrated" | "know" | "dont-know";
}

export type FlashcardProgressMap = Record<number, FlashcardCardProgress>;

function loadFlashcardProgress(materialId: string): FlashcardProgressMap {
  if (typeof window === "undefined") return {};

  try {
    const stored = localStorage.getItem(`flashcard-progress-${materialId}`);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    if ("reviewCount" in parsed && !("0" in parsed)) {
      return { 0: { reviewCount: parsed.reviewCount || 0, status: parsed.status || "unrated" } };
    }

    return Object.keys(parsed).reduce<FlashcardProgressMap>((state, key) => {
      if (key !== "reviewCount" && key !== "status" && !Number.isNaN(Number(key))) {
        state[Number(key)] = parsed[key];
      }
      return state;
    }, {});
  } catch {
    return {};
  }
}

function persistFlashcardProgress(materialId: string, progress: FlashcardProgressMap) {
  const rootStats = progress[0] || { reviewCount: 0, status: "unrated" };
  localStorage.setItem(
    `flashcard-progress-${materialId}`,
    JSON.stringify({ ...progress, reviewCount: rootStats.reviewCount, status: rootStats.status }),
  );
}

export function useFlashcardProgress(materialId: string, totalCards: number) {
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const [progress, setProgress] = useState<FlashcardProgressMap>(() =>
    loadFlashcardProgress(materialId),
  );

  const saveProgress = (newProgress: FlashcardProgressMap) => {
    setProgress(newProgress);
    try {
      persistFlashcardProgress(materialId, newProgress);
    } catch {}
  };

  const handleRate = (rating: "know" | "dont-know") => {
    const currentStats = progress[currentCardIndex] || {
      reviewCount: 0,
      status: "unrated" as const,
    };
    const newProgress = {
      ...progress,
      [currentCardIndex]: {
        reviewCount: currentStats.reviewCount + 1,
        status: rating,
      },
    };
    saveProgress(newProgress);
  };

  const handleReset = () => {
    setProgress({});
    try {
      localStorage.removeItem(`flashcard-progress-${materialId}`);
    } catch {}
    setIsFlipped(false);
    setCurrentCardIndex(0);
  };

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentCardIndex((prev) => (prev + 1) % totalCards);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentCardIndex((prev) => (prev - 1 + totalCards) % totalCards);
  };

  const masteredCount = Object.values(progress).filter((s) => s.status === "know").length;
  const progressPercent = totalCards > 0 ? Math.round((masteredCount / totalCards) * 100) : 0;

  const totalReviewsCount = Object.values(progress).reduce(
    (acc, s) => acc + (s.reviewCount || 0),
    0,
  );

  return {
    currentCardIndex,
    isFlipped,
    setIsFlipped,
    progress,
    handleRate,
    handleReset,
    handleNext,
    handlePrev,
    masteredCount,
    progressPercent,
    totalReviewsCount,
  };
}
