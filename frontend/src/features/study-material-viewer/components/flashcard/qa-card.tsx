import { useTranslation } from "react-i18next";

export interface QaCardProps {
  question: string;
  answer: string;
  isRevealed: boolean;
}

export function QaCard({ question, answer, isRevealed }: QaCardProps) {
  const { t } = useTranslation("viewer");

  return (
    <article className="flex w-full min-h-52 sm:min-h-64 flex-col gap-4 sm:gap-5 rounded-flashcard border border-surface-border-subtle bg-card p-4.5 sm:p-8 text-left shadow-xs transition-colors">
      <span className="w-fit rounded-md border border-surface-border bg-surface-2 px-2 py-0.5 text-xs font-semibold tracking-wide text-text-tertiary">
        {t("flashcard.questionBadge")}
      </span>

      <p
        className={
          isRevealed
            ? "text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words text-text-secondary"
            : "text-sm sm:text-lg md:text-xl leading-relaxed font-medium whitespace-pre-wrap break-words text-text-primary"
        }
      >
        {question}
      </p>

      {isRevealed && (
        <>
          <SolutionDivider label={t("flashcard.solution")} />
          <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words text-text-primary">
            {answer}
          </p>
        </>
      )}
    </article>
  );
}

function SolutionDivider({ label }: { label: string }) {
  return (
    <div aria-hidden="true" className="flex items-center gap-3">
      <span className="h-px flex-1 bg-surface-border" />
      <span className="text-xs font-semibold tracking-wide text-primary">{label}</span>
      <span className="h-px flex-1 bg-surface-border" />
    </div>
  );
}
