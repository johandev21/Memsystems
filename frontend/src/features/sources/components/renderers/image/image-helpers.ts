import type { ImageRegion } from "../../../types";
import type { ParsedImageSection } from "./image-types";

export function normalizeSegmentKind(
  kind: string | undefined,
  content: string,
): ParsedImageSection["kind"] {
  if (kind === "visual_description") return "visual_description";
  if (kind === "formula" || /\$\$[\s\S]+?\$\$|\$.+?\$/.test(content)) return "formula";
  if (kind === "heading" || /^#{1,6}\s+/.test(content)) return "heading";
  if (kind === "warning") return "warning";
  return "text";
}

export function parseRawTextToSections(rawText: string): ParsedImageSection[] {
  if (!rawText || !rawText.trim()) return [];

  const chunks = rawText.split(/\n\n+/).filter((c) => c.trim().length > 0);
  return chunks.map((chunk, index) => {
    let trimmed = chunk.trim();
    const isHeading = /^#{1,6}\s+/.test(trimmed);
    const isVisualDesc =
      trimmed.toLowerCase().startsWith("### visual") ||
      trimmed.toLowerCase().startsWith("**visual description") ||
      trimmed.toLowerCase().includes("diagram:");
    const isFormula = /\$\$[\s\S]+?\$\$|\$.+?\$/.test(trimmed);

    let kind: ParsedImageSection["kind"] = "text";
    if (isVisualDesc) kind = "visual_description";
    else if (isFormula) kind = "formula";
    else if (isHeading) {
      kind = "heading";
      trimmed = trimmed.replace(/^#{1,6}\s+/, "");
    }

    return {
      id: `raw-chunk-${index}`,
      ordinal: index + 1,
      kind,
      content: trimmed,
    };
  });
}

export function isMatchingRegion(
  regionA?: ImageRegion | null,
  regionB?: ImageRegion | null,
): boolean {
  if (!regionA || !regionB) return false;
  const tolerance = 0.02;
  return (
    Math.abs(regionA.x - regionB.x) <= tolerance &&
    Math.abs(regionA.y - regionB.y) <= tolerance &&
    Math.abs(regionA.width - regionB.width) <= tolerance &&
    Math.abs(regionA.height - regionB.height) <= tolerance
  );
}
