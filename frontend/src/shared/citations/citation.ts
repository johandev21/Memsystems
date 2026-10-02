import {
  BookOpen,
  File,
  FileText,
  Globe,
  Headphones,
  ImageIcon,
  Presentation,
  Video,
  type LucideIcon,
} from "lucide-react";
import i18n from "@/shared/i18n";

export function getCitationKindIcon(kind?: string | null, url?: string | null): LucideIcon {
  const normalized = (kind ?? "").toLowerCase();
  if (normalized === "video" || (url && /youtube\.com|youtu\.be/i.test(url))) return Video;
  if (normalized === "audio") return Headphones;
  if (normalized === "image") return ImageIcon;
  if (normalized === "slides" || normalized === "presentation") return Presentation;
  if (normalized === "ebook" || normalized === "epub") return BookOpen;
  if (normalized === "url" || normalized === "web") return Globe;
  if (normalized === "pdf" || normalized === "file" || normalized === "document") return FileText;
  return File;
}

/**
 * Shared citation vocabulary for the surfaces that show source evidence:
 * Chat replies and generated Study Materials. Both store the same citation
 * contract, so the popover and its locator labels live once, here.
 */

export interface CitationLocator {
  pageNumber?: number;
  slideNumber?: number;
  startOffsetMs?: number;
  endOffsetMs?: number;
  speaker?: string;
  sheetName?: string;
  cellRange?: string;
  symbol?: string;
  lineStart?: number;
  lineEnd?: number;
  imageRegion?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/** The fields a citation popover needs, whatever surface produced it. */
export interface CitationReference {
  id: string;
  citationKey: string;
  number: number;
  title: string;
  kind: string;
  url: string | null;
  quote: string | null;
  description: string | null;
  locator?: CitationLocator | null;
  isAvailable: boolean;
  sectionPath?: string[] | null;
  context?: string | null;
}

export function getCitationExcerpt(reference: CitationReference): string {
  return (
    reference.quote?.trim() ||
    reference.description?.trim() ||
    i18n.t("referencePopover.noExcerpt", { ns: "chat" })
  );
}

/** Returns a human-readable location without changing the source URL action. */
export function getCitationLocatorLabel(reference: CitationReference): string | null {
  const locator = reference.locator;
  if (!locator) return null;

  const labels: string[] = [];
  if (isPositiveNumber(locator.pageNumber)) {
    labels.push(i18n.t("locator.page", { ns: "chat", number: locator.pageNumber }));
  }
  if (isPositiveNumber(locator.slideNumber)) {
    labels.push(i18n.t("locator.slide", { ns: "chat", number: locator.slideNumber }));
  }

  if (isNonNegativeNumber(locator.startOffsetMs) || isNonNegativeNumber(locator.endOffsetMs)) {
    const start = isNonNegativeNumber(locator.startOffsetMs)
      ? formatTimestamp(locator.startOffsetMs)
      : null;
    const end = isNonNegativeNumber(locator.endOffsetMs)
      ? formatTimestamp(locator.endOffsetMs)
      : null;
    labels.push(
      start && end
        ? `${start}–${end}`
        : (start ?? end ?? i18n.t("locator.timestamp", { ns: "chat" })),
    );
  }

  if (locator.sheetName || locator.cellRange) {
    labels.push(
      [
        locator.sheetName ? i18n.t("locator.sheet", { ns: "chat", name: locator.sheetName }) : null,
        locator.cellRange,
      ]
        .filter(Boolean)
        .join(" · "),
    );
  }

  if (locator.symbol || isPositiveNumber(locator.lineStart) || isPositiveNumber(locator.lineEnd)) {
    const lines =
      isPositiveNumber(locator.lineStart) || isPositiveNumber(locator.lineEnd)
        ? locator.lineStart != null && locator.lineEnd != null
          ? i18n.t("locator.linesRange", {
              ns: "chat",
              start: locator.lineStart,
              end: locator.lineEnd,
            })
          : i18n.t("locator.lines", {
              ns: "chat",
              value: locator.lineStart ?? locator.lineEnd ?? 0,
            })
        : null;
    labels.push([locator.symbol, lines].filter(Boolean).join(" · "));
  }

  if (locator.imageRegion) {
    labels.push(i18n.t("locator.visualRegion", { ns: "chat" }));
  }

  return labels.length > 0 ? labels.join(" · ") : null;
}

export function getSafeCitationUrl(url: string | null): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

/**
 * Reads the citations a generated Study Material stored. The server attaches
 * them after generation; a material from before citations existed simply has
 * none. Unknown or malformed entries are skipped rather than crashing the
 * viewer.
 */
export function readMaterialCitations(content: unknown): CitationReference[] {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return [];
  }
  const raw = (content as { citations?: unknown }).citations;
  if (!Array.isArray(raw)) return [];

  const citations: CitationReference[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const sourceId = typeof record.sourceId === "string" ? record.sourceId : null;
    if (!sourceId) continue;
    citations.push({
      id: sourceId,
      citationKey:
        typeof record.citationKey === "string" ? record.citationKey : `R${citations.length + 1}`,
      number:
        typeof record.number === "number" && Number.isFinite(record.number)
          ? record.number
          : citations.length + 1,
      title: typeof record.title === "string" ? record.title : sourceId,
      kind: typeof record.kind === "string" ? record.kind : "unknown",
      url: typeof record.url === "string" ? record.url : null,
      quote: typeof record.quote === "string" ? record.quote : null,
      description: typeof record.description === "string" ? record.description : null,
      locator:
        record.locator && typeof record.locator === "object"
          ? (record.locator as CitationLocator)
          : null,
      // Stored citations keep working even when the source row is gone; the
      // viewer upgrades this to false when the notebook's source list loads.
      isAvailable: true,
      sectionPath: Array.isArray(record.sectionPath)
        ? record.sectionPath.filter((p): p is string => typeof p === "string")
        : null,
      context: typeof record.context === "string" ? record.context : null,
    });
  }
  return citations;
}

const CITATION_MARKER_PATTERN =
  /`?\[ref:[a-zA-Z0-9_-]+\]`?|`?\[\d+\]\(#reference-[a-zA-Z0-9_-]+\)`?/gi;

/** Removes the model's raw citation markers from text shown to the user. */
export function stripCitationMarkers(text: string): string {
  return text
    .replace(CITATION_MARKER_PATTERN, "")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/ {2,}/g, " ");
}

/**
 * Removes the raw citation markers from every string in generated content, so
 * the viewer shows prose and a citation surface instead of `[ref:Rn]`.
 */
export function stripCitationMarkersFromContent(content: unknown): unknown {
  if (typeof content === "string") return stripCitationMarkers(content);
  if (Array.isArray(content)) {
    return content.map(stripCitationMarkersFromContent);
  }
  if (content && typeof content === "object") {
    return Object.fromEntries(
      Object.entries(content).map(([key, value]) => [key, stripCitationMarkersFromContent(value)]),
    );
  }
  return content;
}

function isPositiveNumber(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isNonNegativeNumber(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function formatTimestamp(offsetMs: number): string {
  const totalSeconds = Math.floor(offsetMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Normalizes prose text for citation card preview:
 * - Unescapes markdown escape sequences (e.g. "5\." -> "5.", "\*" -> "*")
 * - Cleans stray backslashes and extra whitespace
 * - Collapses hard line breaks into continuous, natural flowing prose
 */
export function cleanProseText(text?: string | null): string {
  if (!text) return "";
  return text
    .replace(/\\([!#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, "$1")
    .replace(/(^|\n)\\\s*/g, "$1")
    .replace(/\\\s+/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Cleans individual breadcrumb heading segments from markdown escape artifacts.
 */
export function cleanBreadcrumbSegment(segment: string): string {
  return segment
    .replace(/\\([!#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, "$1")
    .replace(/(^|\n)\\\s*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detects whether a citation reference is authored in markdown or contains markdown syntax.
 */
export function isMarkdownCitation(reference: CitationReference, text?: string): boolean {
  const kind = (reference.kind ?? "").toLowerCase();
  if (kind === "video" || kind === "audio" || kind === "transcript" || kind === "plaintext") {
    return false;
  }
  if (kind === "markdown" || kind === "md" || kind === "url" || kind === "web" || kind === "article") {
    return true;
  }
  if (/\.(md|markdown|mdx)$/i.test(reference.title || reference.url || "")) {
    return true;
  }
  if (/\.txt$/i.test(reference.title || reference.url || "")) {
    return false;
  }
  if (!text) return false;
  return /(_[^\s_].*?_|[*][^\s*].*?[*]|`[^`]+`|\[[^\]]+\]\([^)]+\))/s.test(text);
}

/**
 * Prepares raw citation text for preview:
 * - Collapses single newlines within paragraphs into single spaces so prose flows naturally
 * - Preserves double newlines (\n\n) as paragraph breaks
 * - Strips stray leading backslashes (e.g. "\ In all")
 */
export function prepareCitationText(text?: string | null): string {
  if (!text) return "";
  return text
    .replace(/(^|\n)\\\s*/g, "$1")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .replace(/\n+/g, " ")
        .replace(/[ \t]+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .join("\n\n");
}


