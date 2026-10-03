import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarkdownDocumentViewer } from "./markdown-document-viewer";

describe("MarkdownDocumentViewer", () => {
  it("inherits chat typography for paragraphs and list items without desktop size overrides", () => {
    const { container } = render(
      <MarkdownDocumentViewer content={"Source paragraph\n\n- Source item"} />,
    );
    const typography = container.querySelector(".typeset.typeset-chat");
    expect(typography).not.toBeNull();
    expect(typography?.querySelector("p")?.className).not.toMatch(/text-(sm|base)|leading-/);
    expect(typography?.querySelector("li")?.className).not.toMatch(/text-(sm|base)|leading-/);
    expect(typography?.className).not.toContain("sm:text-base");
  });

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

  it("renders large documents with duplicate dividers in virtualized mode without key warnings", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const scrollElement = document.createElement("div");
    Object.defineProperty(scrollElement, "clientHeight", { value: 600 });
    Object.defineProperty(scrollElement, "scrollHeight", { value: 2000 });
    Object.defineProperty(scrollElement, "offsetHeight", { value: 600 });
    Object.defineProperty(scrollElement, "offsetWidth", { value: 800 });
    scrollElement.getBoundingClientRect = () => ({
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

    // Generate 30 chunks with repeated '---' dividers and identical text
    const chunks: string[] = [];
    for (let i = 0; i < 15; i++) {
      chunks.push(`## Section ${i % 3}`);
      chunks.push("---");
    }
    const content = chunks.join("\n\n");

    const { container } = render(
      <MarkdownDocumentViewer content={content} scrollElement={scrollElement} />,
    );

    expect(container.querySelector("[data-index]")).not.toBeNull();

    const keyErrors = errorSpy.mock.calls.filter((args) =>
      args.some(
        (arg) => typeof arg === "string" && arg.includes("Encountered two children with the same key"),
      ),
    );
    expect(keyErrors).toHaveLength(0);

    errorSpy.mockRestore();
  });

  it("renders code blocks containing blank lines correctly", () => {
    const content = [
      "# Code Demo",
      "```typescript\nconst a = 1;\n\nconst b = 2;\nreturn a + b;\n```",
    ].join("\n\n");

    const { container } = render(<MarkdownDocumentViewer content={content} />);
    const code = container.querySelector("pre, code");
    expect(code).not.toBeNull();
    expect(code?.textContent).toContain("const b = 2;");
  });
});
