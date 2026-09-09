import type { SourceSegmentLocator } from "../../types";

export interface ParsedAudioSegment {
  id: string;
  ordinal: number;
  content: string;
  speaker?: string;
  startOffsetMs: number;
  endOffsetMs?: number;
  locator?: SourceSegmentLocator;
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return "00:00";
  const totalSec = Math.floor(seconds);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function parseRawTextToAudioSegments(rawText: string): ParsedAudioSegment[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const segments: ParsedAudioSegment[] = [];

  // Regex patterns:
  // [00:15] Speaker 1: text
  // [01:23 - 01:45] Speaker A: text
  // Speaker 1 (00:15): text
  const timestampPrefixRegex =
    /^\[(\d{1,2}:\d{2}(?::\d{2})?)(?:\s*-\s*(\d{1,2}:\d{2}(?::\d{2})?))?\]\s*(?:([^:]+):\s*)?(.*)$/i;
  const speakerPrefixRegex = /^([^:\n(]+)(?:\s*\((?:(\d{1,2}:\d{2}(?::\d{2})?))\))?:\s*(.*)$/i;

  let currentOrdinal = 1;

  for (const line of lines) {
    const tsMatch = line.match(timestampPrefixRegex);
    if (tsMatch) {
      const startTime = tsMatch[1];
      const endTime = tsMatch[2];
      const speaker = tsMatch[3]?.trim();
      const content = tsMatch[4]?.trim() || line;

      const startOffsetMs = parseTimestampToMs(startTime);
      const endOffsetMs = endTime ? parseTimestampToMs(endTime) : undefined;

      segments.push({
        id: `raw-seg-${currentOrdinal}`,
        ordinal: currentOrdinal++,
        content,
        speaker: speaker || undefined,
        startOffsetMs,
        endOffsetMs,
        locator: {
          startOffsetMs,
          endOffsetMs,
          speaker: speaker || undefined,
        },
      });
      continue;
    }

    const spMatch = line.match(speakerPrefixRegex);
    if (spMatch && spMatch[3]) {
      const speaker = spMatch[1]?.trim();
      const timeStr = spMatch[2];
      const content = spMatch[3]?.trim();
      const startOffsetMs = timeStr ? parseTimestampToMs(timeStr) : (currentOrdinal - 1) * 10_000;

      segments.push({
        id: `raw-seg-${currentOrdinal}`,
        ordinal: currentOrdinal++,
        content,
        speaker: speaker || undefined,
        startOffsetMs,
        locator: {
          startOffsetMs,
          speaker: speaker || undefined,
        },
      });
      continue;
    }

    // Default paragraph
    const startOffsetMs = (currentOrdinal - 1) * 10_000;
    segments.push({
      id: `raw-seg-${currentOrdinal}`,
      ordinal: currentOrdinal++,
      content: line,
      startOffsetMs,
      locator: {
        startOffsetMs,
      },
    });
  }

  return segments;
}

export function parseTimestampToMs(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(":").map(Number);
  if (parts.length === 3) {
    return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  }
  if (parts.length === 2) {
    return (parts[0] * 60 + parts[1]) * 1000;
  }
  return 0;
}
