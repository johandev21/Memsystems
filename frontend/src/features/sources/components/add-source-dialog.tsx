import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactElement, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { SOURCE_LIMIT, sourcesQueryOptions } from "@/shared/api";
import { useUploadStore } from "../model/upload-store";
import { useAddSourceDialogState } from "../model/use-add-source-dialog-state";
import { startFileUpload, startTextUpload, startUrlUpload } from "../model/source-upload-actions";
import { FileUploadMode } from "./file-upload-mode";
import { TextInputMode } from "./text-input-mode";
import { UrlInputMode } from "./url-input-mode";

function deriveTitleFromUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname + (parsed.pathname.length > 1 ? parsed.pathname : "");
  } catch {
    return rawUrl;
  }
}

export function AddSourceDialog({
  notebookId,
  children,
}: {
  notebookId: string;
  children: ReactElement;
}) {
  const queryClient = useQueryClient();
  const { data: sources } = useQuery(sourcesQueryOptions(notebookId));
  const addPendingUpload = useUploadStore((state) => state.addPendingUpload);
  const updatePendingUpload = useUploadStore((state) => state.updatePendingUpload);
  const removePendingUpload = useUploadStore((state) => state.removePendingUpload);

  const [open, setOpen] = useState(false);
  const sourceState = useAddSourceDialogState();
  const {
    mode,
    setMode,
    urlValue,
    setUrlValue,
    urlTitle,
    setUrlTitle,
    textTitle,
    setTextTitle,
    textBody,
    setTextBody,
    reset,
  } = sourceState;

  const count = sources?.length ?? 0;
  const usedPercent = Math.min((count / SOURCE_LIMIT) * 100, 100);

  const handleCloseAndReset = () => {
    setOpen(false);
    reset();
  };

  // --- Background Upload Handlers (Non-Blocking) ---

  const handleStartUrlUpload = () => {
    if (!urlValue.trim()) return;

    const targetUrl = urlValue.trim();
    const title = urlTitle.trim() || deriveTitleFromUrl(targetUrl);
    const abortController = new AbortController();

    // 1. Close dialog immediately so UI is not blocked
    handleCloseAndReset();

    // 2. Add optimistic pending item to upload store
    const uploadId = addPendingUpload({
      notebookId,
      kind: "url",
      title,
      url: targetUrl,
      abortController,
      initialProgress: 15,
      initialStatusText: "Connecting & fetching webpage...",
    });

    // 3. Smooth progress simulation interval while network call completes
    const timerId = setInterval(() => {
      useUploadStore.getState().updatePendingUpload(uploadId, (prev) => {
        if (!prev || prev.status === "completed" || prev.status === "error") {
          return {};
        }
        let nextProgress = prev.progress + Math.floor(Math.random() * 15) + 10;
        let statusText = prev.statusText;
        let status = prev.status;

        if (nextProgress >= 90) {
          nextProgress = 90;
          statusText = "Processing & indexing source...";
          status = "processing";
        } else if (nextProgress >= 55) {
          statusText = "Extracting article content & cleaning text...";
          status = "extracting";
        }

        return { progress: nextProgress, statusText, status };
      });
    }, 600);

    updatePendingUpload(uploadId, { timerId });

    // 4. Trigger backend mutation
    startUrlUpload(notebookId, targetUrl, urlTitle.trim() || undefined, {
      notebookId,
      uploadId,
      timerId,
      onSuccess: () => {
        clearInterval(timerId);
        updatePendingUpload(uploadId, {
          progress: 100,
          status: "completed",
          statusText: "Ready",
        });

        queryClient.invalidateQueries({ queryKey: ["sources", notebookId] });
        toast.success("Website source added successfully");

        setTimeout(() => {
          removePendingUpload(uploadId);
        }, 400);
      },
      onAbort: () => {
        clearInterval(timerId);
        removePendingUpload(uploadId);
      },
      onError: (err) => {
        clearInterval(timerId);
        updatePendingUpload(uploadId, {
          status: "error",
          errorMessage: err.message || "Failed to extract website",
        });
        toast.error(err.message || "Failed to add website source");
      },
    });
  };

  const handleStartFileUpload = (file: File) => {
    const abortController = new AbortController();

    handleCloseAndReset();

    const uploadId = addPendingUpload({
      notebookId,
      kind: "file",
      title: file.name,
      abortController,
      initialProgress: 20,
      initialStatusText: "Uploading file...",
    });

    const timerId = setInterval(() => {
      useUploadStore.getState().updatePendingUpload(uploadId, (prev) => {
        if (!prev || prev.status === "completed" || prev.status === "error") {
          return {};
        }
        let nextProgress = prev.progress + Math.floor(Math.random() * 20) + 15;
        let statusText = prev.statusText;

        if (nextProgress >= 90) {
          nextProgress = 90;
          statusText = "Parsing document content...";
        } else if (nextProgress >= 50) {
          statusText = "Extracting text from file...";
        }

        return { progress: nextProgress, statusText };
      });
    }, 500);

    updatePendingUpload(uploadId, { timerId });

    startFileUpload(notebookId, file, {
      notebookId,
      uploadId,
      timerId,
      onSuccess: () => {
        clearInterval(timerId);
        updatePendingUpload(uploadId, {
          progress: 100,
          status: "completed",
          statusText: "Ready",
        });

        queryClient.invalidateQueries({ queryKey: ["sources", notebookId] });
        toast.success("File added successfully");

        setTimeout(() => {
          removePendingUpload(uploadId);
        }, 400);
      },
      onAbort: () => {
        clearInterval(timerId);
        removePendingUpload(uploadId);
      },
      onError: (err) => {
        clearInterval(timerId);
        updatePendingUpload(uploadId, {
          status: "error",
          errorMessage: err.message || "Failed to upload file",
        });
        toast.error(err.message || "Failed to upload file");
      },
    });
  };

  const handleStartTextUpload = () => {
    if (!textBody.trim()) return;

    const title = textTitle.trim() || "Pasted text";
    const abortController = new AbortController();

    handleCloseAndReset();

    const uploadId = addPendingUpload({
      notebookId,
      kind: "text",
      title,
      abortController,
      initialProgress: 30,
      initialStatusText: "Saving text source...",
    });

    startTextUpload(notebookId, title, textBody, {
      notebookId,
      uploadId,
      onSuccess: () => {
        updatePendingUpload(uploadId, {
          progress: 100,
          status: "completed",
          statusText: "Ready",
        });

        queryClient.invalidateQueries({ queryKey: ["sources", notebookId] });
        toast.success("Text source added successfully");

        setTimeout(() => {
          removePendingUpload(uploadId);
        }, 400);
      },
      onAbort: () => removePendingUpload(uploadId),
      onError: (err) => {
        updatePendingUpload(uploadId, {
          status: "error",
          errorMessage: err.message || "Failed to add text source",
        });
        toast.error(err.message || "Failed to add text source");
      },
    });
  };

  const isNativeButton = children.type === "button";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger render={children} nativeButton={isNativeButton} />
      <DialogContent
        motion={false}
        className="sm:max-w-[550px] p-0 overflow-hidden border-border/60 bg-card shadow-2xl rounded-[min(var(--radius-4xl),24px)]"
      >
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-xl font-semibold text-center text-foreground">
            Add Knowledge Sources
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 pt-2 flex flex-col gap-6">
          {mode === "menu" && (
            <FileUploadMode
              onSelectUrlMode={() => setMode("url")}
              onSelectTextMode={() => setMode("text")}
              onUploadFile={handleStartFileUpload}
              isUploading={false}
              busy={false}
            />
          )}

          {mode === "url" && (
            <UrlInputMode
              urlValue={urlValue}
              onUrlValueChange={setUrlValue}
              urlTitle={urlTitle}
              onUrlTitleChange={setUrlTitle}
              onSubmit={handleStartUrlUpload}
              onBack={() => setMode("menu")}
              isPending={false}
              busy={false}
            />
          )}

          {mode === "text" && (
            <TextInputMode
              textTitle={textTitle}
              onTextTitleChange={setTextTitle}
              textBody={textBody}
              onTextBodyChange={setTextBody}
              onSubmit={handleStartTextUpload}
              onBack={() => setMode("menu")}
              isPending={false}
              busy={false}
            />
          )}

          <SourceLimitMeter count={count} usedPercent={usedPercent} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SourceLimitMeter({ count, usedPercent }: { count: number; usedPercent: number }) {
  return (
    <div className="flex flex-col gap-2 px-2">
      <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
        <span>Sources Limit</span>
        <span className="text-foreground">
          {count} / {SOURCE_LIMIT}
        </span>
      </div>
      <div className="h-1.5 w-full bg-muted overflow-hidden rounded-full">
        <div className="h-full rounded-full bg-primary" style={{ width: `${usedPercent}%` }} />
      </div>
    </div>
  );
}
