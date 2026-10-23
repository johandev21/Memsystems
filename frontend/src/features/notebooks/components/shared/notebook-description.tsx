import { useTranslation } from "react-i18next";
import { Textarea } from "@/components/ui/textarea";

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
  const { t } = useTranslation("notebooks");

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
            placeholder={t("description.placeholder")}
            rows={1}
            maxLength={500}
            aria-label={t("description.ariaLabel")}
            className="max-h-28 min-h-0 resize-none rounded-none border-x-0 border-t-0 border-b border-transparent bg-transparent p-0 text-xs sm:text-sm leading-relaxed text-foreground/70 shadow-none placeholder:text-foreground/45 focus-visible:border-x-0 focus-visible:border-t-0 focus-visible:border-b-foreground/30 focus-visible:ring-0"
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
      <p className="max-w-[68ch] whitespace-pre-wrap text-xs sm:text-sm leading-relaxed text-foreground/70">
        {description}
      </p>
    </div>
  );
}
