import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/shared/utils/cn";
import { useDescriptionOverflow } from "../../hooks/use-description-overflow";

interface NotebookDescriptionProps {
  description: string;
  isEditing: boolean;
  onChange: (value: string) => void;
  onCancel: () => void;
}

export function NotebookDescription({
  description,
  isEditing,
  onChange,
  onCancel,
}: NotebookDescriptionProps) {
  const descriptionId = useId();
  const { captionRef, isExpanded, isOverflowing, setIsExpanded } =
    useDescriptionOverflow(description);

  if (isEditing) {
    const showCharacterCount = description.length >= 400;

    return (
      <div className="px-3 sm:px-4">
        <div className="flex max-w-[68ch] flex-col gap-1">
          <Textarea
            value={description}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onCancel();
              }
            }}
            placeholder="Describe what this notebook is for…"
            rows={1}
            maxLength={500}
            aria-label="Notebook description"
            className="min-h-7 max-h-24 resize-none rounded-none border-x-0 border-t-0 border-b border-transparent bg-transparent px-0 py-1 text-sm leading-relaxed text-foreground/80 shadow-none placeholder:text-foreground/45 focus-visible:border-x-0 focus-visible:border-t-0 focus-visible:border-b-foreground/30 focus-visible:ring-0"
          />
          {showCharacterCount ? (
            <span className="self-end text-xs text-foreground/50" aria-live="polite">
              {description.length}/500
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  if (!description.trim()) return null;

  return (
    <div className="px-3 sm:px-4">
      <div className="flex max-w-[68ch] flex-col items-start gap-1">
        <p
          ref={captionRef}
          id={descriptionId}
          className={cn(
            "whitespace-pre-wrap text-sm leading-relaxed text-foreground/70",
            !isExpanded && "line-clamp-3",
          )}
        >
          {description}
        </p>
        {isOverflowing || isExpanded ? (
          <Button
            type="button"
            variant="link"
            size="xs"
            aria-controls={descriptionId}
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded((expanded) => !expanded)}
            className="h-auto rounded-none border-0 p-0 text-xs font-medium text-foreground/85 underline-offset-4 hover:text-foreground focus-visible:border-0 focus-visible:ring-0 focus-visible:underline active:translate-y-0"
          >
            {isExpanded ? "Less" : "More"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
