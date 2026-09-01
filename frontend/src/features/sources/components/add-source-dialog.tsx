import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactElement, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SOURCE_LIMIT, sourcesQueryOptions, type Source } from "../api/sources";
import { useUploadStore } from "../hooks/use-upload-store";
import { useAddSourceDialogState } from "../hooks/use-add-source-dialog-state";
import { startFileUpload, startTextUpload, startUrlUpload } from "../utils/source-upload-actions";
import { isYouTubeUrl } from "../utils/detect-document-type";
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
    captionText,
    setCaptionText,
    oauthToken,
    setOauthToken,
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

  const handleSourceCreated = (uploadId: string, source: Source, successMessage: string) => {
    // Put the server receipt in the list immediately. The list query then
    // polls the source's real processing state until it reaches a terminal state.
    queryClient.setQueryData<Source[]>(["sources", notebookId], (current) => {
      const existing = current ?? [];
      return [source, ...existing.filter((item) => item.id !== source.id)];
    });
    removePendingUpload(uploadId);
    toast.success(successMessage);
  };

  const handleUploadError = (uploadId: string, message: string, error: Error) => {
    updatePendingUpload(uploadId, {
      status: "failed",
      errorMessage: error.message || message,
    });
    toast.error(error.message || message);
  };

  const handleStartUrlUpload = () => {
    if (!urlValue.trim()) return;

    const targetUrl = urlValue.trim();
    const title = urlTitle.trim() || deriveTitleFromUrl(targetUrl);
    const abortController = new AbortController();
    handleCloseAndReset();

    const isYouTube = isYouTubeUrl(targetUrl);
    const uploadId = addPendingUpload({
      notebookId,
      kind: "url",
      modality: isYouTube ? "video" : undefined,
      title,
      url: targetUrl,
      abortController,
    });

    startUrlUpload(
      notebookId,
      targetUrl,
      urlTitle.trim() || undefined,
      {
        notebookId,
        uploadId,
        abortController,
        onSuccess: (source) =>
          handleSourceCreated(
            uploadId,
            source,
            isYouTube
              ? "YouTube video source added"
              : "URL source added",
          ),
        onAbort: () => removePendingUpload(uploadId),
        onError: (error) =>
          handleUploadError(
            uploadId,
            isYouTube
              ? "Failed to add YouTube video source"
              : "Failed to add URL source",
            error,
          ),
      },
      {
        captionText: captionText.trim() || undefined,
        oauthToken: oauthToken.trim() || undefined,
      },
    );
  };

  const handleStartFileUpload = (file: File) => {
    const abortController = new AbortController();
    handleCloseAndReset();

    const isVideo =
      file.type.startsWith("video/") ||
      /\.(mp4|webm|mov|mkv)$/i.test(file.name);
    const isAudio =
      !isVideo &&
      (file.type.startsWith("audio/") ||
       /\.(mp3|m4a|wav|webm|aac|ogg)$/i.test(file.name));
    const isImage =
      file.type.startsWith("image/") ||
      /\.(png|jpe?g|webp|heic|heif|gif|svg|bmp)$/i.test(file.name);
    const isSlides =
      file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
      /\.pptx$/i.test(file.name);
    const isEbook =
      file.type === "application/epub+zip" || /\.epub$/i.test(file.name);
    const isTex = file.type === "application/x-tex" || /\.tex$/i.test(file.name);
    const isBib =
      file.type === "text/x-bibtex" ||
      file.type === "application/x-bibtex" ||
      /\.bib$/i.test(file.name);

    const modality: Source["modality"] = isVideo
      ? "video"
      : isAudio
        ? "audio"
        : isImage
          ? "image"
          : isSlides
            ? "slides"
            : isEbook
              ? "ebook"
              : "document";

    const uploadId = addPendingUpload({
      notebookId,
      kind: "file",
      modality,
      title: file.name,
      abortController,
    });

    startFileUpload(notebookId, file, {
      notebookId,
      uploadId,
      abortController,
      onSuccess: (source) =>
        handleSourceCreated(
          uploadId,
          source,
          isVideo
            ? "Video source added"
            : isAudio
              ? "Audio source added"
              : isImage
                ? "Image source added"
                : isSlides
                  ? "Presentation source added"
                  : isEbook
                    ? "eBook source added"
                    : isTex
                      ? "LaTeX source added"
                      : isBib
                        ? "BibTeX source added"
                        : "File source added",
        ),
      onAbort: () => removePendingUpload(uploadId),
      onError: (error) =>
        handleUploadError(
          uploadId,
          isVideo
            ? "Failed to upload video"
            : isAudio
              ? "Failed to upload audio"
              : isImage
                ? "Failed to upload image"
                : isSlides
                  ? "Failed to upload presentation"
                  : isEbook
                    ? "Failed to upload eBook"
                    : isTex
                      ? "Failed to upload LaTeX file"
                      : isBib
                        ? "Failed to upload BibTeX file"
                        : "Failed to upload file",
          error,
        ),
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
    });

    startTextUpload(notebookId, title, textBody, {
      notebookId,
      uploadId,
      abortController,
      onSuccess: (source) => handleSourceCreated(uploadId, source, "Text source added"),
      onAbort: () => removePendingUpload(uploadId),
      onError: (error) => handleUploadError(uploadId, "Failed to add text source", error),
    });
  };

  const isNativeButton = children.type === "button";

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) reset();
      }}
    >
      <DialogTrigger render={children} nativeButton={isNativeButton} />
      <DialogContent
        motion={false}
        className="sm:max-w-[550px] overflow-hidden rounded-[min(var(--radius-4xl),24px)] border-border/60 bg-card p-0 shadow-2xl"
      >
        <DialogHeader className="px-6 pb-2 pt-6">
          <DialogTitle className="text-center text-xl font-semibold text-foreground">
            Add Knowledge Sources
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6 px-6 pb-6 pt-2">
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
              captionText={captionText}
              onCaptionTextChange={setCaptionText}
              oauthToken={oauthToken}
              onOauthTokenChange={setOauthToken}
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
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${usedPercent}%` }} />
      </div>
    </div>
  );
}
