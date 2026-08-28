import { ArrowLeft, Loader2 } from "lucide-react";
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
        Back
      </button>
      <div className="flex flex-col gap-2">
        <Label htmlFor="source-text-title">Title</Label>
        <Input
          id="source-text-title"
          placeholder="My Study Notes"
          value={textTitle}
          onChange={(e) => onTextTitleChange(e.target.value)}
          autoFocus
          required
          disabled={busy}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="source-text-body">Content</Label>
        <Textarea
          id="source-text-body"
          placeholder="Paste your copied text here..."
          value={textBody}
          onChange={(e) => onTextBodyChange(e.target.value)}
          rows={5}
          required
          disabled={busy}
          className="break-words"
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
            Adding text...
          </>
        ) : (
          "Add Text Source"
        )}
      </Button>
    </form>
  );
}
