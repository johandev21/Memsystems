import { describe, expect, it } from "vitest";
import {
  formatTime,
  hasTimestampPatterns,
  parseRawTextToVideoSegments,
  parseTimestampToMs,
} from "./video-transcript-parser";

describe("video-transcript-parser", () => {
  describe("parseTimestampToMs", () => {
    it("parses MM:SS format correctly", () => {
      expect(parseTimestampToMs("00:04")).toBe(4000);
      expect(parseTimestampToMs("0:04")).toBe(4000);
      expect(parseTimestampToMs("01:30")).toBe(90000);
    });

    it("parses HH:MM:SS format correctly", () => {
      expect(parseTimestampToMs("01:02:03")).toBe((3600 + 120 + 3) * 1000);
      expect(parseTimestampToMs("1:00:00")).toBe(3600 * 1000);
    });

    it("parses milliseconds with dot or comma", () => {
      expect(parseTimestampToMs("00:04.500")).toBe(4500);
      expect(parseTimestampToMs("00:04,500")).toBe(4500);
    });

    it("returns 0 for invalid timestamp strings", () => {
      expect(parseTimestampToMs("")).toBe(0);
      expect(parseTimestampToMs("invalid")).toBe(0);
    });
  });

  describe("formatTime", () => {
    it("formats seconds into mm:ss format", () => {
      expect(formatTime(4)).toBe("00:04");
      expect(formatTime(65)).toBe("01:05");
    });

    it("formats hours into hh:mm:ss format when >= 3600 seconds", () => {
      expect(formatTime(3665)).toBe("1:01:05");
    });

    it("handles edge cases like 0 or negative numbers", () => {
      expect(formatTime(0)).toBe("00:00");
      expect(formatTime(-10)).toBe("00:00");
      expect(formatTime(NaN)).toBe("00:00");
    });
  });

  describe("hasTimestampPatterns", () => {
    it("detects multiple timestamps in text", () => {
      expect(hasTimestampPatterns("(00:00) Intro\n(00:04) Part 1")).toBe(true);
      expect(hasTimestampPatterns("[00:00] Intro\n[00:04] Part 1")).toBe(true);
      expect(hasTimestampPatterns("Just plain text with no times")).toBe(false);
      expect(hasTimestampPatterns("Only one time (00:04)")).toBe(false);
    });
  });

  describe("parseRawTextToVideoSegments", () => {
    it("parses YouTube parentheses format: (00:04) Content", () => {
      const text = `
(00:00) Welcome to this video
(00:04) In this part we will explore architecture
(00:15) Key takeaways and conclusion
      `.trim();

      const segments = parseRawTextToVideoSegments(text);
      expect(segments).toHaveLength(3);

      expect(segments[0].content).toBe("Welcome to this video");
      expect(segments[0].startOffsetMs).toBe(0);
      expect(segments[0].endOffsetMs).toBe(4000);

      expect(segments[1].content).toBe("In this part we will explore architecture");
      expect(segments[1].startOffsetMs).toBe(4000);
      expect(segments[1].endOffsetMs).toBe(15000);

      expect(segments[2].content).toBe("Key takeaways and conclusion");
      expect(segments[2].startOffsetMs).toBe(15000);
      expect(segments[2].endOffsetMs).toBe(20000); // 15000 + 5000 fallback
    });

    it("parses square bracket format: [00:04] Content", () => {
      const text = `
[00:00] First segment
[00:10] Second segment
[00:25] Third segment
      `.trim();

      const segments = parseRawTextToVideoSegments(text);
      expect(segments).toHaveLength(3);
      expect(segments[0].startOffsetMs).toBe(0);
      expect(segments[1].startOffsetMs).toBe(10000);
      expect(segments[2].startOffsetMs).toBe(25000);
    });

    it("parses bare timestamps at start of line: 00:04 Content", () => {
      const text = `
0:00 Introduction
0:04 First chapter
0:20 Next steps
      `.trim();

      const segments = parseRawTextToVideoSegments(text);
      expect(segments).toHaveLength(3);
      expect(segments[0].content).toBe("Introduction");
      expect(segments[0].startOffsetMs).toBe(0);
      expect(segments[1].content).toBe("First chapter");
      expect(segments[1].startOffsetMs).toBe(4000);
      expect(segments[2].content).toBe("Next steps");
      expect(segments[2].startOffsetMs).toBe(20000);
    });

    it("parses multi-line YouTube copied transcript format (timestamp line followed by text line)", () => {
      const text = `
0:00
Welcome to the channel
0:04
Today we are learning TypeScript
0:15
Let's get started
      `.trim();

      const segments = parseRawTextToVideoSegments(text);
      expect(segments).toHaveLength(3);
      expect(segments[0].content).toBe("Welcome to the channel");
      expect(segments[0].startOffsetMs).toBe(0);
      expect(segments[0].endOffsetMs).toBe(4000);

      expect(segments[1].content).toBe("Today we are learning TypeScript");
      expect(segments[1].startOffsetMs).toBe(4000);
      expect(segments[1].endOffsetMs).toBe(15000);

      expect(segments[2].content).toBe("Let's get started");
      expect(segments[2].startOffsetMs).toBe(15000);
    });

    it("parses timestamp ranges e.g. [00:04 - 00:10] or (00:04 - 00:10)", () => {
      const text = `
[00:00 - 00:05] Intro
[00:05 - 00:15] Section 1
      `.trim();

      const segments = parseRawTextToVideoSegments(text);
      expect(segments).toHaveLength(2);
      expect(segments[0].startOffsetMs).toBe(0);
      expect(segments[0].endOffsetMs).toBe(5000);
      expect(segments[1].startOffsetMs).toBe(5000);
      expect(segments[1].endOffsetMs).toBe(15000);
    });

    it("returns empty array for empty or whitespace text", () => {
      expect(parseRawTextToVideoSegments("")).toEqual([]);
      expect(parseRawTextToVideoSegments("   \n\n  ")).toEqual([]);
    });
  });
});
