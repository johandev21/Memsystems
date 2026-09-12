import { Button } from "@/components/ui/button";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslation } from "react-i18next";

export function FlashcardNavigation({
  cardCount,
  incorrectCount,
  correctCount,
  onPrev,
  onNext,
  onRate,
}: {
  cardCount: number;
  incorrectCount: number;
  correctCount: number;
  onPrev: () => void;
  onNext: () => void;
  onRate: (rating: "correct" | "incorrect") => void;
}) {
  const { t } = useTranslation("viewer");
  return (
    <div className="flex items-center justify-center gap-3 w-full py-1">
      <Button
        type="button"
        variant="secondary"
        onClick={onPrev}
        disabled={cardCount <= 1}
        aria-label={t("flashcard.previousCard")}
        className="size-10 p-0 rounded-full cursor-pointer hover:bg-surface-3 transition-colors"
      >
        <ChevronLeft className="size-5" />
      </Button>

      <button
        type="button"
        onClick={() => onRate("incorrect")}
        className="h-10 px-4 rounded-full border border-surface-border-subtle bg-surface-2 hover:bg-surface-3 text-destructive text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors"
      >
        <X className="size-3.5" />
        <span>{incorrectCount}</span>
      </button>

      <button
        type="button"
        onClick={() => onRate("correct")}
        className="h-10 px-4 rounded-full border border-surface-border-subtle bg-surface-2 hover:bg-surface-3 text-success text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors"
      >
        <span>{correctCount}</span>
        <Check className="size-3.5" />
      </button>

      <Button
        type="button"
        variant="secondary"
        onClick={onNext}
        disabled={cardCount <= 1}
        aria-label={t("flashcard.nextCard")}
        className="size-10 p-0 rounded-full cursor-pointer hover:bg-surface-3 transition-colors"
      >
        <ChevronRight className="size-5" />
      </Button>
    </div>
  );
}
