import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Source } from "../../api/sources";
import { getFaviconUrl, getSourceIcon } from "./source-icon-utils";
import { SourceFavicon, SourceIcon } from "./source-icon";

function createMockSource(overrides: Partial<Source> = {}): Source {
  return {
    id: "src-1",
    notebookId: "nb-1",
    kind: "url",
    title: "Example Website",
    url: "https://example.com/page",
    contentType: "text/html",
    fileSize: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("getFaviconUrl", () => {
  it("generates a Google favicon service URL for valid HTTP/HTTPS URLs", () => {
    expect(getFaviconUrl("https://example.com/articles/1")).toBe(
      "https://www.google.com/s2/favicons?domain=example.com&sz=32",
    );
    expect(getFaviconUrl("http://sub.domain.org/path")).toBe(
      "https://www.google.com/s2/favicons?domain=sub.domain.org&sz=32",
    );
    expect(getFaviconUrl("https://www.youtube.com/watch?v=abc")).toBe(
      "https://www.google.com/s2/favicons?domain=www.youtube.com&sz=32",
    );
  });

  it("supports custom icon sizes", () => {
    expect(getFaviconUrl("https://github.com", 64)).toBe(
      "https://www.google.com/s2/favicons?domain=github.com&sz=64",
    );
  });

  it("returns null for invalid, non-http, or empty URLs", () => {
    expect(getFaviconUrl(null)).toBeNull();
    expect(getFaviconUrl(undefined)).toBeNull();
    expect(getFaviconUrl("")).toBeNull();
    expect(getFaviconUrl("not-a-url")).toBeNull();
    expect(getFaviconUrl("javascript:alert(1)")).toBeNull();
    expect(getFaviconUrl("data:text/html,test")).toBeNull();
  });
});

describe("SourceFavicon", () => {
  it("renders an img tag with the favicon URL", () => {
    const { container } = render(
      <SourceFavicon
        url="https://news.ycombinator.com"
        title="Hacker News"
        fallback={<span data-testid="fallback">Fallback</span>}
      />,
    );

    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toBe(
      "https://www.google.com/s2/favicons?domain=news.ycombinator.com&sz=32",
    );
  });

  it("renders fallback when url is null or invalid", () => {
    const { container } = render(
      <SourceFavicon
        url=""
        fallback={<span data-testid="fallback">Fallback</span>}
      />,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByTestId("fallback")).toBeTruthy();
  });

  it("renders fallback on image load error", () => {
    const { container } = render(
      <SourceFavicon
        url="https://broken-website.invalid"
        fallback={<span data-testid="fallback">Fallback</span>}
      />,
    );

    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    fireEvent.error(img!);

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByTestId("fallback")).toBeTruthy();
  });
});

describe("SourceIcon", () => {
  it("renders favicon for a standard web URL source", () => {
    const source = createMockSource({
      kind: "url",
      url: "https://developer.mozilla.org/en-US/",
      title: "MDN Web Docs",
    });

    const { container } = render(<SourceIcon source={source} />);

    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toBe(
      "https://www.google.com/s2/favicons?domain=developer.mozilla.org&sz=32",
    );
  });

  it("renders YouTube favicon for YouTube URL source and falls back to Video icon on error", () => {
    const source = createMockSource({
      kind: "url",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      title: "YouTube Video",
    });

    const { container } = render(<SourceIcon source={source} />);

    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toBe(
      "https://www.google.com/s2/favicons?domain=www.youtube.com&sz=32",
    );

    // Trigger error to verify fallback
    fireEvent.error(img!);
    expect(container.querySelector("svg.lucide-video")).toBeTruthy();
  });

  it("falls back to Link2 icon on image error for standard web source", () => {
    const source = createMockSource({
      kind: "url",
      url: "https://example.org",
      title: "Example",
    });

    const { container } = render(<SourceIcon source={source} />);

    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    fireEvent.error(img!);
    expect(container.querySelector("svg.lucide-link-2")).toBeTruthy();
  });

  it("renders standard icons for file and non-url sources", () => {
    const fileSource = createMockSource({
      kind: "file",
      url: null,
      title: "notes.pdf",
      contentType: "application/pdf",
    });

    const { container: fileContainer } = render(<SourceIcon source={fileSource} />);
    expect(fileContainer.querySelector("img")).toBeNull();
    expect(fileContainer.querySelector("svg.lucide-file-text")).toBeTruthy();

    const audioSource = createMockSource({
      kind: "file",
      url: null,
      title: "recording.mp3",
      modality: "audio",
    });
    const { container: audioContainer } = render(<SourceIcon source={audioSource} />);
    expect(audioContainer.querySelector("svg.lucide-headphones")).toBeTruthy();
  });
});

describe("getSourceIcon", () => {
  it("returns fallback Lucide icons based on source modality or kind", () => {
    expect(getSourceIcon(createMockSource({ kind: "url", url: "https://example.com" }))).toBeDefined();
    expect(getSourceIcon(createMockSource({ kind: "file", title: "doc.pdf" }))).toBeDefined();
    expect(getSourceIcon(createMockSource({ modality: "slides", title: "deck.pptx" }))).toBeDefined();
  });
});
