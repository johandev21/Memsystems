import { AlertCircle, BookOpen, Code, File, FileText, Globe, Headphones, ImageIcon, Loader2, Presentation, Video, X } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import type { PendingSourceUpload } from "../hooks/use-upload-store";
import { processingStageLabel } from "../utils/source-processing";
import { isYouTubeUrl } from "../utils/detect-document-type";

function getKindIcon(upload: PendingSourceUpload) {
  if (
    upload.modality === "video" ||
    /\.(mp4|mov|mkv)$/i.test(upload.title) ||
    (upload.kind === "url" && isYouTubeUrl(upload.url))
  ) {
    return Video;
  }
  if (
    upload.modality === "audio" ||
    /\.(mp3|m4a|wav|webm|aac|ogg)$/i.test(upload.title)
  ) {
    return Headphones;
  }
  if (
    upload.modality === "image" ||
    /\.(png|jpe?g|webp|heic|heif|gif|svg|bmp)$/i.test(upload.title)
  ) {
    return ImageIcon;
  }
  if (upload.modality === "slides" || /\.pptx$/i.test(upload.title)) {
    return Presentation;
  }
  if (upload.modality === "ebook" || /\.epub$/i.test(upload.title)) {
    return BookOpen;
  }
  if (/\.tex$/i.test(upload.title)) {
    return Code;
  }
  if (/\.bib$/i.test(upload.title)) {
    return FileText;
  }
  switch (upload.kind) {
    case "url":
      return Globe;
    case "file":
      return FileText;
    default:
      return File;
  }
}

interface PendingUploadRowProps {
  upload: PendingSourceUpload;
  onCancel: (id: string) => void;
}

export function PendingUploadRow({ upload, onCancel }: PendingUploadRowProps) {
  const Icon = getKindIcon(upload);
  const isError = upload.status === "failed";
  const isCancelled = upload.status === "cancelled";
  const isTerminal = isError || isCancelled;
  const statusText = isError
    ? upload.errorMessage || "Source processing failed"
    : isCancelled
      ? "Cancelled"
      : upload.status === "uploading"
        ? "Saving source…"
        : processingStageLabel(upload.status, upload.processingStage, upload.modality);

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-2 rounded-xl border p-2.5 transition-all duration-300 animate-in fade-in slide-in-from-top-1",
        isError
          ? "border-destructive/40 bg-destructive/5"
          : isCancelled
            ? "border-border bg-muted/30"
            : "border-primary/30 bg-primary/5 shadow-xs",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {isError ? (
            <AlertCircle className="size-4 shrink-0 text-destructive" />
          ) : isTerminal ? (
            <Icon className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
          )}
          {!isTerminal && <Icon className="size-3.5 shrink-0 text-muted-foreground" />}
          <span className="truncate text-xs font-medium text-foreground">{upload.title}</span>
        </div>
        <button
          type="button"
          onClick={() => onCancel(upload.id)}
          className="flex size-5 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          title={isTerminal ? "Dismiss" : "Cancel source processing"}
          aria-label={isTerminal ? "Dismiss source status" : "Cancel source processing"}
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className={cn("truncate", isError && "text-destructive")}>{statusText}</span>
      </div>

      {!isTerminal && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/15" aria-hidden="true">
          <div className="h-full w-1/3 animate-[source-progress_1.5s_ease-in-out_infinite] rounded-full bg-primary" />
        </div>
      )}
    </div>
  );
}
