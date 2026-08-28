// -----------------------------------------------------------------------------
// 1. Imports
// -----------------------------------------------------------------------------
import { useState, useEffect, useCallback } from "react";
import { RotateCw, Sparkles, ChevronLeft, ChevronRight, Check, X } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils/cn";
import { useFlashcardProgress } from "./useFlashcardProgress";
import { detectCardFormat, type CardFormat } from "./card-type-detector";
import { ClozeInteractive } from "./ClozeInteractive";

// -----------------------------------------------------------------------------
// 2. Constants
// -----------------------------------------------------------------------------
const SWIPE_ANIMATION_DURATION_MS = 280;
const CLOZE_AUTO_ADVANCE_DELAY_MS = 500;
const SWIPE_THRESHOLD = 80;

// -----------------------------------------------------------------------------
// 3. Types / Interfaces
// -----------------------------------------------------------------------------
export interface FlashcardItem {
  front: string;
  back: string;
}

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

type RatingSwipeState = "idle" | "correct" | "incorrect";

function SwipeRatingBadge({ rating, visible }: { rating: "know" | "practice"; visible: boolean }) {
  if (!visible) return null;
  const isKnow = rating === "know";
  return (
    <div
      className={cn(
        "absolute top-4 z-20 px-4 py-1.5 rounded-xl border-2 font-bold text-sm tracking-wider uppercase pointer-events-none animate-in fade-in duration-100",
        isKnow
          ? "left-4 border-success bg-success/20 text-success rotate-[-12deg]"
          : "right-4 border-destructive bg-destructive/10 text-destructive rotate-[12deg]",
      )}
    >
      {isKnow ? "KNOW" : "NEED PRACTICE"}
    </div>
  );
}

// -----------------------------------------------------------------------------
// 4. Main Component
// -----------------------------------------------------------------------------
export function FlashcardView({
  materialId,
  materialTitle: _materialTitle = "Flashcards Study Deck",
  content,
  sourceCount: _sourceCount = 6,
}: FlashcardViewProps) {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [ratingSwipeState, setRatingSwipeState] = useState<RatingSwipeState>("idle");
  const [dragXOffset, setDragXOffset] = useState(0);

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------
  const flashcardsList: FlashcardItem[] = content.cards || [
    { front: content.front || "", back: content.back || "" },
  ];
  const totalCardsCount = flashcardsList.length;

  const {
    currentCardIndex,
    isFlipped,
    setIsFlipped,
    progress,
    handleRate,
    handleNext,
    handlePrev,
  } = useFlashcardProgress(materialId, totalCardsCount);

  const activeCard = flashcardsList[currentCardIndex] || { front: "", back: "" };
  const activeCardFormat: CardFormat = detectCardFormat(activeCard);

  const canDrag = activeCardFormat !== "cloze" && isFlipped;
  const showRatingButtons = activeCardFormat !== "cloze" && isFlipped;

  const incorrectRatingCount = Object.values(progress).filter(
    (s) => s.status === "dont-know",
  ).length;

  const correctRatingCount = Object.values(progress).filter((s) => s.status === "know").length;

  // ---------------------------------------------------------------------------
  // Event handlers & Keyboard Shortcuts
  // ---------------------------------------------------------------------------
  const handleToggleFlipCard = () => {
    if (activeCardFormat === "cloze") return;
    setIsFlipped(!isFlipped);
  };

  const handleRateCard = (ratingType: "correct" | "incorrect") => {
    if (ratingSwipeState !== "idle") return;

    setRatingSwipeState(ratingType);
    handleRate(ratingType === "correct" ? "know" : "dont-know");

    setTimeout(() => {
      if (isFlipped) {
        setIsFlipped(false);
      }
      handleNext();
      setRatingSwipeState("idle");
      setDragXOffset(0);
    }, SWIPE_ANIMATION_DURATION_MS);
  };

  const handleClozeAnswerChecked = (isCorrect: boolean) => {
    if (isCorrect) {
      setTimeout(() => {
        handleRateCard("correct");
      }, CLOZE_AUTO_ADVANCE_DELAY_MS);
    } else {
      handleRate("dont-know");
    }
  };

  const handleExplainInChat = () => {
    const promptText = `I'm reviewing flashcards based on the source material and I'd like to expand my understanding of one of them.\n\nOn the front it reads: "${activeCard.front}"\n\nThe answer on the back reads: "${activeCard.back}"\n\nExplain this topic in more detail.`;

    window.dispatchEvent(
      new CustomEvent("send-chat-prompt", {
        detail: { prompt: promptText, autoSend: true },
      }),
    );
  };

  const handleNextCard = useCallback(() => {
    if (ratingSwipeState !== "idle") return;
    setIsFlipped(false);
    handleNext();
  }, [ratingSwipeState, setIsFlipped, handleNext]);

  const handlePrevCard = useCallback(() => {
    if (ratingSwipeState !== "idle") return;
    setIsFlipped(false);
    handlePrev();
  }, [ratingSwipeState, setIsFlipped, handlePrev]);

  const handleCardDrag = (_event: unknown, info: { offset: { x: number } }) => {
    if (canDrag) setDragXOffset(info.offset.x);
  };

  const handleCardDragEnd = (
    _event: unknown,
    info: { offset: { x: number }; velocity: { x: number } },
  ) => {
    if (!canDrag || ratingSwipeState !== "idle") return;
    if (info.offset.x > SWIPE_THRESHOLD || info.velocity.x > 300) handleRateCard("correct");
    else if (info.offset.x < -SWIPE_THRESHOLD || info.velocity.x < -300)
      handleRateCard("incorrect");
    else setDragXOffset(0);
  };

  const handleCardClick = () => {
    if (!isFlipped && activeCardFormat !== "cloze") handleToggleFlipCard();
  };

  // Keyboard Shortcuts: Space (Flip), Left Arrow (Prev), Right Arrow (Next)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputActive =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable);

      if (isInputActive) return;

      if (e.key === " " || e.code === "Space") {
        if (activeCardFormat !== "cloze") {
          e.preventDefault();
          setIsFlipped(!isFlipped);
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrevCard();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNextCard();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeCardFormat, isFlipped, setIsFlipped, handlePrevCard, handleNextCard]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const FlashcardFront = () => (
    <div className="flex flex-col justify-between gap-8 min-h-[220px] animate-in fade-in duration-150">
      <div className="flex items-center justify-between text-xs text-text-faint">
        <span className="font-semibold text-text-faint">
          {currentCardIndex + 1} / {totalCardsCount}
        </span>
        <span className="text-xs uppercase font-semibold text-primary/70 tracking-wider">
          {activeCardFormat === "cloze"
            ? "Fill in the blank"
            : activeCardFormat === "definition"
              ? "Definition"
              : "Question"}
        </span>
      </div>

      <div className="py-2 flex flex-col justify-center my-auto text-center">
        {activeCardFormat === "cloze" ? (
          <ClozeInteractive
            key={`${currentCardIndex}-${activeCard.front}`}
            front={activeCard.front}
            back={activeCard.back}
            onAnswerChecked={handleClozeAnswerChecked}
          />
        ) : (
          <p className="text-xl md:text-2xl font-semibold leading-relaxed tracking-tight text-text-primary max-w-lg mx-auto">
            {activeCard.front}
          </p>
        )}
      </div>

      {activeCardFormat !== "cloze" && (
        <div className="flex items-center justify-center pt-2">
          <span className="text-xs text-text-faint font-medium">Click card to flip</span>
        </div>
      )}
    </div>
  );

  const FlashcardBack = () => (
    <div className="flex flex-col justify-between gap-8 min-h-[220px] animate-in fade-in duration-150">
      <div className="flex items-center justify-between text-xs text-text-faint">
        <span className="font-semibold text-text-faint">
          {currentCardIndex + 1} / {totalCardsCount}
        </span>
        <span className="text-xs uppercase font-semibold text-success tracking-wider">Answer</span>
      </div>

      <div className="py-2 flex flex-col justify-center my-auto space-y-4 text-center max-w-lg mx-auto">
        <p className="text-xl md:text-2xl font-semibold leading-relaxed tracking-tight text-text-primary">
          {activeCard.back}
        </p>
        {activeCardFormat === "cloze" && (
          <p className="text-xs text-text-faint italic leading-relaxed pt-2 border-t border-surface-border-subtle">
            Full sentence:{" "}
            <span className="text-text-secondary font-medium not-italic">
              {activeCard.front.replace(
                /_{2,}|\[\s*blank\s*\]|\[\s*\.\.\.\s*\]|___+/i,
                activeCard.back,
              )}
            </span>
          </p>
        )}
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleExplainInChat}
          className="rounded-full h-8 px-3.5 text-xs font-medium gap-1.5 border-surface-border-subtle bg-surface-2 hover:bg-surface-3 transition-all cursor-pointer"
        >
          <Sparkles className="size-3.5 text-text-tertiary" />
          Explain
        </Button>

        <button
          type="button"
          onClick={handleToggleFlipCard}
          className="text-xs text-text-faint hover:text-text-secondary font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <RotateCw className="size-3.5" /> Show question
        </button>
      </div>
    </div>
  );

  const FlashcardStage = () => (
    <div className="relative w-full touch-none select-none">
      <motion.div
        drag={canDrag && ratingSwipeState === "idle" ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.65}
        animate={
          ratingSwipeState === "correct"
            ? { x: 280, rotate: 14, opacity: 0, scale: 0.95 }
            : ratingSwipeState === "incorrect"
              ? { x: -280, rotate: -14, opacity: 0, scale: 0.95 }
              : { x: 0, rotate: 0, opacity: 1, scale: 1 }
        }
        transition={{ duration: 0.25, ease: "easeOut" }}
        onDrag={handleCardDrag}
        onDragEnd={handleCardDragEnd}
        onClick={handleCardClick}
        className={cn(
          "relative w-full rounded-[28px] border p-8 md:p-10 flex flex-col justify-between gap-8 shadow-sm min-h-[300px]",
          canDrag && ratingSwipeState === "idle" && "cursor-grab active:cursor-grabbing",
          !isFlipped && activeCardFormat !== "cloze" && "cursor-pointer hover:border-primary/40",
          !isFlipped ? "bg-surface-2 border-surface-border" : "bg-surface-3 border-surface-border",
        )}
      >
        {/* Tinder Swipe Badge Indicator Overlay (only on back when dragging) */}
        <SwipeRatingBadge
          rating="know"
          visible={canDrag && dragXOffset > 25 && ratingSwipeState === "idle"}
        />
        <SwipeRatingBadge
          rating="practice"
          visible={canDrag && dragXOffset < -25 && ratingSwipeState === "idle"}
        />

        {!isFlipped ? <FlashcardFront /> : <FlashcardBack />}
      </motion.div>
    </div>
  );

  const FlashcardNavigation = () => (
    <div className="flex items-center justify-center gap-3 w-full py-1 select-none">
      <Button
        type="button"
        variant="secondary"
        onClick={handlePrevCard}
        disabled={totalCardsCount <= 1}
        aria-label="Previous Card"
        className="size-10 p-0 rounded-full cursor-pointer hover:bg-surface-3 transition-all"
      >
        <ChevronLeft className="size-5" />
      </Button>

      {showRatingButtons && (
        <>
          <button
            type="button"
            onClick={() => handleRateCard("incorrect")}
            className="h-10 px-4 rounded-full border border-surface-border-subtle bg-surface-2 hover:bg-surface-3 text-destructive text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all"
            title="Swipe Left: Need Practice (Left Arrow)"
          >
            <X className="size-3.5" />
            <span>{incorrectRatingCount}</span>
          </button>

          <button
            type="button"
            onClick={() => handleRateCard("correct")}
            className="h-10 px-4 rounded-full border border-surface-border-subtle bg-surface-2 hover:bg-surface-3 text-success text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all"
            title="Swipe Right: Know (Right Arrow)"
          >
            <span>{correctRatingCount}</span>
            <Check className="size-3.5" />
          </button>
        </>
      )}

      <Button
        type="button"
        variant="secondary"
        onClick={handleNextCard}
        disabled={totalCardsCount <= 1}
        aria-label="Next Card"
        className="size-10 p-0 rounded-full cursor-pointer hover:bg-surface-3 transition-all"
      >
        <ChevronRight className="size-5" />
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto gap-6 animate-in fade-in duration-200">
      <FlashcardStage />
      <FlashcardNavigation />
    </div>
  );
}
