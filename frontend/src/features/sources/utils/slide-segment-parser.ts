import type { SourceSegmentLocator } from "../types";

export interface ParsedSlideSegment {
  id: string;
  ordinal: number;
  slideNumber: number;
  content: string;
  kind?: string;
  locator?: SourceSegmentLocator;
}

export function parseRawTextToSlideSegments(rawText: string): ParsedSlideSegment[] {
  if (!rawText || !rawText.trim()) return [];
  const chunks = rawText.split(/\n\n+/).filter(Boolean);
  return chunks.map((chunk, idx) => ({
    id: `raw-slide-${idx}`,
    ordinal: idx + 1,
    slideNumber: idx + 1,
    content: chunk.trim(),
    locator: { slideNumber: idx + 1 },
  }));
}
