import { Fragment, useState, useId, useEffect, type KeyboardEvent } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/shared/utils/cn";
import { parseClozeCard } from "./card-type-detector";

export interface ClozeInteractiveProps {
  front: string;
  back: string;
  onAnswerChecked?: (isCorrect: boolean) => void;
}

export function ClozeInteractive({ front, back, onAnswerChecked }: ClozeInteractiveProps) {
  const parsed = parseClozeCard(front, back);
  const { segments, expectedAnswers, blankCount } = parsed;

  const [values, setValues] = useState<string[]>(() => Array(blankCount).fill(""));
  const [results, setResults] = useState<boolean[] | null>(null);
  const baseId = useId();
  const feedbackId = useId();

  useEffect(() => {
    setValues(Array(parseClozeCard(front, back).blankCount).fill(""));
    setResults(null);
  }, [front, back]);

  const isChecked = results !== null;
  const isCorrectOverall = isChecked && results.every(Boolean);
  const status: "idle" | "correct" | "incorrect" = !isChecked
    ? "idle"
    : isCorrectOverall
      ? "correct"
      : "incorrect";
  const canCheck =
    !isChecked && blankCount > 0 && values.length === blankCount && values.every((v) => v.trim().length > 0);

  function checkBlank(user: string, expected: string): boolean {
    const userClean = user.trim().toLowerCase();
    // A blank with no corresponding expected answer (padded "" on
    // length mismatch) accepts any non-empty input.
    if (!expected) return userClean.length > 0;
    return userClean === expected.trim().toLowerCase();
  }

  function handleCheckAnswer() {
    if (!canCheck) return;
    const next = values.map((value, index) =>
      checkBlank(value, expectedAnswers[index] ?? ""),
    );
    setResults(next);
    onAnswerChecked?.(next.every(Boolean));
  }

  function handleInputChange(index: number, value: string) {
    setValues((prev) => prev.map((entry, i) => (i === index ? value : entry)));
    setResults(null);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") {
      event.preventDefault();
      if (!event.repeat) handleCheckAnswer();
    }
  }

  if (!parsed.isCloze || blankCount === 0) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 text-center">
        <p className="text-lg font-semibold leading-relaxed text-text-primary break-words sm:text-xl">
          {front}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 text-center">
      <p className="text-lg font-semibold leading-relaxed text-text-primary break-words sm:text-xl">
        {segments.map((segment, index) => (
          <Fragment key={index}>
            {segment}
            {index < blankCount && (
              <Input
                id={`${baseId}-blank-${index}`}
                type="text"
                value={values[index] ?? ""}
                onChange={(event) => handleInputChange(index, event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder={
                  blankCount === 1 ? "Type the missing word…" : `Blank ${index + 1}`
                }
                aria-label={
                  blankCount === 1 ? "Your Answer" : `Answer for blank ${index + 1}`
                }
                aria-invalid={isChecked && !results[index]}
                aria-describedby={isChecked ? feedbackId : undefined}
                className={cn(
                  "mx-1 inline-block h-8 w-28 min-w-0 rounded-lg px-2 text-center text-sm font-medium select-text sm:w-32",
                  isChecked &&
                    (results[index] ? "border-success/60 bg-success/5" : "bg-destructive/5"),
                )}
              />
            )}
          </Fragment>
        ))}
      </p>
      <div className="flex w-full min-w-0 max-w-sm flex-col gap-2 text-left">
        <Button
          type="button"
          onClick={handleCheckAnswer}
          disabled={!canCheck}
          className="h-10 w-full shrink-0 rounded-xl"
        >
          Check Answer
        </Button>
      </div>
      <div id={feedbackId} role="status" className="w-full text-sm">
        <ClozeFeedback
          status={status}
          expectedAnswers={expectedAnswers}
          results={results}
        />
      </div>
    </div>
  );
}

function ClozeFeedback({
  status,
  expectedAnswers,
  results,
}: {
  status: "idle" | "correct" | "incorrect";
  expectedAnswers: string[];
  results: boolean[] | null;
}) {
  if (status === "idle") return null;
  const isCorrect = status === "correct";
  const Icon = isCorrect ? Check : X;

  const failed = (results ?? []).flatMap((passed, index) =>
    !passed && expectedAnswers[index] ? [{ index, expected: expectedAnswers[index] }] : [],
  );

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="flex items-center gap-2 font-medium text-text-primary">
        <Icon
          aria-hidden="true"
          className={
            isCorrect ? "size-5 shrink-0 text-success" : "size-5 shrink-0 text-destructive"
          }
        />
        {isCorrect ? "Correct Answer" : "Incorrect Answer"}
      </p>
      {!isCorrect && (
        <div className="text-text-secondary break-words">
          {failed.length > 0 ? (
            failed.map(({ index, expected }) => (
              <p key={index}>
                {expectedAnswers.length > 1 ? `Blank ${index + 1}: ` : "Correct Answer: "}
                <span className="font-medium text-text-primary">{expected}</span>
              </p>
            ))
          ) : (
            <p>
              Correct Answer:{" "}
              <span className="font-medium text-text-primary">
                {expectedAnswers.filter(Boolean).join(", ")}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
