import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils/cn";
import {
  BookOpen,
  Eye,
  MessageSquare,
  RotateCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { detectCardFormat } from "../card-type-detector";
import { ClozeInteractive } from "../ClozeInteractive";
import { FlashcardNavigation } from "./flashcard-navigation";

export interface FlashcardVariantCProps {
  cards: Array<{ front: string; back: string }>;
  currentIndex: number;
  isFlipped: boolean;
  onFlip: () => void;
  onNext: () => void;
  onPrev: () => void;
  deckTitle?: string;
  sourceCount?: number;
}

export function FlashcardVariantC({
  cards,
  currentIndex,
  isFlipped,
  onFlip,
  onNext,
  onPrev,
  deckTitle = "Flashcards Study Deck",
  sourceCount = 6,
}: FlashcardVariantCProps) {
  const currentCard = cards[currentIndex] || { front: "", back: "" };
  const cardFormat = detectCardFormat(currentCard);

  const [incorrectCount, setIncorrectCount] = useState(2);
  const [correctCount, setCorrectCount] = useState(5);
  const [feedback, setFeedback] = useState<"good" | "bad" | null>(null);
  const [showExplainModal, setShowExplainModal] = useState(false);
  const [swipeState, setSwipeState] = useState<"idle" | "correct" | "incorrect">("idle");

  const triggerRating = (type: "correct" | "incorrect") => {
    if (swipeState !== "idle") return;

    setSwipeState(type);
    if (type === "correct") setCorrectCount((c) => c + 1);
    else setIncorrectCount((c) => c + 1);

    setTimeout(() => {
      if (isFlipped) onFlip();
      onNext();
      setSwipeState("idle");
    }, 280);
  };

  // Keyboard shortcut listener (Space = Flip, E = Explain)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        onFlip();
      } else if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        setShowExplainModal((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onFlip]);

  return (
    <div className="flex flex-col items-center w-full max-w-xl mx-auto gap-5 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="w-full flex items-center justify-between pb-2 border-b border-surface-border-subtle">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold tracking-tight text-text-primary truncate max-w-xs">
            {deckTitle}
          </h2>
          <Badge
            variant="outline"
            className="rounded-full bg-surface-2 text-text-tertiary text-xs px-2.5 py-0.5 font-normal gap-1"
          >
            <BookOpen className="size-3 text-text-tertiary" /> {sourceCount} sources
          </Badge>
        </div>

        <span className="text-xs font-medium text-text-faint">
          {currentIndex + 1} / {cards.length}
        </span>
      </div>

      {/* Speed Card Surface with Pure Physical Motion & Distinct Back Background */}
      <div className="relative w-full">
        <div
          role="button"
          tabIndex={0}
          onClick={onFlip}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onFlip();
            }
          }}
          className={cn(
            "w-full rounded-3xl border p-8 md:p-10 flex flex-col justify-between gap-8 shadow-sm cursor-pointer hover:border-primary/40 select-none transition-all duration-300 ease-out",
            !isFlipped
              ? "bg-surface-2 border-surface-border"
              : "bg-surface-3 border-surface-border",
            swipeState === "correct" && "translate-x-20 rotate-6 opacity-0",
            swipeState === "incorrect" && "-translate-x-20 -rotate-6 opacity-0",
          )}
        >
          {!isFlipped ? (
            <div className="space-y-6">
              <div className="py-2 flex flex-col justify-center min-h-[140px]">
                {cardFormat === "cloze" ? (
                  <div onClick={(e) => e.stopPropagation()}>
                    <ClozeInteractive
                      front={currentCard.front}
                      back={currentCard.back}
                      onAnswerChecked={(isCorrect) => {
                        setTimeout(() => {
                          triggerRating(isCorrect ? "correct" : "incorrect");
                        }, 500);
                      }}
                    />
                  </div>
                ) : (
                  <p className="text-xl md:text-2xl font-semibold leading-relaxed tracking-tight text-text-primary text-center max-w-lg mx-auto">
                    {currentCard.front}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-center pt-4 border-t border-surface-border-subtle text-xs font-medium text-text-faint gap-1.5">
                <Eye className="size-4 text-text-faint" /> Click or press{" "}
                <kbd className="px-1.5 py-0.5 bg-surface-4 rounded-md border border-surface-border-strong text-xs font-mono font-semibold">
                  Space
                </kbd>{" "}
                to reveal answer
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="py-2 flex flex-col justify-center min-h-[140px] max-w-lg mx-auto text-center">
                <p className="text-lg md:text-xl font-medium leading-relaxed tracking-tight text-text-primary">
                  {currentCard.back}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-surface-border-subtle text-xs">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowExplainModal(!showExplainModal);
                  }}
                  className="rounded-full h-8 px-3 text-xs font-medium gap-1.5 cursor-pointer bg-surface-2"
                >
                  <Sparkles className="size-3.5 text-text-tertiary" /> Explain{" "}
                  <kbd className="text-xs font-mono bg-surface-4 px-1 rounded">E</kbd>
                </Button>

                <div className="flex items-center gap-1.5 text-text-faint">
                  <RotateCw className="size-3.5" /> Space to toggle
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Pill Row */}
      <FlashcardNavigation
        cardCount={cards.length}
        incorrectCount={incorrectCount}
        correctCount={correctCount}
        onPrev={onPrev}
        onNext={onNext}
        onRate={triggerRating}
      />

      {/* Feedback Bar */}
      <div className="w-full flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFeedback(feedback === "good" ? null : "good")}
            className={cn(
              "rounded-full h-8 px-3 text-xs gap-1.5 border-surface-border-subtle cursor-pointer transition-all",
              feedback === "good" &&
                "bg-surface-3 text-text-secondary border-surface-border font-medium",
            )}
          >
            <ThumbsUp className="size-3.5" /> Good content
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFeedback(feedback === "bad" ? null : "bad")}
            className={cn(
              "rounded-full h-8 px-3 text-xs gap-1.5 border-surface-border-subtle cursor-pointer transition-all",
              feedback === "bad" &&
                "bg-surface-3 text-text-secondary border-surface-border font-medium",
            )}
          >
            <ThumbsDown className="size-3.5" /> Bad content
          </Button>
        </div>
      </div>

      {/* Static Prompt Preview Modal */}
      {showExplainModal && (
        <div className="w-full rounded-2xl border border-surface-border-subtle bg-surface-2 p-4 shadow-lg space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-surface-border-subtle pb-1.5">
            <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
              <MessageSquare className="size-3.5 text-text-tertiary" /> Static Explain Prompt
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowExplainModal(false)}
              className="h-5 px-1.5 text-xs cursor-pointer"
            >
              <X className="size-3" />
            </Button>
          </div>
          <p className="text-xs text-text-faint leading-relaxed">
            &quot;On the front: &apos;{currentCard.front}&apos;. On the back: &apos;
            {currentCard.back}&apos;. Explain this topic in more detail.&quot;
          </p>
        </div>
      )}
    </div>
  );
}
