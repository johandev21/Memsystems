import { useEffect, useRef, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useFlashcardSession } from "../hooks/use-flashcard-session";
import type { FlashcardItem } from "../shapes/simple-flashcard";
import { QaCard } from "./flashcard/qa-card";

export type { FlashcardItem };

export interface FlashcardViewProps {
  materialId: string;
  materialTitle?: string;
  content: {
    cards?: FlashcardItem[];
    front?: string;
    back?: string;
  };
  sourceCount?: number;
}

export function FlashcardView({ materialId, content }: FlashcardViewProps) {
  const cards =
    content.cards ??
    (content.front || content.back
      ? [{ front: content.front || "", back: content.back || "" }]
      : []);

  return <FlashcardSession key={`${materialId}-${JSON.stringify(cards)}`} cards={cards} />;
}

function FlashcardControls({
  onExplain,
  onPrev,
  onNext,
  onFlip,
  disabled,
}: {
  onExplain: () => void;
  onPrev: () => void;
  onNext: () => void;
  onFlip: () => void;
  disabled: boolean;
}) {
  const { t } = useTranslation("viewer");
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 pb-safe pt-2">
      <div>
        <Button
          type="button"
          variant="ghost"
          onClick={onExplain}
          className="min-h-11 min-w-11 sm:h-9 whitespace-nowrap rounded-xl touch-manipulation active:scale-97 transition-transform text-xs sm:text-sm"
        >
          {t("common.explain")}
        </Button>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          aria-label={t("flashcard.flipCard")}
          onClick={onFlip}
          className="min-h-11 px-3 sm:h-9 whitespace-nowrap rounded-xl touch-manipulation active:scale-97 transition-transform text-xs sm:text-sm cursor-pointer"
          title={t("flashcard.flipCard")}
        >
          <RotateCw aria-hidden="true" className="size-4 mr-1.5" />
          {t("flashcard.flip")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          aria-label={t("flashcard.previousCard")}
          disabled={disabled}
          onClick={onPrev}
          className="min-h-11 min-w-11 sm:h-9 whitespace-nowrap rounded-xl touch-manipulation active:scale-97 transition-transform text-xs sm:text-sm cursor-pointer"
        >
          <ChevronLeft aria-hidden="true" className="size-4" /> {t("common.previous")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          aria-label={t("flashcard.nextCard")}
          disabled={disabled}
          onClick={onNext}
          className="min-h-11 min-w-11 sm:h-9 whitespace-nowrap rounded-xl touch-manipulation active:scale-97 transition-transform text-xs sm:text-sm cursor-pointer"
        >
          {t("common.next")} <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function FlashcardStage({
  stageRef,
  isRevealed,
  currentCardIndex,
  activeCard,
  onToggleReveal,
  onRevealKeyDown,
}: {
  stageRef: React.RefObject<HTMLDivElement | null>;
  isRevealed: boolean;
  currentCardIndex: number;
  activeCard: FlashcardItem;
  onToggleReveal: () => void;
  onRevealKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
}) {
  const { t } = useTranslation("viewer");
  return (
    <div
      ref={stageRef}
      role="button"
      tabIndex={0}
      aria-label={t("flashcard.cardAria", {
        number: currentCardIndex + 1,
        type: t(isRevealed ? "flashcard.types.answer" : "flashcard.types.question"),
      })}
      onClick={onToggleReveal}
      onKeyDown={onRevealKeyDown}
      className="w-full cursor-pointer rounded-flashcard transition-all duration-200 focus-visible:outline-2 focus-visible:outline-ring touch-manipulation active:scale-99 select-none"
    >
      <QaCard question={activeCard.front} answer={activeCard.back} isRevealed={isRevealed} />
    </div>
  );
}

function FlashcardSession({ cards }: { cards: FlashcardItem[] }) {
  const { t } = useTranslation("viewer");
  const { currentCardIndex, isRevealed, setIsRevealed, handleNext, handlePrev } =
    useFlashcardSession(cards.length);
  const stageRef = useRef<HTMLDivElement>(null);
  const activeCard = cards[currentCardIndex];

  function navigate(action: () => void) {
    action();
    stageRef.current?.focus();
  }

  function handleRevealKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.nativeEvent.isComposing || event.defaultPrevented || event.repeat) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      setIsRevealed(!isRevealed);
    } else if (event.key === "ArrowRight" && cards.length > 1) {
      event.preventDefault();
      navigate(handleNext);
    } else if (event.key === "ArrowLeft" && cards.length > 1) {
      event.preventDefault();
      navigate(handlePrev);
    }
  }

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
        setIsRevealed(!isRevealed);
      } else if (event.key === "ArrowRight" && cards.length > 1) {
        event.preventDefault();
        navigate(handleNext);
      } else if (event.key === "ArrowLeft" && cards.length > 1) {
        event.preventDefault();
        navigate(handlePrev);
      }
    }

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [cards.length, isRevealed, setIsRevealed, handleNext, handlePrev]);

  function handleExplainInChat() {
    if (!activeCard) return;
    const prompt = t("flashcard.explainPrompt", {
      front: activeCard.front,
      back: activeCard.back,
    });
    window.dispatchEvent(
      new CustomEvent("send-chat-prompt", {
        detail: { prompt, autoSend: false, focusChat: true },
      }),
    );
  }

  if (!activeCard) {
    return (
      <p className="mx-auto w-full max-w-2xl text-sm text-text-secondary">{t("flashcard.empty")}</p>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="text-xs sm:text-sm text-text-secondary">
        <span aria-live="polite">
          {t("flashcard.cardOf", { current: currentCardIndex + 1, total: cards.length })}
        </span>
      </div>

      <FlashcardStage
        stageRef={stageRef}
        isRevealed={isRevealed}
        currentCardIndex={currentCardIndex}
        activeCard={activeCard}
        onToggleReveal={() => setIsRevealed(!isRevealed)}
        onRevealKeyDown={handleRevealKeyDown}
      />

      <FlashcardControls
        onExplain={handleExplainInChat}
        onPrev={() => navigate(handlePrev)}
        onNext={() => navigate(handleNext)}
        onFlip={() => setIsRevealed(!isRevealed)}
        disabled={cards.length <= 1}
      />
    </div>
  );
}
