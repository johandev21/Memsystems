import { useTranslation } from "react-i18next";

export interface QaCardProps {
  question: string;
  answer: string;
  isRevealed: boolean;
}

export function QaCard({ question, answer, isRevealed }: QaCardProps) {
  const { t } = useTranslation("viewer");

  return (
    <>
      <span className="w-fit rounded-md border border-surface-border bg-surface-2 px-2 py-0.5 text-xs font-semibold tracking-wide text-text-tertiary">
        {t("flashcard.questionBadge")}
      </span>

      <span
        className={`block ${
          isRevealed
            ? "text-sm leading-relaxed whitespace-pre-wrap break-words text-text-secondary"
            : "text-lg leading-relaxed font-medium whitespace-pre-wrap break-words text-text-primary sm:text-xl"
        }`}
      >
        {question}
      </span>

      {isRevealed && (
        <>
          <SolutionDivider label={t("flashcard.solution")} />
          <span className="block text-base leading-relaxed whitespace-pre-wrap break-words text-text-primary">
            {answer}
          </span>
        </>
      )}
    </>
  );
}

function SolutionDivider({ label }: { label: string }) {
  return (
    <span aria-hidden="true" className="flex items-center gap-3">
      <span className="h-px flex-1 bg-surface-border" />
      <span className="text-xs font-semibold tracking-wide text-primary">{label}</span>
      <span className="h-px flex-1 bg-surface-border" />
    </span>
  );
}
