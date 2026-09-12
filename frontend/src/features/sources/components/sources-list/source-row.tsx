import { AlertCircle, Loader2, RotateCcw, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/cn";
import type { Source } from "../../api/sources";
import {
  isSourceProcessing,
  processingStageLabel,
  sourceProcessingError,
  sourceProcessingStatus,
} from "../../utils/source-processing";
import { getSourceIcon } from "./source-icon";

export interface SourceRowProps {
  source: Source;
  onClick: () => void;
  onDelete: () => void;
  onRetry: () => void;
  onCancel: () => void;
  deleting: boolean;
  retrying: boolean;
  cancelling: boolean;
}

export function SourceRow({
  source,
  onClick,
  onDelete,
  onRetry,
  onCancel,
  deleting,
  retrying,
  cancelling,
}: SourceRowProps) {
  const { t } = useTranslation("sources");
  const Icon = getSourceIcon(source);
  const status = sourceProcessingStatus(source);
  const active = isSourceProcessing(source);
  const failed = status === "failed";
  const statusLabel = processingStageLabel(status, source.processingStage, source.modality);
  const error = sourceProcessingError(source);

  return (
    <div className="group relative w-max min-w-full">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "group/row relative flex w-max min-w-full cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl py-2 pl-2 pr-16 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:text-foreground",
          failed
            ? "text-destructive hover:bg-destructive/5"
            : active
              ? "text-primary hover:bg-primary/5"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        title={error ?? statusLabel}
      >
        <span className="w-3.5 shrink-0" />
        {active ? (
          <Loader2 className="size-4 shrink-0 animate-spin" />
        ) : failed ? (
          <AlertCircle className="size-4 shrink-0" />
        ) : (
          <Icon className="size-4 shrink-0" />
        )}
        <span className="truncate">{source.title}</span>
        {status !== "ready" && (
          <span className="max-w-36 truncate text-xs opacity-75">{statusLabel}</span>
        )}
      </button>

      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {failed && (
          <button
            type="button"
            aria-label={t("sourceRow.retryProcessing")}
            title={t("sourceRow.retryProcessing")}
            onClick={(event) => {
              event.stopPropagation();
              onRetry();
            }}
            className="flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {retrying ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RotateCcw className="size-3.5" />
            )}
          </button>
        )}
        {active && (
          <button
            type="button"
            aria-label={t("pendingUpload.cancelProcessing")}
            title={t("pendingUpload.cancelProcessing")}
            onClick={(event) => {
              event.stopPropagation();
              onCancel();
            }}
            className="flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {cancelling ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <X className="size-3.5" />
            )}
          </button>
        )}
        <button
          type="button"
          aria-label={t("sourceRow.delete")}
          title={t("sourceRow.delete")}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className="flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-destructive"
        >
          {deleting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
