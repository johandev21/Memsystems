import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils/cn";
import { ClozeInteractive } from "../../ClozeInteractive";
import type { IndexedCard } from "./types";

export interface ActiveCardStageProps {
  activeCard: IndexedCard;
  showSideBySide: boolean;
  swipeState: "idle" | "correct" | "incorrect";
  showExplainModal: boolean;
  onToggleExplain: () => void;
  onAnswerChecked: (isCorrect: boolean) => void;
}

export function ActiveCardStage({
  activeCard,
  showSideBySide,
  swipeState,
  showExplainModal,
  onToggleExplain,
  onAnswerChecked,
}: ActiveCardStageProps) {
  const { t } = useTranslation("viewer");
  return (
    <div className="space-y-6">
      <div className="text-xs font-medium text-text-faint border-b border-surface-border-subtle pb-3 flex items-center justify-between">
        <span>{t("flashcard.activeCard")}</span>
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
            <div className="rounded-2xl border border-surface-border-subtle bg-surface-2 p-5 flex flex-col justify-center min-h-40">
              {activeCard.format === "cloze" ? (
                <ClozeInteractive
                  front={activeCard.front}
                  back={activeCard.back}
                  onAnswerChecked={onAnswerChecked}
                />
              ) : (
                <p className="text-base font-medium text-text-primary leading-relaxed text-center">
                  {activeCard.front}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-surface-border-subtle bg-surface-3 p-5 flex flex-col justify-between min-h-40">
              <p className="text-base font-medium text-text-primary leading-relaxed text-center my-auto">
                {activeCard.back}
              </p>
              <div className="pt-3 border-t border-surface-border-subtle flex justify-start">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onToggleExplain}
                  className="rounded-full h-7 px-3 text-xs gap-1 cursor-pointer bg-surface-2"
                >
                  <Sparkles className="size-3 text-text-tertiary" /> {t("common.explain")}
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
                  onAnswerChecked={onAnswerChecked}
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
                  onClick={onToggleExplain}
                  className="rounded-full h-7 px-3 text-xs gap-1 cursor-pointer bg-surface-2"
                >
                  <Sparkles className="size-3 text-text-tertiary" /> {t("common.explain")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
      {showExplainModal ? <span className="hidden" /> : null}
    </div>
  );
}
