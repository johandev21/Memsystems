import { createFileSource, createTextSource, createUrlSource } from "../api/sources";
import { useUploadStore, type PendingSourceUpload } from "../hooks/upload-store";
import type { Source } from "../types";

interface UploadActionContext {
  notebookId: string;
  uploadId: string;
  abortController?: AbortController;
  onSuccess: (source: Source) => void;
  onError: (error: Error) => void;
  onAbort: () => void;
}

export function startUrlUpload(
  notebookId: string,
  url: string,
  title: string | undefined,
  context: UploadActionContext,
  options: {
    captionText?: string;
    captionFormat?: string;
    oauthToken?: string;
  } = {},
) {
  return runUpload(
    createUrlSource(notebookId, { url, title, ...options }, context.abortController?.signal),
    context,
  );
}

export function startFileUpload(notebookId: string, file: File, context: UploadActionContext) {
  return runUpload(
    createFileSource(notebookId, file, undefined, context.abortController?.signal),
    context,
  );
}

export function startTextUpload(
  notebookId: string,
  title: string,
  rawText: string,
  context: UploadActionContext,
) {
  return runUpload(
    createTextSource(notebookId, { title, rawText }, context.abortController?.signal),
    context,
  );
}

function runUpload(request: Promise<unknown>, context: UploadActionContext) {
  request
    .then((source) => context.onSuccess(source as Source))
    .catch((error: Error) => {
      if (error.name === "AbortError") {
        context.onAbort();
        return;
      }
      context.onError(error);
    });
}

export const ACCEPTED_SOURCE_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".txt",
  ".md",
  ".markdown",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".heic",
  ".mp3",
  ".m4a",
  ".wav",
  ".webm",
  ".aac",
  ".ogg",
  ".mp4",
  ".mov",
  ".mkv",
  ".pptx",
  ".epub",
  ".tex",
  ".bib",
  ".ipynb",
  ".csv",
  ".tsv",
  ".tab",
  ".xlsx",
  ".xls",
  ".ods",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".rs",
  ".go",
  ".java",
  ".cpp",
  ".c",
  ".h",
  ".cs",
  ".sql",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".sh",
  ".bash",
];

export const ACCEPTED_SOURCE_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/markdown",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/webm",
  "audio/aac",
  "audio/x-aac",
  "audio/ogg",
  "audio/vorbis",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
  "video/mkv",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/epub+zip",
  "application/x-tex",
  "text/x-bibtex",
  "application/x-bibtex",
  "application/x-ipynb+json",
  "application/vnd.jupyter.notebook+json",
  "text/csv",
  "text/tab-separated-values",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/x-typescript",
  "text/typescript",
  "application/typescript",
  "text/javascript",
  "application/javascript",
  "text/x-python",
  "application/x-python-code",
  "text/x-rust",
  "text/x-go",
  "text/x-sql",
  "application/json",
];

export function isClientSupportedSourceFile(file: File): boolean {
  if (file.type.startsWith("video/")) return true;
  if (file.type.startsWith("audio/")) return true;
  if (file.type.startsWith("image/")) return true;
  if (ACCEPTED_SOURCE_MIME_TYPES.includes(file.type.toLowerCase())) return true;
  const name = file.name.toLowerCase();
  return ACCEPTED_SOURCE_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/** Kept as a small compatibility seam for callers that update an upload row. */
export function updateUploadProgress(
  uploadId: string,
  update:
    | Partial<PendingSourceUpload>
    | ((prev: PendingSourceUpload) => Partial<PendingSourceUpload>),
) {
  useUploadStore.getState().updatePendingUpload(uploadId, update);
}
