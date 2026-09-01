import type { SourceWithContent } from "../types";

export type DocumentType =
  | "markdown"
  | "code"
  | "article"
  | "plaintext"
  | "image"
  | "audio"
  | "video"
  | "slides"
  | "epub"
  | "tex"
  | "bibtex";

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

const CODE_EXTENSIONS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "json",
  "py",
  "sh",
  "bash",
  "zsh",
  "sql",
  "html",
  "css",
  "scss",
  "yaml",
  "yml",
  "xml",
  "toml",
  "rs",
  "go",
  "java",
  "cpp",
  "c",
  "h",
  "cs",
  "php",
  "rb",
  "swift",
  "kt",
  "dockerfile",
  "env",
  "log",
  "csv",
  "tsv",
]);

const MARKDOWN_EXTENSIONS = new Set(["md", "markdown", "mdown", "mkdn", "mdx"]);

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
  if (source.modality === "ebook") {
    return "epub";
  }

  const ct = source.contentType?.toLowerCase() ?? "";
  if (ct === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
    return "slides";
  }
  if (ct === "application/epub+zip") {
    return "epub";
  }
  if (ct === "application/x-tex") {
    return "tex";
  }
  if (ct === "text/x-bibtex" || ct === "application/x-bibtex") {
    return "bibtex";
  }

  if (source.modality === "video") {
    return "video";
  }

  if (source.contentType?.startsWith("video/")) {
    return "video";
  }

  if (source.modality === "audio") {
    return "audio";
  }

  if (source.contentType?.startsWith("audio/")) {
    return "audio";
  }

  if (source.modality === "image") {
    return "image";
  }

  if (source.contentType?.startsWith("image/")) {
    return "image";
  }

  const titleLower = (source.title || "").toLowerCase();
  const extMatch = titleLower.match(/\.([a-z0-9]+)$/);
  const extension = extMatch ? extMatch[1] : "";

  if (extension === "pptx") return "slides";
  if (extension === "epub") return "epub";
  if (extension === "tex") return "tex";
  if (extension === "bib") return "bibtex";

  if (VIDEO_EXTENSIONS.has(extension)) {
    return "video";
  }

  if (AUDIO_EXTENSIONS.has(extension)) {
    return "audio";
  }

  if (IMAGE_EXTENSIONS.has(extension)) {
    return "image";
  }

  if (isYouTubeUrl(source.url)) {
    return "video";
  }

  if (MARKDOWN_EXTENSIONS.has(extension)) {
    return "markdown";
  }

  if (CODE_EXTENSIONS.has(extension)) {
    return "code";
  }

  if (source.kind === "url") {
    return "article";
  }

  const text = source.rawText || "";

  if (
    /^#{1,6}\s+/m.test(text) ||
    /```[a-z0-9]*\n[\s\S]*?```/m.test(text) ||
    /\n---+\n/.test(text)
  ) {
    return "markdown";
  }

  return "plaintext";
}

export function getLanguageFromTitle(title: string): string {
  const lower = title.toLowerCase();
  const ext = lower.split(".").pop() || "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    json: "json",
    py: "python",
    sh: "bash",
    sql: "sql",
    html: "html",
    css: "css",
    yaml: "yaml",
    yml: "yaml",
    xml: "xml",
    csv: "csv",
  };
  return map[ext] || ext || "text";
}

export function splitTextIntoChunks(rawText: string): string[] {
  if (!rawText) return [];
  return rawText.split(/\n\n+/).filter((chunk) => chunk.trim().length > 0);
}
