import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface TextInputModeProps {
  textTitle: string;
  onTextTitleChange: (v: string) => void;
  textBody: string;
  onTextBodyChange: (v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  isPending: boolean;
  busy: boolean;
}

export function TextInputMode({
  textTitle,
  onTextTitleChange,
  textBody,
  onTextBodyChange,
  onSubmit,
  onBack,
  isPending,
  busy,
}: TextInputModeProps) {
  const { t } = useTranslation("sources");
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (textTitle.trim() && textBody.trim()) onSubmit();
  };

  return (
    <form className="mx-auto flex w-full max-w-xl flex-col gap-5" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="source-text-title" className="text-xs font-medium text-foreground">
          {t("textMode.title")}
        </Label>
        <Input
          id="source-text-title"
          placeholder={t("textMode.titlePlaceholder")}
          value={textTitle}
          onChange={(e) => onTextTitleChange(e.target.value)}
          autoFocus
          required
          disabled={busy}
          className="h-10 border-border/70 bg-background text-sm focus-visible:border-ring"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="source-text-body" className="text-xs font-medium text-foreground">
            {t("textMode.content")}
          </Label>
          {textBody.length > 0 && (
            <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <span>
                {t("stats.linesAndChars", {
                  count: textBody.split("\n").length,
                  chars: textBody.length,
                })}
              </span>
              <button
                type="button"
                onClick={() => onTextBodyChange("")}
                disabled={busy}
                className="cursor-pointer text-muted-foreground transition-colors hover:text-destructive"
              >
                {t("textMode.clear")}
              </button>
            </div>
          )}
        </div>
        <Textarea
          id="source-text-body"
          placeholder={t("textMode.contentPlaceholder")}
          value={textBody}
          onChange={(e) => onTextBodyChange(e.target.value)}
          rows={6}
          required
          disabled={busy}
          className="min-h-36 max-h-64 overflow-y-auto resize-y border-border/70 bg-background text-sm leading-relaxed focus-visible:border-ring break-words"
        />
      </div>

      <div className="flex items-center justify-end gap-2.5 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={busy}
          className="cursor-pointer"
        >
          {t("textMode.back")}
        </Button>
        <Button
          type="submit"
          disabled={busy || !textTitle.trim() || !textBody.trim()}
          className="cursor-pointer"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("textMode.adding")}
            </>
          ) : (
            t("textMode.add")
          )}
        </Button>
      </div>
    </form>
  );
}
