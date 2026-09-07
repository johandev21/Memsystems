import type { Source, SourceWithContent } from "../types";

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
  | "bibtex"
  | "jupyter"
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

const TABULAR_EXTENSIONS = new Set(["csv", "tsv", "tab", "xlsx", "xls", "ods"]);

const JUPYTER_EXTENSIONS = new Set(["ipynb"]);

const CODE_EXTENSIONS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "json",
  "py",
  "pyw",
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
  "cc",
  "cxx",
  "c",
  "h",
  "hpp",
  "cs",
  "php",
  "rb",
  "swift",
  "kt",
  "kts",
  "dockerfile",
  "env",
  "log",
  "lua",
  "r",
  "scala",
]);

const MARKDOWN_EXTENSIONS = new Set(["md", "markdown", "mdown", "mkdn", "mdx"]);

const TEXT_EXTENSIONS = new Set(["txt", "text", "log"]);

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

export function isArXivUrl(urlOrId?: string | null): boolean {
  if (!urlOrId) return false;
  const trimmed = urlOrId.trim();
  if (/^\d{4}\.\d{4,5}(?:v\d+)?$/i.test(trimmed)) return true;
  if (/^[a-zA-Z\-]+(?:\.[A-Za-z]{2})?\/\d{7}(?:v\d+)?$/i.test(trimmed)) return true;
  if (/^arxiv:\s*[a-zA-Z0-9.\-\/]+$/i.test(trimmed)) return true;
  return /(?:arxiv\.org\/(?:abs|pdf|html)\/|arxiv:\s*)/i.test(trimmed);
}

export function extractArXivId(urlOrId?: string | null): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();
  const match =
    trimmed.match(/^\d{4}\.\d{4,5}(?:v\d+)?$/i) ||
    trimmed.match(/^[a-zA-Z\-]+(?:\.[A-Za-z]{2})?\/\d{7}(?:v\d+)?$/i) ||
    trimmed.match(/^arxiv:\s*([a-zA-Z0-9.\-\/]+)$/i) ||
    trimmed.match(
      /(?:arxiv\.org\/(?:abs|pdf|html)\/|arxiv:\s*)([a-zA-Z0-9.\-\/]+?)(?:\.pdf|\/|$|\s|\?)/i,
    );
  return match ? match[1] || match[0] : null;
}

export function isDoi(urlOrId?: string | null): boolean {
  if (!urlOrId) return false;
  const trimmed = urlOrId.trim();
  if (/^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/i.test(trimmed)) return true;
  if (/^doi:\s*10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/i.test(trimmed)) return true;
  return /(?:doi\.org\/|doi:\s*)10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/i.test(trimmed);
}

export function extractDoi(urlOrId?: string | null): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();
  const match =
    trimmed.match(/^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/i) ||
    trimmed.match(/^doi:\s*(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)$/i) ||
    trimmed.match(/(?:doi\.org\/|doi:\s*)(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)/i);
  return match ? match[1] || match[0] : null;
}

export function detectDocumentType(source: Source | SourceWithContent): DocumentType {
  const modality = (source.modality as string | undefined)?.toLowerCase();
  if (modality === "slides") {
    return "slides";
  }
  if (modality === "ebook") {
    return "epub";
  }
  if (modality === "dataset") {
    return "dataset";
  }
  if (modality === "plaintext") {
    return "plaintext";
  }
  if (modality === "markdown") {
    return "markdown";
  }

  const titleLower = (source.title || "").toLowerCase();
  const extMatch = titleLower.match(/\.([a-z0-9]+)$/);
  const extension = extMatch ? extMatch[1] : "";

  if (modality === "code") {
    if (extension === "ipynb") return "jupyter";
    return "code";
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
  if (ct === "application/x-ipynb+json") {
    return "jupyter";
  }
  if (
    ct === "text/csv" ||
    ct === "text/tab-separated-values" ||
    ct === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    ct === "application/vnd.ms-excel"
  ) {
    return "dataset";
  }

  if (modality === "video") {
    return "video";
  }

  if (source.contentType?.startsWith("video/")) {
    return "video";
  }

  if (modality === "audio") {
    return "audio";
  }

  if (source.contentType?.startsWith("audio/")) {
    return "audio";
  }

  if (modality === "image") {
    return "image";
  }

  if (source.contentType?.startsWith("image/")) {
    return "image";
  }

  if (extension === "pptx") return "slides";
  if (extension === "epub") return "epub";
  if (extension === "tex") return "tex";
  if (extension === "bib") return "bibtex";
  if (JUPYTER_EXTENSIONS.has(extension)) return "jupyter";
  if (TABULAR_EXTENSIONS.has(extension)) return "dataset";

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

  if (ct === "text/markdown" || ct === "text/x-markdown" || MARKDOWN_EXTENSIONS.has(extension)) {
    return "markdown";
  }

  if (ct === "text/plain" || TEXT_EXTENSIONS.has(extension)) {
    return "plaintext";
  }

  if (CODE_EXTENSIONS.has(extension)) {
    return "code";
  }

  if (source.kind === "url") {
    return "article";
  }

  const text = ("rawText" in source ? source.rawText : "") || "";

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
    pyw: "python",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    sql: "sql",
    html: "html",
    css: "css",
    scss: "scss",
    yaml: "yaml",
    yml: "yaml",
    xml: "xml",
    toml: "toml",
    rs: "rust",
    go: "go",
    java: "java",
    cpp: "cpp",
    c: "c",
    h: "c",
    hpp: "cpp",
    cs: "csharp",
    php: "php",
    rb: "ruby",
    swift: "swift",
    kt: "kotlin",
    dockerfile: "dockerfile",
  };
  return map[ext] || ext || "text";
}

export function splitTextIntoChunks(rawText: string): string[] {
  if (!rawText) return [];
  return rawText.split(/\n\n+/).filter((chunk) => chunk.trim().length > 0);
}
