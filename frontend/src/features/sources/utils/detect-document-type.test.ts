import { describe, expect, it } from "vitest";
import {
  detectDocumentType,
  extractArXivId,
  extractDoi,
  extractYouTubeId,
  isArXivUrl,
  isDoi,
  isYouTubeUrl,
} from "./detect-document-type";
import type { SourceWithContent } from "../types";

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

  describe("detectDocumentType", () => {
    it("detects video for YouTube sources", () => {
      const source: SourceWithContent = {
        id: "s-yt",
        notebookId: "nb-1",
        kind: "url",
        title: "YouTube Video",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        modality: "video",
        contentType: "text/html",
        createdAt: "2026-08-30T00:00:00Z",
        rawText: "Video transcript",
        s3Key: null,
        sha256: null,
        fileSize: null,
      };
      expect(detectDocumentType(source)).toBe("video");
    });

    it("detects article for web and academic URL sources", () => {
      const source: SourceWithContent = {
        id: "s-arxiv",
        notebookId: "nb-1",
        kind: "url",
        title: "arXiv Paper",
        url: "https://arxiv.org/abs/2301.12345",
        modality: "document",
        contentType: "application/pdf",
        createdAt: "2026-08-30T00:00:00Z",
        rawText: "Paper abstract",
        s3Key: null,
        sha256: null,
        fileSize: null,
      };
      expect(detectDocumentType(source)).toBe("article");
    });

    it("detects code for programming source files", () => {
      const source: SourceWithContent = {
        id: "s-code",
        notebookId: "nb-1",
        kind: "file",
        title: "algorithm.py",
        url: null,
        modality: "code",
        contentType: "text/x-python",
        createdAt: "2026-08-30T00:00:00Z",
        rawText: "def solve():\n    pass",
        s3Key: "uploads/algorithm.py",
        sha256: null,
        fileSize: 100,
      };
      expect(detectDocumentType(source)).toBe("code");
    });

    it("detects jupyter for .ipynb notebooks", () => {
      const source: SourceWithContent = {
        id: "s-nb",
        notebookId: "nb-1",
        kind: "file",
        title: "analysis.ipynb",
        url: null,
        modality: "code",
        contentType: "application/x-ipynb+json",
        createdAt: "2026-08-30T00:00:00Z",
        rawText: '{"cells": []}',
        s3Key: "uploads/analysis.ipynb",
        sha256: null,
        fileSize: 500,
      };
      expect(detectDocumentType(source)).toBe("jupyter");
    });

    it("detects dataset for CSV, TSV, and XLSX files", () => {
      const sourceCsv: SourceWithContent = {
        id: "s-csv",
        notebookId: "nb-1",
        kind: "file",
        title: "dataset.csv",
        url: null,
        modality: "dataset",
        contentType: "text/csv",
        createdAt: "2026-08-30T00:00:00Z",
        rawText: "a,b,c\n1,2,3",
        s3Key: "uploads/dataset.csv",
        sha256: null,
        fileSize: 200,
      };
      expect(detectDocumentType(sourceCsv)).toBe("dataset");

      const sourceXlsx: SourceWithContent = {
        id: "s-xlsx",
        notebookId: "nb-1",
        kind: "file",
        title: "financials.xlsx",
        url: null,
        modality: "dataset",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        createdAt: "2026-08-30T00:00:00Z",
        rawText: "Sheet 1 preview",
        s3Key: "uploads/financials.xlsx",
        sha256: null,
        fileSize: 2000,
      };
      expect(detectDocumentType(sourceXlsx)).toBe("dataset");
    });
  });
});
