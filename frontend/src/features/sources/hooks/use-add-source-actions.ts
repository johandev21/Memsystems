import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("sources");
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
            isYouTube ? t("toasts.youtubeAdded") : t("toasts.urlAdded"),
          ),
        onAbort: () => removePendingUpload(uploadId),
        onError: (error) =>
          handleUploadError(
            uploadId,
            isYouTube ? t("toasts.youtubeAddFailed") : t("toasts.urlAddFailed"),
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
            ? t("toasts.videoAdded")
            : isAudio
              ? t("toasts.audioAdded")
              : isImage
                ? t("toasts.imageAdded")
                : isSlides
                  ? t("toasts.presentationAdded")
                  : isEbook
                    ? t("toasts.ebookAdded")
                    : isTex
                      ? t("toasts.latexAdded")
                      : isBib
                        ? t("toasts.bibtexAdded")
                        : t("toasts.fileAdded"),
        ),
      onAbort: () => removePendingUpload(uploadId),
      onError: (error) =>
        handleUploadError(
          uploadId,
          isVideo
            ? t("toasts.videoUploadFailed")
            : isAudio
              ? t("toasts.audioUploadFailed")
              : isImage
                ? t("toasts.imageUploadFailed")
                : isSlides
                  ? t("toasts.presentationUploadFailed")
                  : isEbook
                    ? t("toasts.ebookUploadFailed")
                    : isTex
                      ? t("toasts.latexUploadFailed")
                      : isBib
                        ? t("toasts.bibtexUploadFailed")
                        : t("toasts.fileUploadFailed"),
          error,
        ),
    });
  };

  const handleStartTextUpload = () => {
    if (!textBody.trim()) return;

    const title = textTitle.trim() || t("toasts.pastedText");
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
      onSuccess: (source) => handleSourceCreated(uploadId, source, t("toasts.textAdded")),
      onAbort: () => removePendingUpload(uploadId),
      onError: (error) => handleUploadError(uploadId, t("toasts.textAddFailed"), error),
    });
  };

  return {
    handleStartUrlUpload,
    handleStartFileUpload,
    handleStartTextUpload,
  };
}
