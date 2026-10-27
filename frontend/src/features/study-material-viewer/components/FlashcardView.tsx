import { useRef, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import {
  useFlashcardKeyboardShortcuts,
  useFlashcardSession,
} from "../hooks/use-flashcard-session";
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

function FlashcardSession({ cards }: { cards: FlashcardItem[] }) {
  const { t } = useTranslation("viewer");
  const { currentCardIndex, isRevealed, setIsRevealed, handleNext, handlePrev } =
    useFlashcardSession(cards.length);
  const stageRef = useRef<HTMLButtonElement>(null);
  const activeCard = cards[currentCardIndex];

  function navigate(action: () => void) {
    action();
    stageRef.current?.focus();
  }

  const { handleRevealKeyDown } = useFlashcardKeyboardShortcuts({
    totalCards: cards.length,
    onToggleReveal: () => setIsRevealed(!isRevealed),
    onNext: () => navigate(handleNext),
    onPrev: () => navigate(handlePrev),
  });

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
      <div className="text-sm text-text-secondary">
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
        disabled={cards.length <= 1}
      />
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
  stageRef: React.RefObject<HTMLButtonElement | null>;
  isRevealed: boolean;
  currentCardIndex: number;
  activeCard: FlashcardItem;
  onToggleReveal: () => void;
  onRevealKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const { t } = useTranslation("viewer");
  return (
    <button
      ref={stageRef}
      type="button"
      aria-label={t("flashcard.cardAria", {
        number: currentCardIndex + 1,
        type: t(isRevealed ? "flashcard.types.answer" : "flashcard.types.question"),
      })}
      onClick={onToggleReveal}
      onKeyDown={onRevealKeyDown}
      className="flex w-full flex-col gap-5 cursor-pointer rounded-flashcard border border-surface-border-subtle bg-card p-6 text-left shadow-xs transition-shadow duration-200 focus-visible:outline-2 focus-visible:outline-ring sm:p-8"
    >
      <QaCard question={activeCard.front} answer={activeCard.back} isRevealed={isRevealed} />
    </button>
  );
}

function FlashcardControls({
  onExplain,
  onPrev,
  onNext,
  disabled,
}: {
  onExplain: () => void;
  onPrev: () => void;
  onNext: () => void;
  disabled: boolean;
}) {
  const { t } = useTranslation("viewer");
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <Button
          type="button"
          variant="ghost"
          onClick={onExplain}
          className="h-10 whitespace-nowrap rounded-xl"
        >
          {t("common.explain")}
        </Button>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          aria-label={t("flashcard.previousCard")}
          disabled={disabled}
          onClick={onPrev}
          className="h-10 min-w-0 whitespace-nowrap rounded-xl"
        >
          <ChevronLeft aria-hidden="true" /> {t("common.previous")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          aria-label={t("flashcard.nextCard")}
          disabled={disabled}
          onClick={onNext}
          className="h-10 min-w-0 whitespace-nowrap rounded-xl"
        >
          {t("common.next")} <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
