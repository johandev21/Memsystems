import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SourceContentViewer } from "./source-content-viewer";
import type { SourceWithContent } from "../types";

function renderWithClient(ui: React.ReactElement, initialData?: { key: unknown[]; data: unknown }) {
  const testClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  if (initialData) {
    testClient.setQueryData(initialData.key, initialData.data);
  }
  return render(<QueryClientProvider client={testClient}>{ui}</QueryClientProvider>);
}

describe("SourceContentViewer", () => {
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

    expect(screen.getByRole("heading", { level: 1, name: /Genuine Markdown Heading/ })).toBeTruthy();

    // Verify it was rendered with markdown heading tag
    expect(container.querySelector("h1")).not.toBeNull();
  });
});

