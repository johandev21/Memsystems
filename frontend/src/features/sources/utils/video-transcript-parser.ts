import type { SourceSegmentLocator } from "../types";

export interface ParsedVideoSegment {
  id: string;
  ordinal: number;
  content: string;
  kind?: string;
  speaker?: string;
  startOffsetMs: number;
  endOffsetMs?: number;
  locator?: SourceSegmentLocator;
}

/**
 * Parses timestamp string in MM:SS, M:SS, HH:MM:SS, or H:MM:SS format
 * with optional milliseconds (.mmm or ,mmm) into milliseconds.
 */
export function parseTimestampToMs(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.trim().replace(",", ".");
  const parts = clean.split(":");

  if (parts.length === 3) {
    const hours = parseFloat(parts[0]);
    const minutes = parseFloat(parts[1]);
    const seconds = parseFloat(parts[2]);
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return 0;
    return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
  }

  if (parts.length === 2) {
    const minutes = parseFloat(parts[0]);
    const seconds = parseFloat(parts[1]);
    if (isNaN(minutes) || isNaN(seconds)) return 0;
    return Math.round((minutes * 60 + seconds) * 1000);
  }

  const seconds = parseFloat(clean);
  if (!isNaN(seconds)) {
    return Math.round(seconds * 1000);
  }

  return 0;
}

/** Formats seconds into mm:ss or hh:mm:ss string */
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

/**
 * Matches timestamps at the beginning of a line or after a speaker prefix.
 * Supports:
 * - (00:04), (0:04), (1:23:45), (00:04 - 00:08)
 * - [00:04], [0:04], [1:23:45], [00:04 - 00:08]
 * - 00:04, 0:04, 1:23:45, 00:04 - 00:08, 00:00:04.000 --> 00:00:08.000
 */
const TIMESTAMP_LINE_REGEX =
  /^\s*(?:\[|\()?(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?)(?:\s*(?:-|-->|–)\s*(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?))?(?:\]|\))?[:\s-]*(.*)$/i;

const SPEAKER_THEN_TIMESTAMP_REGEX =
  /^\s*([^:\n[(]+?)\s*[:]\s*(?:\[|\()?(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?)(?:\s*(?:-|-->|–)\s*(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?))?(?:\]|\))?[:\s-]*(.*)$/i;

const SPEAKER_PREFIX_REGEX = /^\s*([^:\n]+?)\s*:\s*(.*)$/i;

/**
 * Checks if raw text contains multiple timestamps indicating it can be split.
 */
export function hasTimestampPatterns(text: string): boolean {
  if (!text) return false;
  const matches = text.match(/(?:\(|\[|\b)(\d{1,2}:\d{2}(?::\d{2})?)(?:\)|\]|\b)/g);
  return (matches?.length ?? 0) >= 2;
}

/**
 * Parse raw text with various timestamp formats into structured video segments.
 */
export function parseRawTextToVideoSegments(
  rawText: string,
  totalDurationSeconds?: number,
): ParsedVideoSegment[] {
  if (!rawText || !rawText.trim()) return [];

  // Remove WebVTT header or numeric cue indexes if present
  const lines = rawText
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => {
      if (!l) return false;
      if (l === "WEBVTT" || l.startsWith("NOTE") || l.startsWith("STYLE")) return false;
      return true;
    });

  const rawSegments: Array<{
    startOffsetMs: number;
    endOffsetMs?: number;
    speaker?: string;
    content: string;
  }> = [];

  let currentOrdinal = 1;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip lone integer cue numbers (SRT format)
    if (/^\d+$/.test(line) && i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      if (TIMESTAMP_LINE_REGEX.test(nextLine) || nextLine.includes("-->")) {
        i++;
        continue;
      }
    }

    // Check Speaker: (00:04) Content
    const speakerTsMatch = line.match(SPEAKER_THEN_TIMESTAMP_REGEX);
    if (speakerTsMatch) {
      const speaker = speakerTsMatch[1].trim();
      const startTime = speakerTsMatch[2];
      const endTime = speakerTsMatch[3];
      const inlineContent = speakerTsMatch[4]?.trim() || "";

      const startOffsetMs = parseTimestampToMs(startTime);
      const endOffsetMs = endTime ? parseTimestampToMs(endTime) : undefined;

      let content = inlineContent;
      // If line only had timestamp and speaker, check next line for speech content
      if (!content && i + 1 < lines.length && !lines[i + 1].match(TIMESTAMP_LINE_REGEX)) {
        i++;
        content = lines[i];
      }

      rawSegments.push({
        startOffsetMs,
        endOffsetMs,
        speaker: speaker || undefined,
        content: content || line,
      });
      i++;
      continue;
    }

    // Check (00:04) Content or [00:04] Content or 00:04 Content
    const tsMatch = line.match(TIMESTAMP_LINE_REGEX);
    if (tsMatch) {
      const startTime = tsMatch[1];
      const endTime = tsMatch[2];
      let remaining = tsMatch[3]?.trim() || "";

      const startOffsetMs = parseTimestampToMs(startTime);
      const endOffsetMs = endTime ? parseTimestampToMs(endTime) : undefined;

      let speaker: string | undefined;
      const speakerMatch = remaining.match(SPEAKER_PREFIX_REGEX);
      if (speakerMatch) {
        speaker = speakerMatch[1].trim();
        remaining = speakerMatch[2]?.trim() || "";
      }

      let content = remaining;
      // Handle multi-line format (YouTube transcript copy: timestamp on line 1, text on line 2)
      if (!content && i + 1 < lines.length && !lines[i + 1].match(TIMESTAMP_LINE_REGEX)) {
        i++;
        content = lines[i];
        const nextSpeakerMatch = content.match(SPEAKER_PREFIX_REGEX);
        if (nextSpeakerMatch) {
          speaker = nextSpeakerMatch[1].trim();
          content = nextSpeakerMatch[2]?.trim() || content;
        }
      }

      rawSegments.push({
        startOffsetMs,
        endOffsetMs,
        speaker: speaker || undefined,
        content: content || line,
      });
      i++;
      continue;
    }

    // Default line without explicit timestamp
    const defaultStartMs = (currentOrdinal - 1) * 10_000;
    rawSegments.push({
      startOffsetMs: defaultStartMs,
      content: line,
    });
    i++;
  }

  // Adjust endOffsetMs for contiguous segments
  const result: ParsedVideoSegment[] = rawSegments.map((seg, idx) => {
    let endOffsetMs = seg.endOffsetMs;
    if (typeof endOffsetMs !== "number" || endOffsetMs <= seg.startOffsetMs) {
      const nextSeg = rawSegments[idx + 1];
      if (nextSeg && nextSeg.startOffsetMs > seg.startOffsetMs) {
        endOffsetMs = nextSeg.startOffsetMs;
      } else if (totalDurationSeconds && totalDurationSeconds * 1000 > seg.startOffsetMs) {
        endOffsetMs = Math.round(totalDurationSeconds * 1000);
      } else {
        endOffsetMs = seg.startOffsetMs + 5000;
      }
    }

    return {
      id: `raw-seg-${idx + 1}`,
      ordinal: idx + 1,
      content: seg.content,
      kind: "transcript",
      speaker: seg.speaker,
      startOffsetMs: seg.startOffsetMs,
      endOffsetMs,
      locator: {
        startOffsetMs: seg.startOffsetMs,
        endOffsetMs,
        speaker: seg.speaker,
      },
    };
  });

  return result;
}
