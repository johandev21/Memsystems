import { describe, expect, it } from "vitest";
import {
  extractArXivId,
  extractDoi,
  extractYouTubeId,
  isArXivUrl,
  isDoi,
  isYouTubeUrl,
  splitTextIntoChunks,
} from "./detect-document-type";

describe("detect-document-type utilities", () => {
  describe("YouTube helpers", () => {
    it("detects YouTube URLs and extracts video IDs", () => {
      const url1 = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      const url2 = "https://youtu.be/dQw4w9WgXcQ?t=42";
      const url3 = "https://youtube.com/shorts/dQw4w9WgXcQ";

      expect(isYouTubeUrl(url1)).toBe(true);
      expect(isYouTubeUrl(url2)).toBe(true);
      expect(isYouTubeUrl(url3)).toBe(true);
      expect(extractYouTubeId(url1)).toBe("dQw4w9WgXcQ");
      expect(extractYouTubeId(url2)).toBe("dQw4w9WgXcQ");
      expect(extractYouTubeId(url3)).toBe("dQw4w9WgXcQ");
    });

    it("returns false and null for non-YouTube URLs", () => {
      expect(isYouTubeUrl("https://example.com/video.mp4")).toBe(false);
      expect(extractYouTubeId("https://example.com")).toBeNull();
      expect(isYouTubeUrl("")).toBe(false);
    });
  });

  describe("arXiv helpers", () => {
    it("detects arXiv IDs and URLs and extracts canonical IDs", () => {
      expect(isArXivUrl("2301.12345")).toBe(true);
      expect(isArXivUrl("2301.12345v2")).toBe(true);
      expect(isArXivUrl("arXiv:2301.12345")).toBe(true);
      expect(isArXivUrl("https://arxiv.org/abs/2301.12345")).toBe(true);
      expect(isArXivUrl("https://arxiv.org/pdf/2301.12345.pdf")).toBe(true);
      expect(isArXivUrl("math.GT/0309136")).toBe(true);

      expect(extractArXivId("https://arxiv.org/abs/2301.12345")).toBe("2301.12345");
      expect(extractArXivId("arXiv:2301.12345v2")).toBe("2301.12345v2");
      expect(extractArXivId("2301.12345")).toBe("2301.12345");
    });

    it("returns false and null for non-arXiv inputs", () => {
      expect(isArXivUrl("https://example.com/paper")).toBe(false);
      expect(extractArXivId("https://example.com")).toBeNull();
      expect(isArXivUrl("")).toBe(false);
    });
  });

  describe("DOI helpers", () => {
    it("detects DOIs and DOI URLs and extracts DOI strings", () => {
      expect(isDoi("10.1000/182")).toBe(true);
      expect(isDoi("doi:10.1000/182")).toBe(true);
      expect(isDoi("https://doi.org/10.1000/182")).toBe(true);
      expect(isDoi("http://dx.doi.org/10.1038/nature12373")).toBe(true);

      expect(extractDoi("10.1000/182")).toBe("10.1000/182");
      expect(extractDoi("doi:10.1038/nature12373")).toBe("10.1038/nature12373");
      expect(extractDoi("https://doi.org/10.1000/182")).toBe("10.1000/182");
    });

    it("returns false and null for non-DOI inputs", () => {
      expect(isDoi("https://example.com")).toBe(false);
      expect(extractDoi("https://example.com")).toBeNull();
      expect(isDoi("")).toBe(false);
    });
  });

  describe("splitTextIntoChunks", () => {
    it("returns empty array for empty or whitespace-only text", () => {
      expect(splitTextIntoChunks("")).toEqual([]);
      expect(splitTextIntoChunks("   \n\n  \n  ")).toEqual([]);
    });

    it("splits standard paragraphs separated by newlines", () => {
      const text = "Paragraph 1\n\nParagraph 2\n\n\nParagraph 3";
      expect(splitTextIntoChunks(text)).toEqual([
        "Paragraph 1",
        "Paragraph 2",
        "Paragraph 3",
      ]);
    });

    it("keeps fenced code blocks with internal blank lines in a single chunk", () => {
      const text = [
        "# Code Title",
        "```typescript\nfunction test() {\n\n  const a = 1;\n\n  return a;\n}\n```",
        "Paragraph after code",
      ].join("\n\n");

      const chunks = splitTextIntoChunks(text);
      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toBe("# Code Title");
      expect(chunks[1]).toBe(
        "```typescript\nfunction test() {\n\n  const a = 1;\n\n  return a;\n}\n```",
      );
      expect(chunks[2]).toBe("Paragraph after code");
    });

    it("keeps tilde-fenced code blocks with internal blank lines intact", () => {
      const text = [
        "~~~python\ndef hello():\n\n    print('world')\n~~~",
        "Next paragraph",
      ].join("\n\n");

      const chunks = splitTextIntoChunks(text);
      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toBe("~~~python\ndef hello():\n\n    print('world')\n~~~");
      expect(chunks[1]).toBe("Next paragraph");
    });

    it("handles multiple divider chunks correctly without merging or omitting", () => {
      const text = "---\n\n---\n\n---";
      expect(splitTextIntoChunks(text)).toEqual(["---", "---", "---"]);
    });
  });
});
