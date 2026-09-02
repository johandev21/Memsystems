/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { Injectable } from '@nestjs/common';
import type { YouTubeSegment } from './youtube-acquisition.service';

export type CaptionFormat = 'vtt' | 'srt' | 'json3' | 'xml' | 'plain' | 'auto';

function decodeXmlEntities(str: string): string {
  let decoded = str;
  for (let pass = 0; pass < 2; pass++) {
    decoded = decoded
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, code) =>
        String.fromCharCode(parseInt(code, 16)),
      )
      .replace(/&amp;/g, '&');
  }
  return decoded;
}

function cleanCaptionText(raw: string): { text: string; speaker?: string } {
  let text = decodeXmlEntities(raw);

  let speaker: string | undefined;

  // WebVTT voice tag <v Speaker Name>Text</v> or <v.speaker-class Speaker Name>
  const vttVoiceMatch = text.match(
    /<v(?:\.[^>]+)?\s+([^>]+)>([\s\S]*?)(?:<\/v>|$)/i,
  );
  if (vttVoiceMatch) {
    speaker = vttVoiceMatch[1].trim();
    text = vttVoiceMatch[2];
  }

  // Strip remaining HTML / VTT tags like <b>, </i>, <u>, <c>, <00:01:23.456>
  text = text.replace(/<[^>]+>/g, '');

  // Look for "[Speaker Name]: Text", "(Speaker Name) Text", or "Speaker Name: Text" at start
  const speakerPrefixMatch =
    text.match(/^\[([^\]]+)\]:\s*([\s\S]+)$/) ||
    text.match(/^\(([^)]+)\):\s*([\s\S]+)$/) ||
    text.match(/^([A-Za-z0-9 ._-]{2,30}):\s+([\s\S]+)$/);

  if (speakerPrefixMatch && !speaker) {
    const candidate = speakerPrefixMatch[1].trim();
    if (!/^\d{1,2}:\d{2}/.test(candidate)) {
      speaker = candidate;
      text = speakerPrefixMatch[2];
    }
  }

  // Clean whitespace & fix any space before punctuation
  text = text
    .replace(/\r\n/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.:;!?])/g, '$1')
    .trim();

  return { text, speaker };
}

/** Parses timestamp strings in formats "HH:MM:SS.mmm", "MM:SS.mmm", "HH:MM:SS,mmm", or "MM:SS,mmm" into milliseconds. */
export function parseTimestampMs(timeStr: string): number | null {
  if (!timeStr) return null;
  const normalized = timeStr.trim().replace(',', '.');
  const parts = normalized.split(':');

  if (parts.length === 3) {
    const hours = parseFloat(parts[0]);
    const minutes = parseFloat(parts[1]);
    const seconds = parseFloat(parts[2]);
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return null;
    return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
  }

  if (parts.length === 2) {
    const minutes = parseFloat(parts[0]);
    const seconds = parseFloat(parts[1]);
    if (isNaN(minutes) || isNaN(seconds)) return null;
    return Math.round((minutes * 60 + seconds) * 1000);
  }

  const seconds = parseFloat(normalized);
  if (!isNaN(seconds)) {
    return Math.round(seconds * 1000);
  }

  return null;
}

@Injectable()
export class CaptionParserService {
  /** Detects format based on content cues. */
  detectFormat(raw: string): CaptionFormat {
    const trimmed = raw.trim();
    if (
      trimmed.startsWith('WEBVTT') ||
      (trimmed.includes('-->') && trimmed.includes('.'))
    ) {
      return 'vtt';
    }
    if (
      trimmed.startsWith('{') ||
      (trimmed.startsWith('[') && trimmed.includes('"events"'))
    ) {
      return 'json3';
    }
    if (
      trimmed.startsWith('<') &&
      (trimmed.includes('<transcript') ||
        trimmed.includes('<text ') ||
        trimmed.includes('<timedtext'))
    ) {
      return 'xml';
    }
    if (
      /^\d+\s*\r?\n\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->/m.test(trimmed) ||
      /-->/m.test(trimmed)
    ) {
      return 'srt';
    }
    return 'plain';
  }

  /** Parses caption/subtitle data from any supported format. */
  parse(data: string, format: CaptionFormat = 'auto'): YouTubeSegment[] {
    if (!data || typeof data !== 'string') return [];
    const trimmed = data.trim();
    if (trimmed.length === 0) return [];

    const effectiveFormat =
      format === 'auto' ? this.detectFormat(trimmed) : format;

    switch (effectiveFormat) {
      case 'vtt':
        return this.parseVtt(trimmed);
      case 'srt':
        return this.parseSrt(trimmed);
      case 'json3':
        return this.parseJson3(trimmed);
      case 'xml':
        return this.parseXml(trimmed);
      case 'plain':
      default:
        return this.parsePlain(trimmed);
    }
  }

  /** Parses WebVTT (.vtt) format. */
  parseVtt(vttContent: string): YouTubeSegment[] {
    const segments: YouTubeSegment[] = [];
    const lines = vttContent.replace(/\r\n/g, '\n').split('\n');

    let i = 0;
    // Skip WEBVTT header and metadata
    while (i < lines.length && !lines[i].includes('-->')) {
      i++;
    }

    while (i < lines.length) {
      const line = lines[i].trim();

      // Look for timestamp line e.g. "00:00:01.000 --> 00:00:04.000" or with cue settings
      const arrowIndex = line.indexOf('-->');
      if (arrowIndex !== -1) {
        const startStr = line.slice(0, arrowIndex).trim();
        const endPart = line.slice(arrowIndex + 3).trim();
        const endStr = endPart.split(/\s+/)[0]; // strip alignment/position settings

        const startOffsetMs = parseTimestampMs(startStr);
        const endOffsetMs = parseTimestampMs(endStr);

        i++;
        const textLines: string[] = [];
        while (
          i < lines.length &&
          lines[i].trim() !== '' &&
          !lines[i].includes('-->')
        ) {
          // If line is a numeric identifier for the next cue, check ahead
          if (
            /^\d+$/.test(lines[i].trim()) &&
            i + 1 < lines.length &&
            lines[i + 1].includes('-->')
          ) {
            break;
          }
          textLines.push(lines[i]);
          i++;
        }

        const rawBlock = textLines.join(' ').trim();
        if (rawBlock && startOffsetMs !== null && endOffsetMs !== null) {
          const { text, speaker } = cleanCaptionText(rawBlock);
          if (text) {
            segments.push({
              content: text,
              startOffsetMs,
              endOffsetMs: Math.max(endOffsetMs, startOffsetMs + 500),
              ...(speaker ? { speaker } : {}),
            });
          }
        }
      } else {
        i++;
      }
    }

    return segments;
  }

  /** Parses SubRip (.srt) format. */
  parseSrt(srtContent: string): YouTubeSegment[] {
    const segments: YouTubeSegment[] = [];
    const normalized = srtContent.replace(/\r\n/g, '\n');
    // Split on double newlines
    const blocks = normalized.split(/\n\s*\n/);

    for (const block of blocks) {
      const lines = block
        .trim()
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length === 0) continue;

      let timeLineIdx = -1;
      for (let j = 0; j < lines.length; j++) {
        if (lines[j].includes('-->')) {
          timeLineIdx = j;
          break;
        }
      }

      if (timeLineIdx === -1) continue;

      const timeLine = lines[timeLineIdx];
      const arrowIndex = timeLine.indexOf('-->');
      const startStr = timeLine.slice(0, arrowIndex).trim();
      const endStr = timeLine
        .slice(arrowIndex + 3)
        .trim()
        .split(/\s+/)[0];

      const startOffsetMs = parseTimestampMs(startStr);
      const endOffsetMs = parseTimestampMs(endStr);

      const textLines = lines.slice(timeLineIdx + 1);
      const rawBlock = textLines.join(' ').trim();

      if (rawBlock && startOffsetMs !== null && endOffsetMs !== null) {
        const { text, speaker } = cleanCaptionText(rawBlock);
        if (text) {
          segments.push({
            content: text,
            startOffsetMs,
            endOffsetMs: Math.max(endOffsetMs, startOffsetMs + 500),
            ...(speaker ? { speaker } : {}),
          });
        }
      }
    }

    return segments;
  }

  /** Parses YouTube JSON3 format. */
  parseJson3(jsonStr: string): YouTubeSegment[] {
    try {
      const parsed = JSON.parse(jsonStr);
      const events = Array.isArray(parsed.events)
        ? parsed.events
        : Array.isArray(parsed)
          ? parsed
          : [];
      if (events.length === 0) return [];

      const segments: YouTubeSegment[] = [];
      for (const event of events) {
        if (!event.segs || !Array.isArray(event.segs)) {
          if (typeof event.text === 'string' && event.text.trim()) {
            const startOffsetMs = Math.round(
              Number(event.start ?? event.tStartMs) || 0,
            );
            const durationMs = Math.round(
              Number(event.dur ?? event.dDurationMs) || 1000,
            );
            const { text, speaker } = cleanCaptionText(event.text);
            if (text) {
              segments.push({
                content: text,
                startOffsetMs,
                endOffsetMs: startOffsetMs + Math.max(durationMs, 500),
                ...(speaker ? { speaker } : {}),
              });
            }
          }
          continue;
        }

        const rawBlock = event.segs
          .map((s: any) => s.utf8 || '')
          .join('')
          .replace(/\n/g, ' ')
          .trim();

        if (!rawBlock) continue;

        const startOffsetMs = Math.round(Number(event.tStartMs) || 0);
        const durationMs = Math.round(Number(event.dDurationMs) || 1000);
        const endOffsetMs = startOffsetMs + Math.max(durationMs, 500);

        const { text, speaker } = cleanCaptionText(rawBlock);
        if (text) {
          segments.push({
            content: text,
            startOffsetMs,
            endOffsetMs,
            ...(speaker ? { speaker } : {}),
          });
        }
      }

      return segments;
    } catch {
      return [];
    }
  }

  /** Parses XML TimedText format (<text start="1.5" dur="3.0">...</text>). */
  parseXml(xmlStr: string): YouTubeSegment[] {
    const segments: YouTubeSegment[] = [];
    const textTagRe = /<text\s+([^>]+)>([\s\S]*?)<\/text>/gi;
    let match: RegExpExecArray | null;

    while ((match = textTagRe.exec(xmlStr)) !== null) {
      const attrs = match[1];
      const rawText = match[2];

      const startMatch = attrs.match(/start="([\d.]+)"/);
      const durMatch = attrs.match(/dur="([\d.]+)"/);

      const startSec = startMatch ? parseFloat(startMatch[1]) : 0;
      const durSec = durMatch ? parseFloat(durMatch[1]) : 1.0;

      const startOffsetMs = Math.round(startSec * 1000);
      const endOffsetMs = Math.round((startSec + Math.max(durSec, 0.5)) * 1000);

      const { text, speaker } = cleanCaptionText(rawText);
      if (text) {
        segments.push({
          content: text,
          startOffsetMs,
          endOffsetMs,
          ...(speaker ? { speaker } : {}),
        });
      }
    }

    return segments;
  }

  /** Parses plain text into structured timed segments with multi-pattern timestamp support. */
  parsePlain(rawText: string): YouTubeSegment[] {
    const trimmed = rawText.trim();
    if (!trimmed) return [];

    const lines = trimmed
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const timestampRegex =
      /^\s*(?:\[|\()?(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?)(?:\s*(?:-|-->|–)\s*(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?))?(?:\]|\))?[:\s-]*(.*)$/i;
    const speakerThenTimestampRegex =
      /^\s*([^:\n[(]+?)\s*[:]\s*(?:\[|\()?(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?)(?:\s*(?:-|-->|–)\s*(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?))?(?:\]|\))?[:\s-]*(.*)$/i;

    const segments: YouTubeSegment[] = [];
    let i = 0;
    let hasExplicitTimestamps = false;

    while (i < lines.length) {
      const line = lines[i];

      // Check Speaker: (00:04) Content
      const spTsMatch = line.match(speakerThenTimestampRegex);
      if (spTsMatch) {
        hasExplicitTimestamps = true;
        const speaker = spTsMatch[1].trim();
        const startMs = parseTimestampMs(spTsMatch[2]) ?? 0;
        const endMs = spTsMatch[3] ? parseTimestampMs(spTsMatch[3]) : null;
        let content = spTsMatch[4]?.trim() || '';

        if (
          !content &&
          i + 1 < lines.length &&
          !lines[i + 1].match(timestampRegex)
        ) {
          i++;
          content = lines[i];
        }

        segments.push({
          content: cleanCaptionText(content).text || content,
          startOffsetMs: startMs,
          endOffsetMs: endMs ?? startMs + 5000,
          speaker: speaker || undefined,
        });
        i++;
        continue;
      }

      // Check (00:04) Content or [00:04] Content or 00:04 Content
      const tsMatch = line.match(timestampRegex);
      if (tsMatch) {
        hasExplicitTimestamps = true;
        const startMs = parseTimestampMs(tsMatch[1]) ?? 0;
        const endMs = tsMatch[2] ? parseTimestampMs(tsMatch[2]) : null;
        let remaining = tsMatch[3]?.trim() || '';

        if (
          !remaining &&
          i + 1 < lines.length &&
          !lines[i + 1].match(timestampRegex)
        ) {
          i++;
          remaining = lines[i];
        }

        const { text, speaker } = cleanCaptionText(remaining || line);
        segments.push({
          content: text || remaining || line,
          startOffsetMs: startMs,
          endOffsetMs: endMs ?? startMs + 5000,
          ...(speaker ? { speaker } : {}),
        });
        i++;
        continue;
      }

      // If no timestamp, fall back to sequential interval or single paragraph
      const { text, speaker } = cleanCaptionText(line);
      segments.push({
        content: text || line,
        startOffsetMs: segments.length * 15_000,
        endOffsetMs: (segments.length + 1) * 15_000,
        ...(speaker ? { speaker } : {}),
      });
      i++;
    }

    // Adjust contiguous endOffsetMs if explicit timestamps were used
    if (hasExplicitTimestamps) {
      for (let j = 0; j < segments.length - 1; j++) {
        if (
          segments[j].endOffsetMs <= segments[j].startOffsetMs ||
          segments[j].endOffsetMs === segments[j].startOffsetMs + 5000
        ) {
          if (segments[j + 1].startOffsetMs > segments[j].startOffsetMs) {
            segments[j].endOffsetMs = segments[j + 1].startOffsetMs;
          }
        }
      }
    }

    return segments.filter((s) => s.content.trim().length > 0);
  }
}
