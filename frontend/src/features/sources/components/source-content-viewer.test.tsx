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
  it("renders audio skeleton with title and working back button while audio source is pending", () => {
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
    expect(screen.getByText("lecture.mp3")).toBeTruthy();

    // Audio skeleton should be rendered
    expect(screen.getByTestId("audio-viewer-skeleton")).toBeTruthy();

    // Back button should be functional
    const backBtn = screen.getByRole("button", { name: /back to sources/i });
    backBtn.click();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders video skeleton while video source is pending", () => {
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

    expect(screen.getByText("talk.mp4")).toBeTruthy();
    expect(screen.getByTestId("video-viewer-skeleton")).toBeTruthy();
  });

  it("renders slides skeleton while presentation source is pending", () => {
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

    expect(screen.getByText("deck.pptx")).toBeTruthy();
    expect(screen.getByTestId("slides-viewer-skeleton")).toBeTruthy();
  });

  it("renders image skeleton while image source is pending", () => {
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

    expect(screen.getByText("diagram.png")).toBeTruthy();
    expect(screen.getByTestId("image-viewer-skeleton")).toBeTruthy();
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

  it("routes plaintext source with markdown-like text to PlainTextDocumentViewer (literal rendering)", () => {
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

    expect(screen.getByText(/# Heading In Txt/)).toBeTruthy();

    // Verify it was rendered as literal plaintext, NOT <h1>
    expect(container.querySelector("h1")).toBeNull();
  });

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

    renderWithClient(
      <SourceContentViewer sourceId="src-degraded-1" onClose={vi.fn()} />,
      { key: ["source", "src-degraded-1"], data: degradedSource },
    );

    expect(screen.getByText("This source has no usable content")).toBeTruthy();
    expect(screen.getByText(/table of contents/i)).toBeTruthy();
    expect(screen.getByText(/paste the text/i)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /back to sources/i }),
    ).toBeTruthy();
  });
});
