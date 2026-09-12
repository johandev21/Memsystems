import { AlertCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function EmptyQuizState() {
  const { t } = useTranslation("viewer");
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center text-text-tertiary">
      <AlertCircle className="size-8 mb-2 text-warning" />
      <p>{t("quiz.empty")}</p>
    </div>
  );
}

export function QuizUnansweredModal({
  isOpen,
  unansweredCount,
  onReviewUnanswered,
  onSubmitAnyway,
  onClose,
}: {
  isOpen: boolean;
  unansweredCount: number;
  onReviewUnanswered: () => void;
  onSubmitAnyway: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("viewer");
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-warning">
            <AlertCircle className="size-5" /> {t("quiz.unanswered.title")}
          </DialogTitle>
          <DialogDescription className="pt-2 text-sm text-text-tertiary leading-relaxed">
            {t("quiz.unanswered.description", { count: unansweredCount })}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onReviewUnanswered}
            className="cursor-pointer text-sm h-9 rounded-xl font-medium"
          >
            {t("quiz.unanswered.review")}
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={onSubmitAnyway}
            className="cursor-pointer text-sm h-9 rounded-xl font-semibold"
          >
            {t("quiz.unanswered.submitAnyway")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function QuizCompletionSummary({
  scorePercent,
  correctCount,
  totalQuestions,
  unansweredCount,
  onReviewQuiz,
  onRetakeQuiz,
}: {
  scorePercent: number;
  correctCount: number;
  totalQuestions: number;
  unansweredCount: number;
  onReviewQuiz: () => void;
  onRetakeQuiz: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { t } = useTranslation("viewer");
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  const stats: Array<{ label: string; count: number }> = [
    { label: t("quiz.stats.correct"), count: correctCount },
    { label: t("quiz.stats.incorrect"), count: totalQuestions - unansweredCount - correctCount },
    { label: t("quiz.stats.unanswered"), count: unansweredCount },
  ];
  return (
    <section className="mx-auto w-full max-w-2xl space-y-8 py-3 text-text-primary sm:py-6">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-xl font-semibold focus-visible:outline-none"
      >
        {t("quiz.complete")}
      </h2>
      <div className="space-y-2">
        <p className="text-3xl font-semibold tabular-nums">{scorePercent}%</p>
        <p className="text-sm text-text-secondary">
          {t("quiz.scoreOf", { correct: correctCount, total: totalQuestions })}
        </p>
      </div>
      <dl className="flex flex-wrap gap-x-10 gap-y-4">
        {stats.map(({ label, count }) => (
          <div key={label} className="space-y-1">
            <dt className="text-sm text-text-secondary">{label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{count}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="ghost" onClick={onRetakeQuiz}>
          {t("quiz.retake")}
        </Button>
        <Button onClick={onReviewQuiz}>{t("quiz.review")}</Button>
      </div>
    </section>
  );
}
