import type { FileUIPart } from "ai";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { validateIncomingFiles } from "../../utils/prompt-input-files";
import type { PromptInputControllerProps } from "./prompt-input-context";

export interface UsePromptInputFilesOptions {
  accept?: string;
  maxFiles?: number;
  maxFileSize?: number;
  onError?: (err: { code: "max_files" | "max_file_size" | "accept"; message: string }) => void;
  controller: PromptInputControllerProps | null;
  usingProvider: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
}

const EMPTY_FILE_LIST: (FileUIPart & { id: string })[] = [];
export function usePromptInputFiles({
  accept,
  maxFiles,
  maxFileSize,
  onError,
  controller,
  usingProvider,
  inputRef,
}: UsePromptInputFilesOptions) {
  const [items, setItems] = useState<(FileUIPart & { id: string })[]>([]);
  const providerFiles = controller?.attachments.files;
  const files = usingProvider ? (providerFiles ?? EMPTY_FILE_LIST) : items;

  const filesRef = useRef(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  // Revoke leftover blob URLs for the local (non-provider) mode on unmount.
  useEffect(
    () => () => {
      if (!usingProvider) {
        for (const f of filesRef.current) {
          if (f.url) {
            URL.revokeObjectURL(f.url);
          }
        }
      }
    },
    [usingProvider],
  );

  const openFileDialogLocal = useCallback(() => {
    inputRef.current?.click();
  }, [inputRef]);

  const addLocal = useCallback(
    (fileList: File[] | FileList) => {
      const incoming = [...fileList];
      const capped = validateIncomingFiles(incoming, {
        accept,
        maxFileSize,
        maxFiles,
        currentCount: items.length,
        onError,
      });
      if (capped.length === 0) return;
      const next: (FileUIPart & { id: string })[] = capped.map((file) => ({
        filename: file.name,
        id: nanoid(),
        mediaType: file.type,
        type: "file" as const,
        url: URL.createObjectURL(file),
      }));
      setItems((prev) => [...prev, ...next]);
    },
    [accept, items.length, maxFileSize, maxFiles, onError],
  );

  const removeLocal = useCallback(
    (id: string) => {
      const found = items.find((file) => file.id === id);
      if (found?.url) {
        URL.revokeObjectURL(found.url);
      }
      setItems((prev) => prev.filter((file) => file.id !== id));
    },
    [items],
  );

  const addWithProviderValidation = useCallback(
    (fileList: File[] | FileList) => {
      const incoming = [...fileList];
      const capped = validateIncomingFiles(incoming, {
        accept,
        maxFileSize,
        maxFiles,
        currentCount: files.length,
        onError,
      });
      if (capped.length > 0) {
        controller?.attachments.add(capped);
      }
    },
    [accept, maxFileSize, maxFiles, onError, files.length, controller],
  );

  const clearAttachments = useCallback(() => {
    if (usingProvider) {
      controller?.attachments.clear();
      return;
    }
    for (const file of items) {
      if (file.url) {
        URL.revokeObjectURL(file.url);
      }
    }
    setItems([]);
  }, [usingProvider, controller, items]);

  const add = usingProvider ? addWithProviderValidation : addLocal;
  const remove = usingProvider ? (controller?.attachments.remove ?? removeLocal) : removeLocal;
  const openFileDialog = usingProvider
    ? (controller?.attachments.openFileDialog ?? openFileDialogLocal)
    : openFileDialogLocal;

  return { files, add, remove, clearAttachments, openFileDialog };
}
