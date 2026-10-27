import { useEffect, useState, type KeyboardEvent } from "react";

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

export interface UseFlashcardKeyboardShortcutsOptions {
  totalCards: number;
  onToggleReveal: () => void;
  onNext: () => void;
  onPrev: () => void;
}

export function useFlashcardKeyboardShortcuts({
  totalCards,
  onToggleReveal,
  onNext,
  onPrev,
}: UseFlashcardKeyboardShortcutsOptions) {
  const handleRevealKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.nativeEvent.isComposing || event.defaultPrevented || event.repeat) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === "Enter") {
      event.preventDefault();
    } else if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      onToggleReveal();
    } else if (event.key === "ArrowRight" && totalCards > 1) {
      event.preventDefault();
      onNext();
    } else if (event.key === "ArrowLeft" && totalCards > 1) {
      event.preventDefault();
      onPrev();
    }
  };

  useEffect(() => {
    function handleGlobalKeyDown(event: globalThis.KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || event.repeat) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, select, [contenteditable='true'], [role='textbox']",
        )
      ) {
        return;
      }

      if (event.key === " " || event.key === "Spacebar") {
        if (target?.closest("button, a")) return;
        event.preventDefault();
        onToggleReveal();
      } else if (event.key === "ArrowRight" && totalCards > 1) {
        event.preventDefault();
        onNext();
      } else if (event.key === "ArrowLeft" && totalCards > 1) {
        event.preventDefault();
        onPrev();
      }
    }

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [totalCards, onToggleReveal, onNext, onPrev]);

  return { handleRevealKeyDown };
}
