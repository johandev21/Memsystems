import { useRef, type KeyboardEvent } from "react";
import type { TFunction } from "i18next";
import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useFlashcardSession } from "../hooks/use-flashcard-session";
import { detectCardFormat, type FlashcardItem } from "../utils/card-type-detector";
import { ClozeInteractive } from "./ClozeInteractive";

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

function getCardTypeLabel(
  isCloze: boolean,
  isFlipped: boolean,
  format: string,
  t: TFunction<"viewer", undefined>,
): string {
  if (isCloze) return t("flashcard.types.fillInTheBlank");
  if (isFlipped) return t("flashcard.types.answer");
  if (format === "definition") return t("flashcard.types.definition");
  return t("flashcard.types.question");
}

function StandardCardContent({
  isFlipped,
  front,
  back,
}: {
  isFlipped: boolean;
  front: string;
  back: string;
}) {
  const { t } = useTranslation("viewer");
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-6 text-center">
      <div className="flex min-h-24 w-full items-start justify-center">
        <p
          className={
            isFlipped
              ? "w-full text-sm leading-relaxed text-text-primary whitespace-pre-wrap break-words"
              : "w-full text-lg font-semibold leading-relaxed text-text-primary whitespace-pre-wrap break-words sm:text-xl"
          }
        >
          {isFlipped ? back : front}
        </p>
      </div>
      <p
        aria-hidden="true"
        className="flex min-h-4 items-center gap-1.5 text-xs text-muted-foreground"
      >
        <RotateCw aria-hidden="true" className="size-3.5" />
        {isFlipped ? t("flashcard.clickToFlipBack") : t("flashcard.clickToFlip")}
      </p>
    </div>
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

function FlashcardStage({
  stageRef,
  isCloze,
  isFlipped,
  currentCardIndex,
  visit,
  activeCard,
  onFlip,
  onFlipKeyDown,
}: {
  stageRef: React.RefObject<HTMLDivElement | null>;
  isCloze: boolean;
  isFlipped: boolean;
  currentCardIndex: number;
  visit: number;
  activeCard: FlashcardItem;
  onFlip: () => void;
  onFlipKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
}) {
  const { t } = useTranslation("viewer");
  return (
    <div
      ref={stageRef}
      role={isCloze ? undefined : "button"}
      tabIndex={isCloze ? -1 : 0}
      aria-label={t("flashcard.cardAria", {
        number: currentCardIndex + 1,
        type: t(isFlipped ? "flashcard.types.answer" : "flashcard.types.question"),
      })}
      onClick={isCloze ? undefined : onFlip}
      onKeyDown={isCloze ? undefined : onFlipKeyDown}
      className={`flex min-h-64 flex-col justify-center gap-6 rounded-2xl bg-surface-2 p-6 select-none sm:min-h-72 sm:p-8 focus-visible:outline-2 focus-visible:outline-ring ${isCloze ? "" : "cursor-pointer transition-colors duration-200 hover:bg-surface-3 hover:ring-1 hover:ring-foreground/10 hover:shadow-sm"}`}
    >
      {isCloze ? (
        <ClozeInteractive key={visit} front={activeCard.front} back={activeCard.back} />
      ) : (
        <StandardCardContent
          isFlipped={isFlipped}
          front={activeCard.front}
          back={activeCard.back}
        />
      )}
    </div>
  );
}

function FlashcardSession({ cards }: { cards: FlashcardItem[] }) {
  const { t } = useTranslation("viewer");
  const { currentCardIndex, isFlipped, visit, setIsFlipped, handleNext, handlePrev } =
    useFlashcardSession(cards.length);
  const stageRef = useRef<HTMLDivElement>(null);
  const activeCard = cards[currentCardIndex];
  const format = activeCard ? detectCardFormat(activeCard) : "qa";
  const isCloze = format === "cloze";

  function navigate(action: () => void) {
    action();
    stageRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey)
      return;
    if (
      (event.target as HTMLElement).closest(
        "button, input, textarea, select, a, [contenteditable], [role='button']",
      )
    )
      return;

    if (event.key === "ArrowRight" && cards.length > 1) {
      event.preventDefault();
      navigate(handleNext);
    } else if (event.key === "ArrowLeft" && cards.length > 1) {
      event.preventDefault();
      navigate(handlePrev);
    }
  }

  function handleFlipKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.nativeEvent.isComposing || event.defaultPrevented || event.repeat) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsFlipped(!isFlipped);
    } else if (event.key === "ArrowRight" && cards.length > 1) {
      event.preventDefault();
      navigate(handleNext);
    } else if (event.key === "ArrowLeft" && cards.length > 1) {
      event.preventDefault();
      navigate(handlePrev);
    }
  }

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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6" onKeyDown={handleKeyDown}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-text-secondary">
        <span aria-live="polite">
          {t("flashcard.cardOf", { current: currentCardIndex + 1, total: cards.length })}
        </span>
        <span>{getCardTypeLabel(isCloze, isFlipped, format, t)}</span>
      </div>

      <FlashcardStage
        stageRef={stageRef}
        isCloze={isCloze}
        isFlipped={isFlipped}
        currentCardIndex={currentCardIndex}
        visit={visit}
        activeCard={activeCard}
        onFlip={() => setIsFlipped(!isFlipped)}
        onFlipKeyDown={handleFlipKeyDown}
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
