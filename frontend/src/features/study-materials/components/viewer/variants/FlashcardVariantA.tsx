import { useState } from "react";
import {
  RotateCw,
  Eye,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Maximize2,
  MoreVertical,
  BookOpen,
  Check,
  X,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/lib/utils";
import { detectCardFormat } from "../card-type-detector";
import { ClozeInteractive } from "../ClozeInteractive";

export interface FlashcardVariantAProps {
  cards: Array<{ front: string; back: string }>;
  currentIndex: number;
  isFlipped: boolean;
  onFlip: () => void;
  onNext: () => void;
  onPrev: () => void;
  deckTitle?: string;
  sourceCount?: number;
}

export function FlashcardVariantA({
  cards,
  currentIndex,
  isFlipped,
  onFlip,
  onNext,
  onPrev,
  deckTitle = "Flashcards Study Deck",
  sourceCount = 6,
}: FlashcardVariantAProps) {
  const currentCard = cards[currentIndex] || { front: "", back: "" };
  const cardFormat = detectCardFormat(currentCard);

  const [incorrectCount, setIncorrectCount] = useState(2);
  const [correctCount, setCorrectCount] = useState(5);
  const [feedback, setFeedback] = useState<"good" | "bad" | null>(null);
  const [swipeState, setSwipeState] = useState<"idle" | "correct" | "incorrect">("idle");
  const [showExplainModal, setShowExplainModal] = useState(false);

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

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto gap-6 animate-in fade-in duration-200">
      {/* Top Deck Title & Header Actions */}
      <div className="w-full flex items-center justify-between pb-2 border-b border-surface-border-subtle">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold tracking-tight text-text-primary truncate max-w-xs md:max-w-md">
            {deckTitle}
          </h2>
          <Badge
            variant="outline"
            className="rounded-full bg-surface-2 text-text-tertiary text-xs px-3 py-0.5 font-normal gap-1.5 cursor-pointer hover:bg-surface-3"
          >
            <BookOpen className="size-3 text-text-tertiary" />
            View {sourceCount} sources
          </Badge>
        </div>

        <div className="flex items-center gap-1 text-text-tertiary">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-8 p-0 rounded-full cursor-pointer"
          >
            <Share2 className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-8 p-0 rounded-full cursor-pointer"
          >
            <Maximize2 className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-8 p-0 rounded-full cursor-pointer"
          >
            <MoreVertical className="size-4" />
          </Button>
        </div>
      </div>

      {/* Main Flashcard Container with Motion Rating Swipe */}
      <div className="relative w-full">
        <div
          className={cn(
            "relative w-full rounded-[28px] border p-8 md:p-10 flex flex-col justify-between gap-8 shadow-sm min-h-[300px] transition-all duration-300 ease-out select-none",
            !isFlipped ? "bg-surface-2 border-surface-border" : "bg-surface-3 border-surface-border",
            swipeState === "correct" && "translate-x-24 rotate-6 opacity-0 scale-95",
            swipeState === "incorrect" && "-translate-x-24 -rotate-6 opacity-0 scale-95",
          )}
        >
          {!isFlipped ? (
            /* FRONT SIDE */
            <div className="flex flex-col justify-between gap-8 min-h-[220px] animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-xs text-text-faint">
                <span className="font-semibold text-text-faint">
                  {currentIndex + 1} / {cards.length}
                </span>
                <MoreVertical className="size-4 text-text-faint cursor-pointer" />
              </div>

              <div className="py-2 flex flex-col justify-center my-auto text-center">
                {cardFormat === "cloze" ? (
                  <ClozeInteractive
                    front={currentCard.front}
                    back={currentCard.back}
                    onAnswerChecked={(isCorrect) => {
                      setTimeout(() => {
                        triggerRating(isCorrect ? "correct" : "incorrect");
                      }, 500);
                    }}
                  />
                ) : (
                  <p className="text-xl md:text-2xl font-semibold leading-relaxed tracking-tight text-text-primary max-w-lg mx-auto">
                    {currentCard.front}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-center pt-2">
                <button
                  type="button"
                  onClick={onFlip}
                  className="text-xs text-text-faint hover:text-text-secondary font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Eye className="size-3.5" /> See answer
                </button>
              </div>
            </div>
          ) : (
            /* BACK SIDE */
            <div className="flex flex-col justify-between gap-8 min-h-[220px] animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-xs text-text-faint">
                <span className="font-semibold text-text-faint">
                  {currentIndex + 1} / {cards.length}
                </span>
                <MoreVertical className="size-4 text-text-faint cursor-pointer" />
              </div>

              <div className="py-2 flex flex-col justify-center my-auto space-y-4 text-center max-w-lg mx-auto">
                <p className="text-xl md:text-2xl font-semibold leading-relaxed tracking-tight text-text-primary">
                  {currentCard.back}
                </p>
                {cardFormat === "cloze" && (
                  <p className="text-xs text-text-faint italic leading-relaxed pt-2 border-t border-surface-border-subtle">
                    Full sentence:{" "}
                    <span className="text-text-secondary font-medium not-italic">
                      {currentCard.front.replace(
                        /_{2,}|\[\s*blank\s*\]|\[\s*\.\.\.\s*\]|___+/i,
                        currentCard.back,
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
                  onClick={() => setShowExplainModal(!showExplainModal)}
                  className="rounded-full h-8 px-3.5 text-xs font-medium gap-1.5 border-surface-border-subtle bg-surface-2 hover:bg-surface-3 transition-all cursor-pointer"
                >
                  <Sparkles className="size-3.5 text-text-tertiary" />
                  Explain
                </Button>

                <button
                  type="button"
                  onClick={onFlip}
                  className="text-xs text-text-faint hover:text-text-secondary font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <RotateCw className="size-3.5" /> Show question
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Row Below Card: Rating Pill Buttons Enabled for ALL Card Formats */}
      <div className="flex items-center justify-center gap-3 w-full py-1">
        <Button
          type="button"
          variant="secondary"
          onClick={onPrev}
          disabled={cards.length <= 1}
          aria-label="Previous Card"
          className="size-10 p-0 rounded-full cursor-pointer hover:bg-surface-3 transition-all"
        >
          <ChevronLeft className="size-5" />
        </Button>

        <button
          type="button"
          onClick={() => triggerRating("incorrect")}
          className="h-10 px-4 rounded-full border border-surface-border-subtle bg-surface-2 hover:bg-surface-3 text-destructive text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all"
        >
          <X className="size-3.5" />
          <span>{incorrectCount}</span>
        </button>

        <button
          type="button"
          onClick={() => triggerRating("correct")}
          className="h-10 px-4 rounded-full border border-surface-border-subtle bg-surface-2 hover:bg-surface-3 text-success text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all"
        >
          <span>{correctCount}</span>
          <Check className="size-3.5" />
        </button>

        <Button
          type="button"
          variant="secondary"
          onClick={onNext}
          disabled={cards.length <= 1}
          aria-label="Next Card"
          className="size-10 p-0 rounded-full cursor-pointer hover:bg-surface-3 transition-all"
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>

      {/* Bottom Feedback Bar */}
      <div className="w-full flex items-center justify-between pt-2">
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
        <div className="w-full rounded-2xl border border-surface-border-subtle bg-surface-2 p-5 shadow-lg space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-surface-border-subtle pb-2">
            <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
              <MessageSquare className="size-4 text-text-tertiary" /> Static Explain Prompt
              Preview
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowExplainModal(false)}
              className="h-6 px-2 text-xs cursor-pointer"
            >
              Close
            </Button>
          </div>
          <div className="rounded-xl bg-surface-4 p-3.5 text-xs text-text-tertiary leading-relaxed space-y-2">
            <p className="text-text-faint">
              &quot;I&apos;m reviewing flashcards based on the source material and I&apos;d like to
              expand my understanding of one of them.
            </p>
            <p>
              On the front it reads:{" "}
              <span className="text-text-secondary font-semibold">&quot;{currentCard.front}&quot;</span>
            </p>
            <p>
              The answer on the back reads:{" "}
              <span className="text-text-secondary font-semibold">&quot;{currentCard.back}&quot;</span>
            </p>
            <p className="text-text-faint">Explain this topic in more detail.&quot;</p>
          </div>
        </div>
      )}
    </div>
  );
}
