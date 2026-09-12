import { useState } from "react";
import { useTranslation } from "react-i18next";
import { detectCardFormat } from "../../utils/card-type-detector";
import { FlashcardDeckHeader } from "./flashcard-b/flashcard-deck-header";
import { FlashcardSidebar } from "./flashcard-b/flashcard-sidebar";
import { ActiveCardStage } from "./flashcard-b/active-card-stage";
import { FlashcardControls } from "./flashcard-b/flashcard-controls";
import { ExplainPromptPanel } from "./flashcard-b/explain-prompt-panel";
import type { IndexedCard } from "./flashcard-b/types";

export interface FlashcardVariantBProps {
  cards: Array<{ front: string; back: string }>;
  currentIndex: number;
  onSelectIndex: (idx: number) => void;
  onNext?: () => void;
  onPrev?: () => void;
  deckTitle?: string;
  sourceCount?: number;
}

export function FlashcardVariantB({
  cards,
  currentIndex,
  onSelectIndex,
  onNext,
  onPrev,
  deckTitle,
  sourceCount = 6,
}: FlashcardVariantBProps) {
  const { t } = useTranslation("viewer");
  const resolvedDeckTitle = deckTitle ?? t("flashcard.defaultDeckTitle");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSideBySide, setShowSideBySide] = useState(true);
  const [incorrectCount, setIncorrectCount] = useState(2);
  const [correctCount, setCorrectCount] = useState(5);
  const [feedback, setFeedback] = useState<"good" | "bad" | null>(null);
  const [showExplainModal, setShowExplainModal] = useState(false);
  const [swipeState, setSwipeState] = useState<"idle" | "correct" | "incorrect">("idle");

  const indexedCards: IndexedCard[] = cards.map((c, idx) => ({
    ...c,
    originalIndex: idx,
    format: detectCardFormat(c),
  }));

  const filteredCards = indexedCards.filter(
    (c) =>
      c.front.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.back.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const activeCard = indexedCards[currentIndex] || indexedCards[0];

  const handleNextCard = () => {
    if (onNext) onNext();
    else onSelectIndex((currentIndex + 1) % cards.length);
  };

  const handlePrevCard = () => {
    if (onPrev) onPrev();
    else onSelectIndex((currentIndex - 1 + cards.length) % cards.length);
  };

  const triggerRating = (type: "correct" | "incorrect") => {
    if (swipeState !== "idle") return;

    setSwipeState(type);
    if (type === "correct") setCorrectCount((c) => c + 1);
    else setIncorrectCount((c) => c + 1);

    setTimeout(() => {
      handleNextCard();
      setSwipeState("idle");
    }, 280);
  };

  const handleAnswerChecked = (isCorrect: boolean) => {
    setTimeout(() => {
      triggerRating(isCorrect ? "correct" : "incorrect");
    }, 500);
  };

  return (
    <div className="flex flex-col w-full min-h-[500px] bg-surface-1 border border-surface-border rounded-3xl overflow-hidden shadow-sm animate-in fade-in duration-200">
      <FlashcardDeckHeader
        deckTitle={resolvedDeckTitle}
        sourceCount={sourceCount}
        showSideBySide={showSideBySide}
        onToggleLayout={() => setShowSideBySide(!showSideBySide)}
      />

      <div className="flex flex-1 min-h-0 divide-x divide-surface-border-subtle">
        <FlashcardSidebar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filteredCards={filteredCards}
          currentIndex={currentIndex}
          onSelectIndex={onSelectIndex}
        />

        <div className="flex-1 p-6 md:p-8 overflow-y-auto flex flex-col justify-between space-y-6">
          <ActiveCardStage
            activeCard={activeCard}
            showSideBySide={showSideBySide}
            swipeState={swipeState}
            showExplainModal={showExplainModal}
            onToggleExplain={() => setShowExplainModal(!showExplainModal)}
            onAnswerChecked={handleAnswerChecked}
          />

          <div className="text-xs font-medium text-text-faint flex items-center justify-end">
            <span>
              {t("flashcard.cardOf", { current: currentIndex + 1, total: cards.length })}
            </span>
          </div>

          <FlashcardControls
            cardsLength={cards.length}
            incorrectCount={incorrectCount}
            correctCount={correctCount}
            feedback={feedback}
            onPrev={handlePrevCard}
            onNext={handleNextCard}
            onRate={triggerRating}
            onFeedback={(type) => setFeedback(feedback === type ? null : type)}
          />
        </div>
      </div>

      {showExplainModal && (
        <ExplainPromptPanel activeCard={activeCard} onClose={() => setShowExplainModal(false)} />
      )}
    </div>
  );
}
