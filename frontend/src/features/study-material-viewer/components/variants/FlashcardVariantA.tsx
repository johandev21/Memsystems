import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils/cn";
import {
  BookOpen,
  Eye,
  Maximize2,
  MessageSquare,
  MoreVertical,
  RotateCw,
  Share2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { detectCardFormat, fillClozeBlanks } from "../../utils/card-type-detector";
import { ClozeInteractive } from "../ClozeInteractive";
import { FlashcardNavigation } from "./flashcard-navigation";

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
  deckTitle,
  sourceCount = 6,
}: FlashcardVariantAProps) {
  const { t } = useTranslation("viewer");
  const resolvedDeckTitle = deckTitle ?? t("flashcard.defaultDeckTitle");
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
            {resolvedDeckTitle}
          </h2>
          <Badge
            variant="outline"
            className="rounded-full bg-surface-2 text-text-tertiary text-xs px-3 py-0.5 font-normal gap-1.5 cursor-pointer hover:bg-surface-3"
          >
            <BookOpen className="size-3 text-text-tertiary" />
            {t("flashcard.viewSources", { count: sourceCount })}
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
            !isFlipped
              ? "bg-surface-2 border-surface-border"
              : "bg-surface-3 border-surface-border",
            swipeState === "correct" && "translate-x-24 rotate-6 opacity-0 scale-95",
            swipeState === "incorrect" && "-translate-x-24 -rotate-6 opacity-0 scale-95",
          )}
        >
          {!isFlipped ? (
            /* FRONT SIDE */
            <div className="flex flex-col justify-between gap-8 min-h-[220px] animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-xs text-text-faint">
                <span className="font-semibold text-text-faint">
                  {t("flashcard.position", { current: currentIndex + 1, total: cards.length })}
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
                  <Eye className="size-3.5" /> {t("flashcard.seeAnswer")}
                </button>
              </div>
            </div>
          ) : (
            /* BACK SIDE */
            <div className="flex flex-col justify-between gap-8 min-h-[220px] animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-xs text-text-faint">
                <span className="font-semibold text-text-faint">
                  {t("flashcard.position", { current: currentIndex + 1, total: cards.length })}
                </span>
                <MoreVertical className="size-4 text-text-faint cursor-pointer" />
              </div>

              <div className="py-2 flex flex-col justify-center my-auto space-y-4 text-center max-w-lg mx-auto">
                <p className="text-xl md:text-2xl font-semibold leading-relaxed tracking-tight text-text-primary">
                  {currentCard.back}
                </p>
                {cardFormat === "cloze" && (
                  <p className="text-xs text-text-faint italic leading-relaxed pt-2 border-t border-surface-border-subtle">
                    {t("flashcard.fullSentence")}{" "}
                    <span className="text-text-secondary font-medium not-italic">
                      {fillClozeBlanks(currentCard.front, currentCard.back)}
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
                  className="rounded-full h-8 px-3.5 text-xs font-medium gap-1.5 border-surface-border-subtle bg-surface-2 hover:bg-surface-3 transition-colors cursor-pointer"
                >
                  <Sparkles className="size-3.5 text-text-tertiary" />
                  {t("common.explain")}
                </Button>

                <button
                  type="button"
                  onClick={onFlip}
                  className="text-xs text-text-faint hover:text-text-secondary font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <RotateCw className="size-3.5" /> {t("flashcard.showQuestion")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Row Below Card: Rating Pill Buttons Enabled for ALL Card Formats */}
      <FlashcardNavigation
        cardCount={cards.length}
        incorrectCount={incorrectCount}
        correctCount={correctCount}
        onPrev={onPrev}
        onNext={onNext}
        onRate={triggerRating}
      />

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
            <ThumbsUp className="size-3.5" /> {t("flashcard.goodContent")}
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
            <ThumbsDown className="size-3.5" /> {t("flashcard.badContent")}
          </Button>
        </div>
      </div>

      {/* Static Prompt Preview Modal */}
      {showExplainModal && (
        <div className="w-full rounded-2xl border border-surface-border-subtle bg-surface-2 p-5 shadow-lg space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-surface-border-subtle pb-2">
            <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
              <MessageSquare className="size-4 text-text-tertiary" /> {t("flashcard.staticExplainPreview")}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowExplainModal(false)}
              className="h-6 px-2 text-xs cursor-pointer"
            >
              {t("common.close")}
            </Button>
          </div>
          <div className="rounded-xl bg-surface-4 p-3.5 text-xs text-text-tertiary leading-relaxed space-y-2">
            <p className="text-text-faint">{t("flashcard.explainIntro")}</p>
            <p>
              {t("flashcard.explainFront")}{" "}
              <span className="text-text-secondary font-semibold">
                &quot;{currentCard.front}&quot;
              </span>
            </p>
            <p>
              {t("flashcard.explainBack")}{" "}
              <span className="text-text-secondary font-semibold">
                &quot;{currentCard.back}&quot;
              </span>
            </p>
            <p className="text-text-faint">{t("flashcard.explainOutro")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
