import { useQueryClient } from "@tanstack/react-query";
import { Check, FileText, Loader2, Upload } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchApi } from "@/shared/api";
import { parseRawTextToVideoSegments } from "../utils/video-transcript-parser";

export interface AddTranscriptDialogProps {
  sourceId: string;
  sourceTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTranscriptsAdded?: () => void;
}

export function AddTranscriptDialog({
  sourceId,
  sourceTitle,
  open,
  onOpenChange,
  onTranscriptsAdded,
}: AddTranscriptDialogProps) {
  const { t } = useTranslation("sources");
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [transcriptText, setTranscriptText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputId = useId();

  // Real-time preview of parsed segments
  const parsedSegments = useMemo(() => {
    return parseRawTextToVideoSegments(transcriptText);
  }, [transcriptText]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setTranscriptText(content);
        toast.info(t("transcriptDialog.fileLoaded", { name: file.name }));
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSave = async () => {
    const trimmed = transcriptText.trim();
    if (!trimmed) {
      toast.error(t("transcriptDialog.emptyError"));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetchApi(`/api/sources/${sourceId}/transcript`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transcriptText: trimmed }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(errorData.message || t("transcriptDialog.saveFailed"));
      }

      toast.success(
        t("transcriptDialog.addSuccess", { count: parsedSegments.length }),
      );
      queryClient.invalidateQueries({ queryKey: ["source", sourceId] });
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      onTranscriptsAdded?.();
      onOpenChange(false);
      setTranscriptText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("transcriptDialog.saveFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <FileText className="size-4 text-primary" />
            {t("transcriptDialog.title")}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground truncate">
            {sourceTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="transcript-paste" className="text-xs font-medium">
              {t("transcriptDialog.pasteLabel")}
            </Label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                id={fileInputId}
                type="file"
                accept=".srt,.vtt,.txt,.json,.json3"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isSubmitting}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
              >
                <Upload className="size-3" />
                {t("transcriptDialog.uploadButton")}
              </Button>
            </div>
          </div>

          <Textarea
            id="transcript-paste"
            data-testid="add-transcript-textarea"
            placeholder={t("transcriptDialog.placeholder")}
            value={transcriptText}
            onChange={(e) => setTranscriptText(e.target.value)}
            disabled={isSubmitting}
            className="font-mono text-xs min-h-44 max-h-80 resize-y"
          />

          {transcriptText.trim().length > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>{t("transcriptDialog.detected", { count: parsedSegments.length })}</span>
              <button
                type="button"
                onClick={() => setTranscriptText("")}
                disabled={isSubmitting}
                className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-destructive"
              >
                {t("transcriptDialog.clear")}
              </button>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t("transcriptDialog.cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            data-testid="save-transcript-button"
            onClick={handleSave}
            disabled={isSubmitting || transcriptText.trim().length === 0}
            className="gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                {t("transcriptDialog.saving")}
              </>
            ) : (
              <>
                <Check className="size-3.5" />
                {t("transcriptDialog.save")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
