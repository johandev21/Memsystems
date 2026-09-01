import type { CitedSourceDTO } from "../api/chat";

const REFERENCE_HREF_PREFIX = "#reference-";
const COMPLETE_REFERENCE_PATTERN = /\[ref:([a-zA-Z0-9_-]+)\]/g;
const TRAILING_REFERENCE_PATTERN = /\s*\[ref:[^\]\n]*$/;

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
        .replace(/\s*\[ref:[a-zA-Z0-9_-]+\]/g, "")
        .replace(TRAILING_REFERENCE_PATTERN, ""),
      inlineCitationKeys: new Set(),
    };
  }

  const referencesByKey = new Map(
    references.map((reference) => [reference.citationKey.toUpperCase(), reference]),
  );
  const inlineCitationKeys = new Set<string>();

  let markdown = text.replace(COMPLETE_REFERENCE_PATTERN, (_marker, rawKey: string) => {
    const reference = referencesByKey.get(rawKey.toUpperCase());
    if (!reference) return "";

    inlineCitationKeys.add(reference.citationKey);
    const label = escapeMarkdownLabel(reference.title);
    return `[(${label})](${createReferenceHref(reference.citationKey)})`;
  });

  for (const reference of references) {
    if (reference.schemaVersion !== 0) continue;

    const legacyLabel = `(${reference.title})`;
    if (!markdown.includes(legacyLabel)) continue;

    inlineCitationKeys.add(reference.citationKey);
    markdown = markdown.replaceAll(
      legacyLabel,
      `[(${escapeMarkdownLabel(reference.title)})](${createReferenceHref(reference.citationKey)})`,
    );
  }

  return { markdown, inlineCitationKeys };
}

export function createReferenceHref(citationKey: string): string {
  return `${REFERENCE_HREF_PREFIX}${encodeURIComponent(citationKey)}`;
}

export function getReferenceKeyFromHref(href?: string): string | null {
  if (!href?.startsWith(REFERENCE_HREF_PREFIX)) return null;

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

function escapeMarkdownLabel(label: string): string {
  return label.replace(/([\\[\]])/g, "\\$1");
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
