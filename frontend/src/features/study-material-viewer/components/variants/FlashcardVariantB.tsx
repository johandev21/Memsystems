import { useState } from "react";
import {
  Search,
  Eye,
  Columns,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Check,
  X,
  BookOpen,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/shared/utils/cn";
import { detectCardFormat } from "../card-type-detector";
import { ClozeInteractive } from "../ClozeInteractive";

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
  deckTitle = "Flashcards Study Deck",
  sourceCount = 6,
}: FlashcardVariantBProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSideBySide, setShowSideBySide] = useState(true);
  const [incorrectCount, setIncorrectCount] = useState(2);
  const [correctCount, setCorrectCount] = useState(5);
  const [feedback, setFeedback] = useState<"good" | "bad" | null>(null);
  const [showExplainModal, setShowExplainModal] = useState(false);
  const [swipeState, setSwipeState] = useState<"idle" | "correct" | "incorrect">("idle");

  const indexedCards = cards.map((c, idx) => ({
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

  return (
    <div className="flex flex-col w-full min-h-[500px] bg-surface-1 border border-surface-border rounded-3xl overflow-hidden shadow-sm animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-surface-border-subtle bg-surface-2">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-text-primary truncate">{deckTitle}</h2>
          <Badge variant="outline" className="rounded-full text-xs px-2.5 py-0.5 font-normal gap-1">
            <BookOpen className="size-3 text-text-tertiary" /> {sourceCount} sources
          </Badge>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowSideBySide(!showSideBySide)}
          className="h-8 px-3 text-xs font-medium gap-1.5 rounded-2xl cursor-pointer"
        >
          {showSideBySide ? <Eye className="size-3.5" /> : <Columns className="size-3.5" />}
          {showSideBySide ? "Single Focus" : "Side-by-Side"}
        </Button>
      </div>

      {/* Main Dual-Pane Section */}
      <div className="flex flex-1 min-h-0 divide-x divide-surface-border-subtle">
        {/* Left Sidebar: Cards List */}
        <div className="w-56 md:w-64 flex flex-col shrink-0 bg-surface-1">
          <div className="p-3 border-b border-surface-border-subtle">
            <div className="relative">
              <Search className="size-3.5 absolute left-3 top-3 text-text-faint" />
              <Input
                type="text"
                placeholder="Search cards..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs rounded-2xl bg-surface-2 border-surface-border-strong focus-visible:ring-surface-border-strong"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {filteredCards.map((c) => {
              const isSelected = c.originalIndex === currentIndex;
              return (
                <div
                  key={c.originalIndex}
                  onClick={() => onSelectIndex(c.originalIndex)}
                  className={cn(
                    "p-3 rounded-2xl border text-xs transition-all cursor-pointer space-y-1",
                    isSelected
                      ? "bg-surface-3 border-surface-border font-semibold shadow-2xs text-text-secondary"
                      : "bg-surface-2 border-surface-border-subtle hover:bg-surface-3 text-text-tertiary hover:text-text-secondary",
                  )}
                >
                  <span className="text-xs text-text-faint block">#{c.originalIndex + 1}</span>
                  <p className="line-clamp-2 leading-relaxed">{c.front}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Stage: Active Card & Navigation */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto flex flex-col justify-between space-y-6">
          <div className="space-y-6">
            <div className="text-xs font-medium text-text-faint border-b border-surface-border-subtle pb-3 flex items-center justify-between">
              <span>ACTIVE CARD</span>
              <span>
                Card {currentIndex + 1} of {cards.length}
              </span>
            </div>

            <div
              className={cn(
                "transition-all duration-300 ease-out",
                swipeState === "correct" && "translate-x-12 opacity-0",
                swipeState === "incorrect" && "-translate-x-12 opacity-0",
              )}
            >
              {showSideBySide ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Front Side */}
                  <div className="rounded-2xl border border-surface-border-subtle bg-surface-2 p-5 flex flex-col justify-center min-h-[160px]">
                    {activeCard.format === "cloze" ? (
                      <ClozeInteractive
                        front={activeCard.front}
                        back={activeCard.back}
                        onAnswerChecked={(isCorrect) => {
                          setTimeout(() => {
                            triggerRating(isCorrect ? "correct" : "incorrect");
                          }, 500);
                        }}
                      />
                    ) : (
                      <p className="text-base font-medium text-text-primary leading-relaxed text-center">
                        {activeCard.front}
                      </p>
                    )}
                  </div>

                  {/* Back Side */}
                  <div className="rounded-2xl border border-surface-border-subtle bg-surface-3 p-5 flex flex-col justify-between min-h-[160px]">
                    <p className="text-base font-medium text-text-primary leading-relaxed text-center my-auto">
                      {activeCard.back}
                    </p>
                    <div className="pt-3 border-t border-surface-border-subtle flex justify-start">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowExplainModal(!showExplainModal)}
                        className="rounded-full h-7 px-3 text-xs gap-1 cursor-pointer bg-surface-2"
                      >
                        <Sparkles className="size-3 text-text-tertiary" /> Explain
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-surface-border-subtle bg-surface-2 p-6 space-y-6 shadow-2xs">
                  <div className="space-y-3">
                    {activeCard.format === "cloze" ? (
                      <ClozeInteractive
                        front={activeCard.front}
                        back={activeCard.back}
                        onAnswerChecked={(isCorrect) => {
                          setTimeout(() => {
                            triggerRating(isCorrect ? "correct" : "incorrect");
                          }, 500);
                        }}
                      />
                    ) : (
                      <p className="text-xl font-medium text-text-primary leading-relaxed text-center">
                        {activeCard.front}
                      </p>
                    )}
                  </div>

                  <div className="pt-6 border-t border-surface-border-subtle space-y-4 rounded-xl bg-surface-4 p-4">
                    <p className="text-lg font-medium text-text-primary leading-relaxed text-center">
                      {activeCard.back}
                    </p>
                    <div className="flex justify-start">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowExplainModal(!showExplainModal)}
                        className="rounded-full h-7 px-3 text-xs gap-1 cursor-pointer bg-surface-2"
                      >
                        <Sparkles className="size-3 text-text-tertiary" /> Explain
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Navigation Pill Row & Feedback */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-center gap-3 w-full">
              <Button
                type="button"
                variant="secondary"
                onClick={handlePrevCard}
                disabled={cards.length <= 1}
                className="size-9 p-0 rounded-full cursor-pointer"
              >
                <ChevronLeft className="size-4" />
              </Button>

              <button
                type="button"
                onClick={() => triggerRating("incorrect")}
                className="h-9 px-3.5 rounded-full border border-destructive bg-destructive/10 text-destructive text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <X className="size-3" /> {incorrectCount}
              </button>

              <button
                type="button"
                onClick={() => triggerRating("correct")}
                className="h-9 px-3.5 rounded-full border border-success bg-success/10 text-success text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
              >
                {correctCount} <Check className="size-3" />
              </button>

              <Button
                type="button"
                variant="secondary"
                onClick={handleNextCard}
                disabled={cards.length <= 1}
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
                  onClick={() => setFeedback(feedback === "good" ? null : "good")}
                  className={cn(
                    "h-7 px-2.5 text-xs gap-1 cursor-pointer",
                    feedback === "good" && "text-text-secondary font-semibold",
                  )}
                >
                  <ThumbsUp className="size-3" /> Good
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFeedback(feedback === "bad" ? null : "bad")}
                  className={cn(
                    "h-7 px-2.5 text-xs gap-1 cursor-pointer",
                    feedback === "bad" && "text-text-secondary font-semibold",
                  )}
                >
                  <ThumbsDown className="size-3" /> Bad
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Static Prompt Preview Modal */}
      {showExplainModal && (
        <div className="p-4 bg-surface-2 border-t border-surface-border-subtle space-y-2">
          <div className="flex justify-between items-center text-xs font-semibold text-text-primary">
            <span className="flex items-center gap-1">
              <MessageSquare className="size-3.5 text-text-tertiary" /> Static Explain Prompt
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowExplainModal(false)}
              className="h-5 px-1.5 text-xs"
            >
              <X className="size-3" />
            </Button>
          </div>
          <p className="text-xs text-text-faint">
            &quot;On the front: &apos;{activeCard.front}&apos;. On the back: &apos;{activeCard.back}
            &apos;. Explain this topic in more detail.&quot;
          </p>
        </div>
      )}
    </div>
  );
}
