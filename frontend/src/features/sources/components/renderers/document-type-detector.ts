import type { SourceWithContent } from "@/shared/api";

export type DocumentType = "markdown" | "code" | "article" | "plaintext";

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

export function detectDocumentType(source: SourceWithContent): DocumentType {
  const titleLower = (source.title || "").toLowerCase();
  const extMatch = titleLower.match(/\.([a-z0-9]+)$/);
  const extension = extMatch ? extMatch[1] : "";

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
