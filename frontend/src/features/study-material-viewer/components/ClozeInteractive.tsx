import { useState, useId, useEffect, type KeyboardEvent } from "react";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/shared/utils/cn";
import { parseClozeCard } from "./card-type-detector";

export interface ClozeInteractiveProps {
  front: string;
  back: string;
  onAnswerChecked?: (isCorrect: boolean) => void;
}

function ClozeFeedback({
  status,
  expected,
}: {
  status: "idle" | "correct" | "incorrect";
  expected: string;
}) {
  if (status === "correct") {
    return (
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold text-success-foreground bg-success border border-success animate-in fade-in zoom-in-95 duration-150">
        <CheckCircle2 className="size-4 shrink-0" /> Correct answer!
      </div>
    );
  }

  if (status !== "incorrect") return null;

  return (
    <div className="flex flex-col items-center gap-1 px-4 py-2.5 rounded-2xl text-xs bg-destructive border border-destructive text-destructive-foreground animate-in fade-in zoom-in-95 duration-150 w-full max-w-sm mx-auto">
      <div className="flex items-center gap-1.5 font-semibold text-destructive">
        <XCircle className="size-4 shrink-0" /> Incorrect
      </div>
      <p className="text-destructive-foreground text-xs font-medium">
        Correct Answer: <span className="font-bold text-success">{expected}</span>
      </p>
    </div>
  );
}

export function ClozeInteractive({ front, back, onAnswerChecked }: ClozeInteractiveProps) {
  const [inputVal, setInputVal] = useState("");
  const [status, setStatus] = useState<"idle" | "correct" | "incorrect">("idle");
  const inputId = useId();

  // Reset state whenever front or back prompt changes
  useEffect(() => {
    setInputVal("");
    setStatus("idle");
  }, [front, back]);

  const parsed = parseClozeCard(front, back);

  const handleCheckAnswer = () => {
    const userClean = inputVal.trim().toLowerCase();
    const expectedClean = parsed.expected.trim().toLowerCase();

    if (!userClean) return;

    const isMatch = userClean === expectedClean || expectedClean.includes(userClean);
    setStatus(isMatch ? "correct" : "incorrect");
    onAnswerChecked?.(isMatch);
  };

  const handleInputChange = (value: string) => {
    setInputVal(value);
    if (status !== "idle") setStatus("idle");
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleCheckAnswer();
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-xl mx-auto text-center py-1">
      {/* Sentence display with inline blank slot */}
      <p className="text-lg md:text-xl font-medium leading-relaxed tracking-tight text-text-primary">
        <span>{parsed.prefix}</span>
        <span className="inline-flex items-center px-3 py-1 mx-1.5 rounded-xl border-2 border-dashed border-surface-border-strong bg-surface-4 font-bold text-text-primary text-base transition-colors">
          {inputVal || "____"}
        </span>
        <span>{parsed.suffix}</span>
      </p>

      {/* Input controls row */}
      <div className="flex items-center justify-center gap-2.5 w-full max-w-sm">
        <Input
          id={inputId}
          type="text"
          value={inputVal}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Type missing word..."
          className={cn(
            "h-10 text-sm rounded-2xl text-center font-medium transition-all shadow-2xs border-surface-border-strong focus-visible:ring-surface-border-strong",
            status === "correct" &&
              "border-success bg-success text-success-foreground focus-visible:ring-success",
            status === "incorrect" &&
              "border-destructive bg-destructive text-destructive-foreground focus-visible:ring-destructive",
          )}
        />
        <Button
          type="button"
          size="sm"
          onClick={handleCheckAnswer}
          disabled={!inputVal.trim()}
          className="h-10 px-4 text-xs font-semibold rounded-2xl gap-1.5 cursor-pointer shrink-0 transition-all shadow-xs"
        >
          Check <ArrowRight className="size-3.5" />
        </Button>
      </div>

      {/* Visual Feedback Banner */}
      <ClozeFeedback status={status} expected={parsed.expected} />
    </div>
  );
}
