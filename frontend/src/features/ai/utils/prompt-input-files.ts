import type { FileUIPart } from "ai";
import { nanoid } from "nanoid";

export type PromptInputFileError = {
  code: "max_files" | "max_file_size" | "accept";
  message: string;
};

function matchesAccept(file: File, accept?: string) {
  if (!accept?.trim()) return true;
  return accept
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .some((pattern) =>
      pattern.endsWith("/*") ? file.type.startsWith(pattern.slice(0, -1)) : file.type === pattern,
    );
}

export function validateIncomingFiles(
  files: File[],
  options: {
    accept?: string;
    maxFileSize?: number;
    maxFiles?: number;
    currentCount?: number;
    onError?: (error: PromptInputFileError) => void;
  },
) {
  const accepted = files.filter((file) => matchesAccept(file, options.accept));
  if (files.length > 0 && accepted.length === 0) {
    options.onError?.({ code: "accept", message: "No files match the accepted types." });
    return [];
  }
  const sized = options.maxFileSize
    ? accepted.filter((file) => file.size <= options.maxFileSize!)
    : accepted;
  if (accepted.length > 0 && sized.length === 0) {
    options.onError?.({ code: "max_file_size", message: "All files exceed the maximum size." });
    return [];
  }
  const capacity =
    typeof options.maxFiles === "number"
      ? Math.max(0, options.maxFiles - (options.currentCount ?? 0))
      : undefined;
  if (typeof capacity === "number" && sized.length > capacity)
    options.onError?.({ code: "max_files", message: "Too many files. Some were not added." });
  return typeof capacity === "number" ? sized.slice(0, capacity) : sized;
}

export function createFileParts(files: File[]): (FileUIPart & { id: string })[] {
  return files.map((file) => ({
    filename: file.name,
    id: nanoid(),
    mediaType: file.type,
    type: "file" as const,
    url: "",
  }));
}

async function convertBlobUrlToDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function convertFilePartsForSubmit(
  files: (FileUIPart & { id?: string })[],
): Promise<FileUIPart[]> {
  return Promise.all(
    files.map(async ({ id: _id, ...file }) => ({
      ...file,
      url: file.url?.startsWith("blob:")
        ? ((await convertBlobUrlToDataUrl(file.url)) ?? file.url)
        : file.url,
    })),
  );
}
