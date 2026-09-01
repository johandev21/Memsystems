import { describe, expect, it } from 'vitest';
import {
  CaptionParserService,
  parseTimestampMs,
} from '../src/modules/sources/caption-parser.service';

describe('CaptionParserService', () => {
  const service = new CaptionParserService();

  describe('parseTimestampMs', () => {
    it('parses HH:MM:SS.mmm format', () => {
      expect(parseTimestampMs('01:02:03.456')).toBe(3723456);
      expect(parseTimestampMs('00:00:05.500')).toBe(5500);
    });

    it('parses MM:SS.mmm format', () => {
      expect(parseTimestampMs('02:15.800')).toBe(135800);
      expect(parseTimestampMs('00:01.000')).toBe(1000);
    });

    it('parses SRT comma-decimal timestamps (HH:MM:SS,mmm)', () => {
      expect(parseTimestampMs('00:01:23,456')).toBe(83456);
      expect(parseTimestampMs('01:30:00,000')).toBe(5400000);
    });

    it('parses raw second values', () => {
      expect(parseTimestampMs('12.5')).toBe(12500);
      expect(parseTimestampMs('0')).toBe(0);
    });

    it('returns null on invalid inputs', () => {
      expect(parseTimestampMs('')).toBeNull();
      expect(parseTimestampMs('invalid')).toBeNull();
    });
  });

  describe('WebVTT parsing', () => {
    it('parses standard WebVTT cues with voice tags and HTML tags', () => {
      const vtt = `WEBVTT - Sample Transcript

00:00:01.000 --> 00:00:04.500
<v Alice>Hello <b>everyone</b>, welcome to the course.</v>

00:00:05.000 --> 00:00:08.200 position:10% align:left
<v Bob>Thanks Alice! Today we explore <i>distributed systems</i>.</v>
`;

      const segments = service.parseVtt(vtt);
      expect(segments).toHaveLength(2);

      expect(segments[0]).toEqual({
        content: 'Hello everyone, welcome to the course.',
        startOffsetMs: 1000,
        endOffsetMs: 4500,
        speaker: 'Alice',
      });

      expect(segments[1]).toEqual({
        content: 'Thanks Alice! Today we explore distributed systems.',
        startOffsetMs: 5000,
        endOffsetMs: 8200,
        speaker: 'Bob',
      });
    });

    it('parses WebVTT cues with identifier numbers before timestamps', () => {
      const vtt = `WEBVTT

1
00:01.000 --> 00:04.000
First line of text.

2
00:05.500 --> 00:09.000
Second line of text.
`;

      const segments = service.parseVtt(vtt);
      expect(segments).toHaveLength(2);
      expect(segments[0].startOffsetMs).toBe(1000);
      expect(segments[0].endOffsetMs).toBe(4000);
      expect(segments[0].content).toBe('First line of text.');
      expect(segments[1].startOffsetMs).toBe(5500);
      expect(segments[1].endOffsetMs).toBe(9000);
      expect(segments[1].content).toBe('Second line of text.');
    });
  });

  describe('SubRip (SRT) parsing', () => {
    it('parses multi-line SRT subtitle blocks and strips speaker prefix if present', () => {
      const srt = `1
00:00:01,500 --> 00:00:04,000
[Prof. Smith]: Welcome to lecture one.
We will discuss kernel design.

2
00:00:04,500 --> 00:00:08,000
Dr. Jones: Next let's examine page tables &amp; virtual memory.
`;

      const segments = service.parseSrt(srt);
      expect(segments).toHaveLength(2);

      expect(segments[0]).toEqual({
        content: 'Welcome to lecture one. We will discuss kernel design.',
        startOffsetMs: 1500,
        endOffsetMs: 4000,
        speaker: 'Prof. Smith',
      });

      expect(segments[1]).toEqual({
        content: "Next let's examine page tables & virtual memory.",
        startOffsetMs: 4500,
        endOffsetMs: 8000,
        speaker: 'Dr. Jones',
      });
    });
  });

  describe('JSON3 and XML parsing', () => {
    it('parses JSON3 caption events', () => {
      const json3 = JSON.stringify({
        events: [
          {
            tStartMs: 2000,
            dDurationMs: 3000,
            segs: [{ utf8: 'First segment ' }, { utf8: 'content.' }],
          },
        ],
      });

      const segments = service.parseJson3(json3);
      expect(segments).toHaveLength(1);
      expect(segments[0]).toEqual({
        content: 'First segment content.',
        startOffsetMs: 2000,
        endOffsetMs: 5000,
      });
    });

    it('parses XML timed text elements', () => {
      const xml = `<transcript><text start="3.2" dur="2.8">&lt;b&gt;Important&lt;/b&gt; point</text></transcript>`;
      const segments = service.parseXml(xml);
      expect(segments).toHaveLength(1);
      expect(segments[0]).toEqual({
        content: 'Important point',
        startOffsetMs: 3200,
        endOffsetMs: 6000,
      });
    });
  });

  describe('Auto format detection and fallback', () => {
    it('automatically identifies and parses VTT format', () => {
      const vtt = `WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello`;
      const segments = service.parse(vtt, 'auto');
      expect(segments).toHaveLength(1);
      expect(segments[0].content).toBe('Hello');
    });

    it('parses plain text into spaced segments', () => {
      const plain = `Introduction to the topic.\n\nDeep dive into details and examples.\n\nConclusion.`;
      const segments = service.parse(plain, 'plain');
      expect(segments).toHaveLength(3);
      expect(segments[0].content).toBe('Introduction to the topic.');
      expect(segments[0].startOffsetMs).toBe(0);
      expect(segments[1].startOffsetMs).toBe(15000);
      expect(segments[2].startOffsetMs).toBe(30000);
    });

    it('returns empty array for empty inputs', () => {
      expect(service.parse('')).toEqual([]);
      expect(service.parse('   ')).toEqual([]);
    });
  });
});
