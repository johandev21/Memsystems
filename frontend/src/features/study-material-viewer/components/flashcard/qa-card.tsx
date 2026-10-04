import { useTranslation } from "react-i18next";

export interface QaCardProps {
  question: string;
  answer: string;
  isRevealed: boolean;
}

/**
 * The single flashcard presentation: the question on its own until it is
 * revealed, then the question restated above a "SOLUTION" divider with the
 * answer underneath.
 */
export function QaCard({ question, answer, isRevealed }: QaCardProps) {
  const { t } = useTranslation("viewer");

  return (
    <article className="flex w-full flex-col gap-5 rounded-flashcard border border-surface-border-subtle bg-card p-6 text-left shadow-xs sm:p-8">
      <span className="w-fit rounded-md border border-surface-border bg-surface-2 px-2 py-0.5 text-xs font-semibold tracking-wide text-text-tertiary">
        {t("flashcard.questionBadge")}
      </span>

      <p
        className={
          isRevealed
            ? "text-sm leading-relaxed whitespace-pre-wrap break-words text-text-secondary"
            : "text-lg leading-relaxed font-medium whitespace-pre-wrap break-words text-text-primary sm:text-xl"
        }
      >
        {question}
      </p>

      {isRevealed && (
        <>
          <SolutionDivider label={t("flashcard.solution")} />
          <p className="text-base leading-relaxed whitespace-pre-wrap break-words text-text-primary">
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
