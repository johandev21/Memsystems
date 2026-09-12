import { ArrowLeft, Loader2 } from "lucide-react";
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
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <button
        type="button"
        onClick={onBack}
        disabled={busy}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("textMode.back")}
      </button>
      <div className="flex flex-col gap-2">
        <Label htmlFor="source-text-title">{t("textMode.title")}</Label>
        <Input
          id="source-text-title"
          placeholder={t("textMode.titlePlaceholder")}
          value={textTitle}
          onChange={(e) => onTextTitleChange(e.target.value)}
          autoFocus
          required
          disabled={busy}
        />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="source-text-body">{t("textMode.content")}</Label>
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
                className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
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
          rows={5}
          required
          disabled={busy}
          className="min-h-32 max-h-64 overflow-y-auto resize-y break-words"
        />
      </div>
      <Button
        type="submit"
        disabled={busy || !textTitle.trim() || !textBody.trim()}
        className="cursor-pointer"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {t("textMode.adding")}
          </>
        ) : (
          t("textMode.add")
        )}
      </Button>
    </form>
  );
}
