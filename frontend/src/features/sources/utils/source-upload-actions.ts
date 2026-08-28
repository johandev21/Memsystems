import { createFileSource, createTextSource, createUrlSource } from "../api/sources";
import { useUploadStore, type PendingSourceUpload } from "../hooks/upload-store";

interface UploadActionContext {
  notebookId: string;
  uploadId: string;
  timerId?: ReturnType<typeof setInterval>;
  onSuccess: () => void;
  onError: (error: Error) => void;
  onAbort: () => void;
}

export function startUrlUpload(
  notebookId: string,
  url: string,
  title: string | undefined,
  context: UploadActionContext,
) {
  return runUpload(createUrlSource(notebookId, { url, title }), context);
}

export function startFileUpload(notebookId: string, file: File, context: UploadActionContext) {
  return runUpload(createFileSource(notebookId, file), context);
}

export function startTextUpload(
  notebookId: string,
  title: string,
  rawText: string,
  context: UploadActionContext,
) {
  return runUpload(createTextSource(notebookId, { title, rawText }), context);
}

function runUpload(request: Promise<unknown>, context: UploadActionContext) {
  request.then(context.onSuccess).catch((error: Error) => {
    if (error.name === "AbortError") {
      context.onAbort();
      return;
    }
    context.onError(error);
  });
}

export function updateUploadProgress(
  uploadId: string,
  update:
    | Partial<PendingSourceUpload>
    | ((prev: PendingSourceUpload) => Partial<PendingSourceUpload>),
) {
  useUploadStore.getState().updatePendingUpload(uploadId, update);
}
