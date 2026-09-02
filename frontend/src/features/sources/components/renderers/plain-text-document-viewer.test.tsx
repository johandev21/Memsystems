import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlainTextDocumentViewer } from "./plain-text-document-viewer";

describe("PlainTextDocumentViewer", () => {
  it("renders literal plaintext without parsing Markdown syntax", () => {
    const rawContent = [
      "# Header Level 1",
      "## Header Level 2",
      "```javascript",
      "const foo = 123;",
      "```",
      "- List item 1",
      "- List item 2",
      "[Link to nowhere](https://example.com)",
      "**Bold text** and *italic text* and `inline code`",
      "$E = mc^2$",
    ].join("\n");

    const { container } = render(<PlainTextDocumentViewer content={rawContent} />);

    // Assert literal text is in the document
    expect(screen.getByText(/# Header Level 1/)).toBeTruthy();
    expect(screen.getByText(/## Header Level 2/)).toBeTruthy();
    expect(screen.getByText(/const foo = 123;/)).toBeTruthy();
    expect(screen.getByText(/- List item 1/)).toBeTruthy();
    expect(screen.getByText(/\[Link to nowhere\]\(https:\/\/example\.com\)/)).toBeTruthy();
    expect(screen.getByText(/\*\*Bold text\*\*/)).toBeTruthy();
    expect(screen.getByText(/\$E = mc\^2\$/)).toBeTruthy();

    // Assert NO Markdown HTML elements were created
    expect(container.querySelector("h1")).toBeNull();
    expect(container.querySelector("h2")).toBeNull();
    expect(container.querySelector("ul")).toBeNull();
    expect(container.querySelector("li")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("code")).toBeNull();
    expect(container.querySelector(".katex")).toBeNull();
  });

  it("renders empty state when content is empty", () => {
    render(<PlainTextDocumentViewer content="" />);
    expect(screen.getByText("No text content available.")).toBeTruthy();
  });

  it("handles citation locator navigation and highlighting in static mode", () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    const content = [
      "Paragraph 1: Introduction",
      "Paragraph 2: Second section",
      "Paragraph 3: Target information",
      "Paragraph 4: Conclusion",
    ].join("\n\n");

    const { rerender } = render(
      <PlainTextDocumentViewer content={content} selectedLocator={null} />,
    );

    expect(screen.getByText("Paragraph 3: Target information")).toBeTruthy();

    // Select locator pointing to line 3 / paragraph 3
    rerender(
      <PlainTextDocumentViewer
        content={content}
        selectedLocator={{ lineStart: 3, pageNumber: 3 }}
      />,
    );

    // scrollIntoView should have been called
    expect(scrollIntoViewMock).toHaveBeenCalled();
  });

  it("supports large content with virtualization", () => {
    const paragraphs = Array.from({ length: 40 }, (_, i) => `Block ${i + 1}: Sample text line.`);
    const content = paragraphs.join("\n\n");

    const scrollContainer = document.createElement("div");
    Object.defineProperty(scrollContainer, "clientHeight", { value: 600 });
    Object.defineProperty(scrollContainer, "scrollHeight", { value: 2000 });
    scrollContainer.getBoundingClientRect = () => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    const { container } = render(
      <PlainTextDocumentViewer
        content={content}
        scrollElement={scrollContainer}
      />,
    );

    // Initial render should render blocks
    expect(screen.getByText(/Block 1:/)).toBeTruthy();
    expect(container.querySelector("[data-text-block-index]")).not.toBeNull();
  });
});
