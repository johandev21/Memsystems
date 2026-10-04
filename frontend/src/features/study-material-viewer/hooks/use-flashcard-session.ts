import { useState } from "react";

/** Temporary navigation state; flashcard progress is deliberately not retained. */
export function useFlashcardSession(totalCards: number) {
  const [state, setState] = useState({ currentCardIndex: 0, isRevealed: false });

  const navigate = (offset: number) => {
    setState((previous) => {
      if (totalCards === 0) return previous;
      return {
        currentCardIndex: (previous.currentCardIndex + offset + totalCards) % totalCards,
        isRevealed: false,
      };
    });
  };

  return {
    ...state,
    setIsRevealed: (isRevealed: boolean) => setState((previous) => ({ ...previous, isRevealed })),
    handleNext: () => navigate(1),
    handlePrev: () => navigate(-1),
  };
}
