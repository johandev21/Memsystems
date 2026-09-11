import { ChevronLeft, ChevronRight, Check, X, ThumbsUp, ThumbsDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils/cn";

export interface FlashcardControlsProps {
  cardsLength: number;
  incorrectCount: number;
  correctCount: number;
  feedback: "good" | "bad" | null;
  onPrev: () => void;
  onNext: () => void;
  onRate: (type: "correct" | "incorrect") => void;
  onFeedback: (type: "good" | "bad") => void;
}

export function FlashcardControls({
  cardsLength,
  incorrectCount,
  correctCount,
  feedback,
  onPrev,
  onNext,
  onRate,
  onFeedback,
}: FlashcardControlsProps) {
  const { t } = useTranslation("viewer");
  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-center gap-3 w-full">
        <Button
          type="button"
          variant="secondary"
          onClick={onPrev}
          disabled={cardsLength <= 1}
          aria-label={t("flashcard.previousCard")}
          className="size-9 p-0 rounded-full cursor-pointer"
        >
          <ChevronLeft className="size-4" />
        </Button>

        <button
          type="button"
          onClick={() => onRate("incorrect")}
          className="h-9 px-3.5 rounded-full border border-destructive bg-destructive/10 text-destructive text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <X className="size-3" /> {incorrectCount}
        </button>

        <button
          type="button"
          onClick={() => onRate("correct")}
          className="h-9 px-3.5 rounded-full border border-success bg-success/10 text-success text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          {correctCount} <Check className="size-3" />
        </button>

        <Button
          type="button"
          variant="secondary"
          onClick={onNext}
          disabled={cardsLength <= 1}
          aria-label={t("flashcard.nextCard")}
          className="size-9 p-0 rounded-full cursor-pointer"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="flex items-center justify-between text-xs pt-1 border-t border-surface-border-subtle">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onFeedback("good")}
            className={cn(
              "h-7 px-2.5 text-xs gap-1 cursor-pointer",
              feedback === "good" && "text-text-secondary font-semibold",
            )}
          >
            <ThumbsUp className="size-3" /> {t("flashcard.good")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onFeedback("bad")}
            className={cn(
              "h-7 px-2.5 text-xs gap-1 cursor-pointer",
              feedback === "bad" && "text-text-secondary font-semibold",
            )}
          >
            <ThumbsDown className="size-3" /> {t("flashcard.bad")}
          </Button>
        </div>
      </div>
    </div>
  );
}
