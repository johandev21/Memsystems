import { File, FileText, Globe, Loader2, X, AlertCircle } from "lucide-react";
import type { SourceKind } from "@/features/sources";
import { cn } from "@/shared/utils/cn";
import type { PendingSourceUpload } from "../hooks/use-upload-store";

function getKindIcon(kind: SourceKind) {
  switch (kind) {
    case "url":
      return Globe;
    case "file":
      return FileText;
    case "text":
      return File;
    default:
      return File;
  }
}

interface PendingUploadRowProps {
  upload: PendingSourceUpload;
  onCancel: (id: string) => void;
}

export function PendingUploadRow({ upload, onCancel }: PendingUploadRowProps) {
  const Icon = getKindIcon(upload.kind);
  const isError = upload.status === "error";

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-2 p-2.5 rounded-xl border transition-all duration-300 animate-in fade-in slide-in-from-top-1",
        isError
          ? "border-destructive/40 bg-destructive/5"
          : "border-primary/30 bg-primary/5 shadow-xs",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isError ? (
            <AlertCircle className="size-4 shrink-0 text-destructive" />
          ) : (
            <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
          )}
          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground truncate">{upload.title}</span>
        </div>
        <button
          type="button"
          onClick={() => onCancel(upload.id)}
          className="size-5 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
          title="Cancel upload"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Status details & percentage */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="truncate max-w-[180px]">
          {isError ? upload.errorMessage || "Failed to add source" : upload.statusText}
        </span>
        {!isError && (
          <span className="font-semibold text-primary">{Math.round(upload.progress)}%</span>
        )}
      </div>

      {/* Micro Progress Bar */}
      {!isError && (
        <div className="h-1.5 w-full bg-primary/15 overflow-hidden rounded-full">
          <div
            className="h-full bg-primary transition-all duration-300 rounded-full"
            style={{ width: `${Math.max(5, upload.progress)}%` }}
          />
        </div>
      )}
    </div>
  );
}
