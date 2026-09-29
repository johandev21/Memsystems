import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CitationReference } from "./citation";
import { CitationChipRow, CitationPopover } from "./citation-popover";

function reference(overrides: Partial<CitationReference> = {}): CitationReference {
  return {
    id: "source-1",
    citationKey: "R1",
    number: 1,
    title: "Internet Encyclopedia of Philosophy",
    kind: "url",
    url: "https://example.com/republic",
    description: null,
    quote: "Plato develops the account through the structure of the ideal city.",
    isAvailable: true,
    ...overrides,
  };
}

describe("CitationPopover", () => {
  it("shows the source title and supporting excerpt", async () => {
    const user = userEvent.setup();
    render(<CitationPopover reference={reference()} />);

    const trigger = screen.getByRole("button", {
      name: "Reference 1: Internet Encyclopedia of Philosophy",
    });
    expect(trigger.textContent).toBe("1");
    await user.click(trigger);

    expect(screen.getByText("Internet Encyclopedia of Philosophy")).toBeTruthy();
    expect(
      screen.getByText("Plato develops the account through the structure of the ideal city."),
    ).toBeTruthy();
    expect(screen.queryByText("Url")).toBeNull();
    expect(screen.getByRole("button", { name: /open source/i }).getAttribute("href")).toBe(
      "https://example.com/republic",
    );
  });

  it("renders remaining references as compact numbered triggers", () => {
    render(
      <CitationChipRow
        references={[
          reference(),
          reference({
            id: "source-2",
            citationKey: "R2",
            number: 12,
            title: "The Republic",
          }),
        ]}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Reference 1: Internet Encyclopedia of Philosophy",
      }).textContent,
    ).toBe("1");
    expect(screen.getByRole("button", { name: "Reference 12: The Republic" }).textContent).toBe(
      "12",
    );
  });

  it("keeps deleted or invalid references readable without an external action", async () => {
    const user = userEvent.setup();
    render(
      <CitationPopover
        reference={reference({
          isAvailable: false,
          url: "javascript:alert(1)",
          quote: null,
          description: null,
        })}
      />,
    );

    const trigger = screen.getByRole("button", {
      name: "Reference 1: Internet Encyclopedia of Philosophy",
    });
    await user.click(trigger);

    expect(screen.getByText("Source unavailable")).toBeTruthy();
    expect(screen.getByText("No excerpt is available for this reference.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /open source/i })).toBeNull();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(trigger.getAttribute("aria-expanded")).toBe("false"));
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("shows a useful locator while preserving the external source link", async () => {
    const user = userEvent.setup();
    render(
      <CitationPopover
        reference={reference({
          locator: {
            pageNumber: 4,
            lineStart: 10,
            lineEnd: 18,
          },
        })}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Reference 1: Internet Encyclopedia of Philosophy",
      }),
    );

    expect(screen.getByText("Page 4 · Lines 10–18")).toBeTruthy();
    expect(screen.getByRole("button", { name: /open source/i }).getAttribute("href")).toBe(
      "https://example.com/republic",
    );
  });

  it("opens the source viewer with the image region locator when opening a visual citation", async () => {
    const user = userEvent.setup();
    const eventListener = vi.fn();
    window.addEventListener("open-source-viewer", eventListener);

    render(
      <CitationPopover
        reference={reference({
          id: "source-img-123",
          kind: "file",
          url: null,
          title: "Neural Network Architecture.png",
          locator: {
            imageRegion: { x: 0.2, y: 0.3, width: 0.4, height: 0.5 },
          },
        })}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Reference 1: Neural Network Architecture.png",
      }),
    );

    expect(screen.getByText("Visual region")).toBeTruthy();

    const openBtn = screen.getByRole("button", { name: /open source/i });
    expect(openBtn.getAttribute("href")).toBeNull();

    await user.click(openBtn);

    expect(eventListener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: {
          sourceId: "source-img-123",
          locator: {
            imageRegion: { x: 0.2, y: 0.3, width: 0.4, height: 0.5 },
          },
        },
      }),
    );

    window.removeEventListener("open-source-viewer", eventListener);
  });

  it("opens the source viewer with video timestamp locator when opening a video citation", async () => {
    const user = userEvent.setup();
    const eventListener = vi.fn();
    window.addEventListener("open-source-viewer", eventListener);

    render(
      <CitationPopover
        reference={reference({
          id: "source-vid-456",
          kind: "file",
          url: null,
          title: "Lecture Recording.mp4",
          locator: {
            startOffsetMs: 45000,
            endOffsetMs: 60000,
          },
        })}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Reference 1: Lecture Recording.mp4",
      }),
    );

    const openBtn = screen.getByRole("button", { name: /open source/i });
    await user.click(openBtn);

    expect(eventListener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: {
          sourceId: "source-vid-456",
          locator: {
            startOffsetMs: 45000,
            endOffsetMs: 60000,
          },
        },
      }),
    );

    window.removeEventListener("open-source-viewer", eventListener);
  });

  it("opens the source viewer with slide number locator for slide citations", async () => {
    const user = userEvent.setup();
    const eventListener = vi.fn();
    window.addEventListener("open-source-viewer", eventListener);

    render(
      <CitationPopover
        reference={reference({
          id: "source-pptx-789",
          kind: "file",
          url: null,
          title: "Pitch Deck.pptx",
          locator: {
            slideNumber: 5,
          },
        })}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Reference 1: Pitch Deck.pptx",
      }),
    );

    const openBtn = screen.getByRole("button", { name: /open source/i });
    await user.click(openBtn);

    expect(eventListener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: {
          sourceId: "source-pptx-789",
          locator: {
            slideNumber: 5,
          },
        },
      }),
    );

    window.removeEventListener("open-source-viewer", eventListener);
  });

  it("opens the source viewer with symbol locator for Jupyter and Code citations", async () => {
    const user = userEvent.setup();
    const eventListener = vi.fn();
    window.addEventListener("open-source-viewer", eventListener);

    render(
      <CitationPopover
        reference={reference({
          id: "source-code-101",
          kind: "file",
          url: null,
          title: "algorithm.py",
          locator: {
            symbol: "def quicksort()",
            lineStart: 12,
            lineEnd: 24,
          },
        })}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Reference 1: algorithm.py",
      }),
    );

    const openBtn = screen.getByRole("button", { name: /open source/i });
    await user.click(openBtn);

    expect(eventListener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: {
          sourceId: "source-code-101",
          locator: {
            symbol: "def quicksort()",
            lineStart: 12,
            lineEnd: 24,
          },
        },
      }),
    );

    window.removeEventListener("open-source-viewer", eventListener);
  });
});
