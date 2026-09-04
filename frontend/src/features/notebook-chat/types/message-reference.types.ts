import type { CitedSourceDTO } from "../api/chat";

const REFERENCE_HREF_PREFIX = "#reference-";
const REF_MARKER_PATTERN = /`?\[ref:([a-zA-Z0-9_-]+)\]`?/gi;
const LINK_SHAPE_PATTERN = /`?\[(\d+)\]\(#reference-([a-zA-Z0-9_-]+)\)`?/gi;
const TRAILING_REFERENCE_PATTERN = /\s*\[ref:[^\]\n]*$/i;
const TRAILING_LINK_SHAPE_PATTERN = /\s*`?\[\d+\]\(#reference-[^\s)\n]*$/i;
const STREAMING_REF_PATTERN = /\s*`?\[ref:[a-zA-Z0-9_-]+\]`?/gi;
const STREAMING_LINK_PATTERN = /\s*`?\[\d+\]\(#reference-[a-zA-Z0-9_-]+\)`?/gi;
// Separates adjacent citation links so markdown always parses them as
// distinct links and the pills render with a gap.
const ADJACENT_CITATION_LINKS_PATTERN = /(\]\(#reference-[^)\s]+\))(?=\[)/gi;
const FENCED_BLOCK_SPLIT = /(```[\s\S]*?(?:```|$))/g;
const INLINE_CODE_SPLIT = /(`+[^`\n]*`+)/g;

export interface PreparedReferenceMessage {
  markdown: string;
  inlineCitationKeys: Set<string>;
}

export function prepareReferenceMessage(
  text: string,
  references: CitedSourceDTO[],
  isStreaming: boolean,
): PreparedReferenceMessage {
  if (isStreaming) {
    return {
      markdown: text
        .replace(STREAMING_REF_PATTERN, "")
        .replace(STREAMING_LINK_PATTERN, "")
        .replace(TRAILING_REFERENCE_PATTERN, "")
        .replace(TRAILING_LINK_SHAPE_PATTERN, ""),
      inlineCitationKeys: new Set(),
    };
  }

  const referencesByKey = new Map(
    references.map((reference) => [reference.citationKey.toUpperCase(), reference]),
  );
  const inlineCitationKeys = new Set<string>();

  const resolveRefMarker = (_marker: string, rawKey: string): string => {
    const reference = referencesByKey.get(rawKey.toUpperCase());
    if (!reference) return "";

    inlineCitationKeys.add(reference.citationKey);
    return createReferenceMarkdownLink(reference);
  };

  const resolveLinkShape = (_marker: string, displayNumber: string, rawKey: string): string => {
    const reference = referencesByKey.get(rawKey.toUpperCase());
    // Model sometimes invents display numbers — always renormalize to the
    // backend-assigned number. Unknown keys degrade to plain number text so
    // no raw markdown leaks.
    if (!reference) return displayNumber;

    inlineCitationKeys.add(reference.citationKey);
    return createReferenceMarkdownLink(reference);
  };

  const normalizeProse = (prose: string): string =>
    prose
      .replace(REF_MARKER_PATTERN, resolveRefMarker)
      .replace(LINK_SHAPE_PATTERN, resolveLinkShape);

  const containsKnownCitation = (value: string): boolean => {
    REF_MARKER_PATTERN.lastIndex = 0;
    LINK_SHAPE_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    REF_MARKER_PATTERN.lastIndex = 0;
    while ((match = REF_MARKER_PATTERN.exec(value)) !== null) {
      if (referencesByKey.has(match[1].toUpperCase())) return true;
    }
    LINK_SHAPE_PATTERN.lastIndex = 0;
    while ((match = LINK_SHAPE_PATTERN.exec(value)) !== null) {
      if (referencesByKey.has(match[2].toUpperCase())) return true;
    }
    return false;
  };

  const normalizeInlineChunk = (chunk: string): string => {
    if (!INLINE_CODE_SPLIT.source) return normalizeProse(chunk);
    const parts = chunk.split(INLINE_CODE_SPLIT);
    return parts
      .map((part) => {
        if (!part) return part;
        if (part.startsWith("`")) {
          // The model often wraps a whole cluster in one code span, e.g.
          // `[ref:R2][ref:R7]`. Unwrap and convert when it holds at least
          // one known citation; otherwise leave genuine code alone.
          const inner = part.replace(/^`+|`+$/g, "");
          if (containsKnownCitation(inner)) return normalizeProse(inner);
          return part;
        }
        return normalizeProse(part);
      })
      .join("");
  };

  let markdown = text
    .split(FENCED_BLOCK_SPLIT)
    .map((chunk) => {
      // Leave fenced code blocks untouched so real code samples never turn
      // into citation popovers.
      if (chunk.startsWith("```")) return chunk;
      return normalizeInlineChunk(chunk);
    })
    .join("")
    .replace(ADJACENT_CITATION_LINKS_PATTERN, "$1 ");

  for (const reference of references) {
    if (reference.schemaVersion !== 0) continue;

    const legacyLabel = `(${reference.title})`;
    if (!markdown.includes(legacyLabel)) continue;

    inlineCitationKeys.add(reference.citationKey);
    markdown = markdown.replaceAll(legacyLabel, createReferenceMarkdownLink(reference));
  }

  return { markdown, inlineCitationKeys };
}

export function createReferenceHref(citationKey: string): string {
  return `${REFERENCE_HREF_PREFIX}${encodeURIComponent(citationKey)}`;
}

export function getReferenceKeyFromHref(href?: string): string | null {
  if (!href || !href.toLowerCase().startsWith(REFERENCE_HREF_PREFIX)) return null;

  try {
    return decodeURIComponent(href.slice(REFERENCE_HREF_PREFIX.length));
  } catch {
    return null;
  }
}

export function getReferenceExcerpt(reference: CitedSourceDTO): string {
  return (
    reference.quote?.trim() ||
    reference.description?.trim() ||
    "No excerpt is available for this reference."
  );
}

/** Returns a human-readable location without changing the source URL action. */
export function getReferenceLocatorLabel(reference: CitedSourceDTO): string | null {
  const locator = reference.locator;
  if (!locator) return null;

  const labels: string[] = [];
  if (isPositiveNumber(locator.pageNumber)) labels.push(`Page ${locator.pageNumber}`);
  if (isPositiveNumber(locator.slideNumber)) labels.push(`Slide ${locator.slideNumber}`);

  if (isNonNegativeNumber(locator.startOffsetMs) || isNonNegativeNumber(locator.endOffsetMs)) {
    const start = isNonNegativeNumber(locator.startOffsetMs)
      ? formatTimestamp(locator.startOffsetMs)
      : null;
    const end = isNonNegativeNumber(locator.endOffsetMs)
      ? formatTimestamp(locator.endOffsetMs)
      : null;
    labels.push(start && end ? `${start}–${end}` : (start ?? end ?? "Timestamp"));
  }

  if (locator.sheetName || locator.cellRange) {
    labels.push(
      [locator.sheetName ? `Sheet "${locator.sheetName}"` : null, locator.cellRange]
        .filter(Boolean)
        .join(" · "),
    );
  }

  if (locator.symbol || isPositiveNumber(locator.lineStart) || isPositiveNumber(locator.lineEnd)) {
    const lines =
      isPositiveNumber(locator.lineStart) || isPositiveNumber(locator.lineEnd)
        ? `Lines ${locator.lineStart ?? locator.lineEnd}${locator.lineStart != null && locator.lineEnd != null ? `–${locator.lineEnd}` : ""}`
        : null;
    labels.push([locator.symbol, lines].filter(Boolean).join(" · "));
  }

  if (locator.imageRegion) {
    labels.push("Visual region");
  }

  return labels.length > 0 ? labels.join(" · ") : null;
}

export function getSafeReferenceUrl(url: string | null): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function createReferenceMarkdownLink(reference: CitedSourceDTO): string {
  return `[${reference.number}](${createReferenceHref(reference.citationKey)})`;
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
