import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Source } from "../../api/sources";
import { getFaviconUrl } from "./source-icon-utils";
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
  it.each([
    createMockSource({ kind: "url", url: "https://example.com" }),
    createMockSource({ kind: "url", url: "https://youtube.com/watch?v=abc" }),
    createMockSource({ kind: "file", title: "notes.pdf", modality: "document" }),
    createMockSource({ kind: "file", title: "recording.mp3", modality: "audio" }),
    createMockSource({ kind: "file", title: "photo.png", modality: "image" }),
  ])("renders the Markdown identity glyph for every source", (source) => {
    const { container } = render(<SourceIcon source={source} className="size-5 text-muted-foreground" />);
    const svg = container.querySelector("svg");

    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg?.getAttribute("fill")).toBe("currentColor");
    expect(svg?.getAttribute("stroke")).toBe("none");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("focusable")).toBe("false");
    expect(svg?.classList.contains("size-5")).toBe(true);
    expect(svg?.classList.contains("text-muted-foreground")).toBe(true);
    expect(svg?.querySelector("path")?.getAttribute("d")).toBe(
      "M22.27 19.385H1.73A1.73 1.73 0 010 17.655V6.345a1.73 1.73 0 011.73-1.73h20.54A1.73 1.73 0 0124 6.345v11.308a1.73 1.73 0 01-1.73 1.731zM5.769 15.923v-4.5l2.308 2.885 2.307-2.885v4.5h2.308V8.078h-2.308l-2.307 2.885-2.308-2.885H3.46v7.847zM21.232 12h-2.309V8.077h-2.307V12h-2.308l3.461 4.039z",
    );
    expect(container.querySelector("img")).toBeNull();
  });
});
