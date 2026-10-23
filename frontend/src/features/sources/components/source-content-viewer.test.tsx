import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SourceContentViewer } from "./source-content-viewer";
import type { SourceWithContent } from "../types";

function renderWithClient(
  ui: React.ReactElement,
  initialData?: { key: unknown[]; data: unknown } | Array<{ key: unknown[]; data: unknown }>,
) {
  const testClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  if (initialData) {
    const entries = Array.isArray(initialData) ? initialData : [initialData];
    for (const entry of entries) {
      testClient.setQueryData(entry.key, entry.data);
    }
  }
  return render(<QueryClientProvider client={testClient}>{ui}</QueryClientProvider>);
}

describe("SourceContentViewer", () => {
  it("uses the document skeleton for a pending audio source", () => {
    const onClose = vi.fn();
    renderWithClient(<SourceContentViewer sourceId="src-audio-1" onClose={onClose} />, [
      {
        key: ["sources", "nb-1"],
        data: [
          {
            id: "src-audio-1",
            notebookId: "nb-1",
            kind: "file",
            title: "lecture.mp3",
            url: null,
            modality: "audio",
            contentType: "audio/mpeg",
            fileSize: 1000,
            createdAt: "2026-08-30T12:00:00.000Z",
          },
        ],
      },
    ]);

    // Title should be visible immediately in header
    expect(screen.getByText("lecture")).toBeTruthy();

    expect(screen.getByTestId("document-viewer-skeleton")).toBeTruthy();

    // Back button should be functional
    const backBtn = screen.getByRole("button", { name: /back to sources/i });
    backBtn.click();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("uses the document skeleton for a pending video source", () => {
    renderWithClient(<SourceContentViewer sourceId="src-video-1" onClose={vi.fn()} />, [
      {
        key: ["sources", "nb-1"],
        data: [
          {
            id: "src-video-1",
            notebookId: "nb-1",
            kind: "file",
            title: "talk.mp4",
            url: null,
            modality: "video",
            contentType: "video/mp4",
            fileSize: 5000,
            createdAt: "2026-08-30T12:00:00.000Z",
          },
        ],
      },
    ]);

    expect(screen.getByText("talk")).toBeTruthy();
    expect(screen.getByTestId("document-viewer-skeleton")).toBeTruthy();
  });

  it("uses the document skeleton for a pending presentation source", () => {
    renderWithClient(<SourceContentViewer sourceId="src-pptx-1" onClose={vi.fn()} />, [
      {
        key: ["sources", "nb-1"],
        data: [
          {
            id: "src-pptx-1",
            notebookId: "nb-1",
            kind: "file",
            title: "deck.pptx",
            url: null,
            modality: "slides",
            contentType:
              "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            fileSize: 5000,
            createdAt: "2026-08-30T12:00:00.000Z",
          },
        ],
      },
    ]);

    expect(screen.getByText("deck")).toBeTruthy();
    expect(screen.getByTestId("document-viewer-skeleton")).toBeTruthy();
  });

  it("uses the document skeleton for a pending image source", () => {
    renderWithClient(<SourceContentViewer sourceId="src-img-1" onClose={vi.fn()} />, [
      {
        key: ["sources", "nb-1"],
        data: [
          {
            id: "src-img-1",
            notebookId: "nb-1",
            kind: "file",
            title: "diagram.png",
            url: null,
            modality: "image",
            contentType: "image/png",
            fileSize: 5000,
            createdAt: "2026-08-30T12:00:00.000Z",
          },
        ],
      },
    ]);

    expect(screen.getByText("diagram")).toBeTruthy();
    expect(screen.getByTestId("document-viewer-skeleton")).toBeTruthy();
  });

  it("renders document skeleton when source is cold pending without cached summary", () => {
    const onClose = vi.fn();
    renderWithClient(<SourceContentViewer sourceId="unknown-src" onClose={onClose} />);

    // Should mount document viewer skeleton and source-reader-skeleton
    expect(screen.getByTestId("source-reader-skeleton")).toBeTruthy();
    expect(screen.getByTestId("document-viewer-skeleton")).toBeTruthy();

    // Back button still works
    const backBtn = screen.getByRole("button", { name: /back to sources/i });
    backBtn.click();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders extracted text as Markdown regardless of source format", () => {
    const mockTxtSource: SourceWithContent = {
      id: "src-txt-1",
      notebookId: "nb-1",
      kind: "file",
      title: "notes.txt",
      url: null,
      modality: "document",
      contentType: "text/plain",
      fileSize: 100,
      createdAt: "2026-08-30T12:00:00.000Z",
      rawText: "# Heading In Txt\n\n```python\nprint('hello')\n```",
      s3Key: "uploads/notes.txt",
      sha256: "txtsha",
    };

    const { container } = renderWithClient(
      <SourceContentViewer sourceId="src-txt-1" onClose={vi.fn()} />,
      { key: ["source", "src-txt-1"], data: mockTxtSource },
    );

    expect(screen.getByRole("heading", { name: "Heading In Txt" })).toBeTruthy();

    expect(container.querySelector("h1")?.textContent).toBe("Heading In Txt");
  });

  it("renders extracted YouTube text without mounting media or Markdown images", () => {
    const source: SourceWithContent = {
      id: "src-yt-1",
      notebookId: "nb-1",
      kind: "url",
      title: "YouTube lecture",
      url: "https://youtube.com/watch?v=dQw4w9WgXcQ",
      modality: "video",
      contentType: "text/html",
      fileSize: null,
      createdAt: "2026-08-30T12:00:00.000Z",
      rawText: "# Transcript\n\n![lecture slide](https://example.com/slide.png)",
      s3Key: null,
      sha256: null,
    };
    const { container } = renderWithClient(
      <SourceContentViewer sourceId={source.id} onClose={vi.fn()} />,
      { key: ["source", source.id], data: source },
    );

    expect(screen.getByRole("heading", { name: "Transcript" })).toBeTruthy();
    expect(screen.getByText("lecture slide")).toBeTruthy();
    expect(container.querySelector("img, iframe, video, audio")).toBeNull();
  });

  it("keeps the reader recovery menu accessible for failed YouTube sources", () => {
    const source: SourceWithContent = {
      id: "failed-youtube",
      notebookId: "nb-1",
      kind: "url",
      title: "Nietzsche lecture",
      url: "https://youtube.com/live/dQw4w9WgXcQ",
      modality: "video",
      contentType: "text/html",
      fileSize: null,
      createdAt: "2026-10-22T12:00:00Z",
      rawText: "",
      s3Key: null,
      sha256: null,
      processingStatus: "failed",
    };
    renderWithClient(<SourceContentViewer sourceId={source.id} onClose={vi.fn()} />, {
      key: ["source", source.id],
      data: source,
    });
    expect(screen.getByRole("button", { name: "More actions" })).toBeTruthy();
    expect(screen.getByText("This source is not available for reading.")).toBeTruthy();
  });

  it.each([
    ["PDF", "book.pdf", "application/pdf", "document", "file"],
    [
      "presentation",
      "deck.pptx",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "slides",
      "file",
    ],
    [
      "spreadsheet",
      "data.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "dataset",
      "file",
    ],
    ["web page", "Article", "text/html", "document", "url"],
    ["audio", "lecture.mp3", "audio/mpeg", "audio", "file"],
    ["video", "lecture.mp4", "video/mp4", "video", "file"],
    ["image", "diagram.png", "image/png", "image", "file"],
    ["legacy record without MIME", "old-upload", null, "document", "file"],
  ] as const)(
    "renders extracted Markdown for %s sources",
    (_label, title, contentType, modality, kind) => {
      const source: SourceWithContent = {
        id: `src-${title}`,
        notebookId: "nb-1",
        kind,
        title,
        url: kind === "url" ? "https://example.com/article" : null,
        modality,
        contentType,
        fileSize: 100,
        createdAt: "2026-08-30T12:00:00.000Z",
        rawText: "# Extracted Markdown",
        s3Key: kind === "file" ? `uploads/${title}` : null,
        sha256: null,
      };
      renderWithClient(<SourceContentViewer sourceId={source.id} onClose={vi.fn()} />, {
        key: ["source", source.id],
        data: source,
      });

      expect(screen.getByRole("heading", { name: "Extracted Markdown" })).toBeTruthy();
    },
  );

  it("routes genuine markdown source to MarkdownDocumentViewer", () => {
    const mockMdSource: SourceWithContent = {
      id: "src-md-1",
      notebookId: "nb-1",
      kind: "file",
      title: "README.md",
      url: null,
      modality: "document",
      contentType: "text/markdown",
      fileSize: 100,
      createdAt: "2026-08-30T12:00:00.000Z",
      rawText: "# Genuine Markdown Heading\n\nSome body text.",
      s3Key: "uploads/README.md",
      sha256: "mdsha",
    };

    const { container } = renderWithClient(
      <SourceContentViewer sourceId="src-md-1" onClose={vi.fn()} />,
      { key: ["source", "src-md-1"], data: mockMdSource },
    );

    expect(
      screen.getByRole("heading", { level: 1, name: /Genuine Markdown Heading/ }),
    ).toBeTruthy();

    // Verify it was rendered with markdown heading tag
    expect(container.querySelector("h1")).not.toBeNull();
  });

  it("explains a degraded source with its reason and corrective action", () => {
    const degradedSource: SourceWithContent = {
      id: "src-degraded-1",
      notebookId: "nb-1",
      kind: "url",
      title: "Beyond Good and Evil Summary",
      url: "https://example.com/bge",
      modality: "document",
      contentType: "text/html",
      fileSize: null,
      createdAt: "2026-08-30T12:00:00.000Z",
      processingStatus: "degraded",
      processingStage: null,
      processingErrorCode: "quality_navigation",
      processingErrorMessage: "errors.sources.quality.navigation",
      rawText: "Chapter 1 Chapter 2 Chapter 3",
      s3Key: null,
      sha256: null,
    };

    renderWithClient(<SourceContentViewer sourceId="src-degraded-1" onClose={vi.fn()} />, {
      key: ["source", "src-degraded-1"],
      data: degradedSource,
    });

    expect(screen.getByText("This source has no usable content")).toBeTruthy();
    expect(screen.getByText(/table of contents/i)).toBeTruthy();
    expect(screen.getByText(/paste the text/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /back to sources/i })).toBeTruthy();
  });
});
