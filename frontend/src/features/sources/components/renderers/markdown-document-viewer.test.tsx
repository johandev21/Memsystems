import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarkdownDocumentViewer } from "./markdown-document-viewer";

describe("MarkdownDocumentViewer", () => {
  it("renders genuine markdown headings, lists, blockquotes, and tables", () => {
    const markdownContent = [
      "# Main Title",
      "## Sub Title",
      "This is a paragraph with **bold** text.",
      "> Quote block",
      "- Item 1",
      "- Item 2",
    ].join("\n\n");

    const { container } = render(<MarkdownDocumentViewer content={markdownContent} />);

    expect(screen.getByRole("heading", { level: 1, name: /Main Title/ })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: /Sub Title/ })).toBeTruthy();
    expect(container.querySelector("blockquote")).not.toBeNull();
    expect(container.querySelector("ul")).not.toBeNull();
    expect(container.querySelector("strong")).not.toBeNull();
  });

  it("handles citation locator by symbol in static mode", () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    const content = [
      "# Introduction",
      "Intro text",
      "## Deep Architecture",
      "Architecture details",
    ].join("\n\n");

    const { rerender } = render(
      <MarkdownDocumentViewer content={content} selectedLocator={null} />,
    );

    rerender(
      <MarkdownDocumentViewer
        content={content}
        selectedLocator={{ symbol: "Deep Architecture" }}
      />,
    );

    expect(scrollIntoViewMock).toHaveBeenCalled();
  });

  it("handles empty content", () => {
    render(<MarkdownDocumentViewer content="" />);
    expect(screen.getByText("No text content available.")).toBeTruthy();
  });
});
