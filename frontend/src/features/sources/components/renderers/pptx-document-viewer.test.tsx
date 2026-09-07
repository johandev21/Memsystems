import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SourceWithContent } from "../../types";
import { PptxDocumentViewer } from "./pptx-document-viewer";

const mockPptxSource: SourceWithContent = {
  id: "pptx-1",
  notebookId: "nb-1",
  kind: "file",
  modality: "slides",
  title: "Lecture Deck.pptx",
  url: null,
  contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  fileSize: 1024 * 1024 * 5,
  createdAt: "2026-08-30T12:00:00.000Z",
  rawText: "Slide 1 content\n\nSlide 2 content\n\nSlide 3 content",
  s3Key: "uploads/pptx",
  sha256: "pptxsha",
  segments: [
    {
      id: "seg-1",
      ordinal: 1,
      kind: "heading",
      content: "Introduction to Systems",
      locator: { slideNumber: 1 },
    },
    {
      id: "seg-2",
      ordinal: 2,
      kind: "text",
      content: "Overview of memory systems and architecture",
      locator: { slideNumber: 1 },
    },
    {
      id: "seg-3",
      ordinal: 3,
      kind: "text",
      content: "Deep dive into caching strategies",
      locator: { slideNumber: 2 },
    },
    {
      id: "seg-4",
      ordinal: 4,
      kind: "text",
      content: "Conclusion and next steps",
      locator: { slideNumber: 3 },
    },
  ],
};

describe("PptxDocumentViewer", () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => vi.restoreAllMocks());

  it("renders slide count badge and header", () => {
    render(<PptxDocumentViewer source={mockPptxSource} />);
    expect(screen.getByText("Presentation")).toBeTruthy();
    expect(screen.getByText("3 slides")).toBeTruthy();
    expect(screen.getByText("Lecture Deck.pptx")).toBeTruthy();
  });

  it("renders slide navigator items with slide numbers", () => {
    render(<PptxDocumentViewer source={mockPptxSource} />);
    const navItems = screen.getAllByTestId("slide-nav-item");
    expect(navItems.length).toBe(3);
    expect(navItems[0].textContent).toContain("1");
    expect(navItems[1].textContent).toContain("2");
    expect(navItems[2].textContent).toContain("3");
  });

  it("shows current slide content with slideNumber badges", () => {
    render(<PptxDocumentViewer source={mockPptxSource} />);
    expect(screen.getByTestId("slide-content")).toBeTruthy();
    expect(screen.getByText("Slide 1")).toBeTruthy();
    // Slide 1 segments visible by default
    expect(screen.getByText("Introduction to Systems")).toBeTruthy();
    expect(screen.getByText("Overview of memory systems and architecture")).toBeTruthy();
  });

  it("clicking segment jumps to that slideNumber", async () => {
    const user = userEvent.setup();
    render(<PptxDocumentViewer source={mockPptxSource} />);
    // Click segment for slide 2 in right panel
    const segmentItems = screen.getAllByTestId("pptx-segment-item");
    // Find slide 2 segment
    const slide2Item = segmentItems.find((el) => el.textContent?.includes("Slide 2"));
    expect(slide2Item).toBeTruthy();
    await user.click(slide2Item!);
    // After click, slide 2 content should be visible
    expect(screen.getByText("Deep dive into caching strategies")).toBeTruthy();
  });

  it("citation jump via selectedLocator.slideNumber auto-selects slide", () => {
    render(<PptxDocumentViewer source={mockPptxSource} selectedLocator={{ slideNumber: 3 }} />);
    expect(screen.getByText("Conclusion and next steps")).toBeTruthy();
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("search filter highlights matching text with <mark>", async () => {
    const user = userEvent.setup();
    render(<PptxDocumentViewer source={mockPptxSource} />);
    // Need to navigate to slide that contains searchable term or search across all segments
    // Search in pptx viewer filters segments list and current slide; test highlight
    const input = screen.getByTestId("pptx-search-input");
    await user.type(input, "caching");
    // Right panel filtered should show matching segment with mark
    const marks = document.querySelectorAll("mark");
    expect(marks.length).toBeGreaterThan(0);
    expect(marks[0].textContent?.toLowerCase()).toBe("caching");
    // Current slide after filtering may show no blocks if active slide doesn't match
    // Switch to slide 2 which contains caching
    const navItems = screen.getAllByTestId("slide-nav-item");
    await user.click(navItems[1]);
    const deep = screen.getByText(
      (_content, el) =>
        el?.textContent === "Deep dive into caching strategies" &&
        !!el?.className.includes("whitespace-pre-wrap"),
    );
    expect(deep.parentElement?.innerHTML).toContain("<mark");
  });

  it("search filters segment list", async () => {
    const user = userEvent.setup();
    render(<PptxDocumentViewer source={mockPptxSource} />);
    const input = screen.getByTestId("pptx-search-input");
    await user.type(input, "Overview");
    const items = screen.getAllByTestId("pptx-segment-item");
    expect(items.length).toBe(1);
    expect(items[0].textContent).toContain("Overview");
  });

  it("renders empty state when no slides", () => {
    const emptySource: SourceWithContent = { ...mockPptxSource, segments: [], rawText: "" };
    render(<PptxDocumentViewer source={emptySource} />);
    expect(screen.getByText("No slides extracted")).toBeTruthy();
  });

  it("preserves text whitespace and renders heading distinct", () => {
    render(<PptxDocumentViewer source={mockPptxSource} />);
    const heading = screen.getByText("Introduction to Systems");
    expect(heading.tagName).toBe("H3");
    // Text content should be visible
    expect(screen.getByText("Overview of memory systems and architecture")).toBeTruthy();
  });

  it("renders slideNumber badges [Slide N] per segment", () => {
    render(<PptxDocumentViewer source={mockPptxSource} />);
    const badges = screen.getAllByText("Slide 1");
    expect(badges.length).toBeGreaterThan(0);
  });

  it("clicking slide navigator changes active slide", async () => {
    const user = userEvent.setup();
    render(<PptxDocumentViewer source={mockPptxSource} />);
    const navItems = screen.getAllByTestId("slide-nav-item");
    await user.click(navItems[2]);
    expect(screen.getByText("Conclusion and next steps")).toBeTruthy();
  });
});
