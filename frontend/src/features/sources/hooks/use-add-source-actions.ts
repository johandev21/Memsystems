import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Source } from "../api/sources";
import { useUploadStore } from "./use-upload-store";
import type { useAddSourceDialogState } from "./use-add-source-dialog-state";
import { startFileUpload, startTextUpload, startUrlUpload } from "../utils/source-upload-actions";
import { isYouTubeUrl } from "../utils/detect-document-type";

function deriveTitleFromUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname + (parsed.pathname.length > 1 ? parsed.pathname : "");
  } catch {
    return rawUrl;
  }
}

export function useAddSourceActions(
  notebookId: string,
  sourceState: ReturnType<typeof useAddSourceDialogState>,
  onCloseAndReset: () => void,
) {
  const queryClient = useQueryClient();
  const addPendingUpload = useUploadStore((state) => state.addPendingUpload);
  const updatePendingUpload = useUploadStore((state) => state.updatePendingUpload);
  const removePendingUpload = useUploadStore((state) => state.removePendingUpload);

  const {
    urlValue,
    urlTitle,
    captionText,
    oauthToken,
    textTitle,
    textBody,
  } = sourceState;

  const handleSourceCreated = (uploadId: string, source: Source, successMessage: string) => {
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
    onCloseAndReset();

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
            isYouTube ? "YouTube video source added" : "URL source added",
          ),
        onAbort: () => removePendingUpload(uploadId),
        onError: (error) =>
          handleUploadError(
            uploadId,
            isYouTube ? "Failed to add YouTube video source" : "Failed to add URL source",
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
    onCloseAndReset();

    const isVideo = file.type.startsWith("video/") || /\.(mp4|webm|mov|mkv)$/i.test(file.name);
    const isAudio =
      !isVideo &&
      (file.type.startsWith("audio/") || /\.(mp3|m4a|wav|webm|aac|ogg)$/i.test(file.name));
    const isImage =
      file.type.startsWith("image/") ||
      /\.(png|jpe?g|webp|heic|heif|gif|svg|bmp)$/i.test(file.name);
    const isSlides =
      file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
      /\.pptx$/i.test(file.name);
    const isEbook = file.type === "application/epub+zip" || /\.epub$/i.test(file.name);
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
    onCloseAndReset();

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

  return {
    handleStartUrlUpload,
    handleStartFileUpload,
    handleStartTextUpload,
  };
}
