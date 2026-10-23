import {
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/cn";
import type { PendingSourceUpload } from "../hooks/use-upload-store";
import { MarkdownIcon } from "./sources-list/markdown-icon";
import { processingStageLabel } from "../utils/source-processing";
import { sourceDisplayTitle } from "../utils/source-display-title";

interface PendingUploadRowProps {
  upload: PendingSourceUpload;
  onCancel: (id: string) => void;
}

function UploadStatusIcon({
  isError,
  isTerminal,
}: {
  isError: boolean;
  isTerminal: boolean;
}) {
  if (isError) {
    return <AlertCircle className="size-4 shrink-0 text-destructive" />;
  }
  if (isTerminal) {
    return <MarkdownIcon className="size-4 shrink-0 text-muted-foreground" />;
  }
  return <Loader2 className="size-4 shrink-0 animate-spin text-primary" />;
}

function UploadHeader({
  upload,
  isError,
  isTerminal,
  onCancel,
}: {
  upload: PendingSourceUpload;
  isError: boolean;
  isTerminal: boolean;
  onCancel: (id: string) => void;
}) {
  const { t } = useTranslation("sources");
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <UploadStatusIcon isError={isError} isTerminal={isTerminal} />
        {(!isTerminal || isError) && (
          <MarkdownIcon className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate text-xs font-medium text-foreground">{sourceDisplayTitle(upload)}</span>
      </div>
      <button
        type="button"
        onClick={() => onCancel(upload.id)}
        className="flex size-5 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        title={isTerminal ? t("pendingUpload.dismiss") : t("pendingUpload.cancelProcessing")}
        aria-label={
          isTerminal ? t("pendingUpload.dismissStatus") : t("pendingUpload.cancelProcessing")
        }
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

function UploadProgressBar() {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/15" aria-hidden="true">
      <div className="h-full w-1/3 rounded-full bg-primary" />
    </div>
  );
}

export function PendingUploadRow({ upload, onCancel }: PendingUploadRowProps) {
  const { t } = useTranslation("sources");
  const isError = upload.status === "failed";
  const isCancelled = upload.status === "cancelled";
  const isTerminal = isError || isCancelled;
  const statusText = isError
    ? upload.errorMessage || t("pendingUpload.processingFailed")
    : isCancelled
      ? t("pendingUpload.cancelled")
      : upload.status === "uploading"
        ? t("pendingUpload.saving")
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
      <UploadHeader
        upload={upload}
        isError={isError}
        isTerminal={isTerminal}
        onCancel={onCancel}
      />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className={cn("truncate", isError && "text-destructive")}>{statusText}</span>
      </div>

      {!isTerminal && <UploadProgressBar />}
    </div>
  );
}
