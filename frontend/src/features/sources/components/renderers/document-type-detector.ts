import type { SourceWithContent } from "../../types";

export type DocumentType =
  | "markdown"
  | "image"
  | "audio"
  | "video"
  | "slides"
  | "dataset";

const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "mkv"]);

const AUDIO_EXTENSIONS = new Set(["mp3", "m4a", "wav", "webm", "aac", "ogg"]);

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "heic",
  "heif",
  "gif",
  "svg",
  "bmp",
]);

const TABULAR_EXTENSIONS = new Set([
  "csv",
  "tsv",
  "tab",
  "xlsx",
  "xls",
  "ods",
]);

export function isYouTubeUrl(url?: string | null): boolean {
  if (!url) return false;
  return /(?:youtube\.com\/(?:watch\?|embed\/|v\/|shorts\/)|youtu\.be\/)/i.test(url);
}

export function extractYouTubeId(url?: string | null): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
  );
  return match ? match[1] : null;
}

export function detectDocumentType(source: SourceWithContent): DocumentType {
  if (source.modality === "slides") {
    return "slides";
  }
  if (source.modality === "dataset") {
    return "dataset";
  }
  if (
    source.modality === "video" ||
    source.contentType?.startsWith("video/") ||
    isYouTubeUrl(source.url)
  ) {
    return "video";
  }
  if (source.modality === "audio" || source.contentType?.startsWith("audio/")) {
    return "audio";
  }
  if (source.modality === "image" || source.contentType?.startsWith("image/")) {
    return "image";
  }

  const titleLower = (source.title || "").toLowerCase();
  const extMatch = titleLower.match(/\.([a-z0-9]+)$/);
  const extension = extMatch ? extMatch[1] : "";

  const ct = source.contentType?.toLowerCase() ?? "";
  if (
    ct === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    extension === "pptx"
  ) {
    return "slides";
  }
  if (
    ct === "text/csv" ||
    ct === "text/tab-separated-values" ||
    ct === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    ct === "application/vnd.ms-excel" ||
    TABULAR_EXTENSIONS.has(extension)
  ) {
    return "dataset";
  }

  if (VIDEO_EXTENSIONS.has(extension)) {
    return "video";
  }

  if (AUDIO_EXTENSIONS.has(extension)) {
    return "audio";
  }

  if (IMAGE_EXTENSIONS.has(extension)) {
    return "image";
  }

  // All student text sources (.md, .txt, .epub, scraped URLs, etc.) map to unified markdown viewer
  return "markdown";
}

export function splitTextIntoChunks(rawText: string): string[] {
  if (!rawText) return [];
  return rawText.split(/\n\n+/).filter((chunk) => chunk.trim().length > 0);
}
