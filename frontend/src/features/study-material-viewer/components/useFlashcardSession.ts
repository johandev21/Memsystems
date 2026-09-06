import { useState } from "react";

/** Temporary navigation state; flashcard progress is deliberately not retained. */
export function useFlashcardSession(totalCards: number) {
  const [state, setState] = useState({ currentCardIndex: 0, isFlipped: false, visit: 0 });

  const navigate = (offset: number) => {
    setState((previous) => {
      if (totalCards === 0) return previous;
      return {
        currentCardIndex: (previous.currentCardIndex + offset + totalCards) % totalCards,
        isFlipped: false,
        visit: previous.visit + 1,
      };
    });
  };

  return {
    ...state,
    setIsFlipped: (isFlipped: boolean) => setState((previous) => ({ ...previous, isFlipped })),
    handleNext: () => navigate(1),
    handlePrev: () => navigate(-1),
  };
}
