import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { CitationReference } from "./citation";
import {
  CitationChipRow,
  CitationHoverCard,
} from "./citation-hover-card";

function sampleReference(overrides: Partial<CitationReference> = {}): CitationReference {
  return {
    id: "source-1",
    citationKey: "R1",
    number: 1,
    title: "Stanford Encyclopedia of Philosophy",
    kind: "url",
    url: "https://example.com/aristotle-logic#:~:text=Demonstrations%20depend%20on",
    description: null,
    quote: "Demonstrations depend on necessary premises.",
    context:
      "Logic begins with primary principles. Demonstrations depend on necessary premises. If the premises are true and primary, a scientific conclusion follows.",
    sectionPath: ["Aristotle", "Logic", "Demonstrations"],
    locator: { pageNumber: 42 },
    isAvailable: true,
    ...overrides,
  };
}

describe("CitationHoverCard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders trigger badge with reference number", () => {
    render(<CitationHoverCard reference={sampleReference()} />);
    const trigger = screen.getByRole("button", {
      name: "Reference 1: Stanford Encyclopedia of Philosophy",
    });
    expect(trigger.textContent).toBe("1");
  });

  it("reveals HoverCard with breadcrumbs, locator, and highlighted quote on hover", async () => {
    const user = userEvent.setup();
    render(<CitationHoverCard reference={sampleReference()} />);

    const trigger = screen.getByRole("button", {
      name: "Reference 1: Stanford Encyclopedia of Philosophy",
    });
    await user.hover(trigger);

    // Waits for hover delay and asserts content appears
    await waitFor(() => {
      expect(screen.getByText("Stanford Encyclopedia of Philosophy")).toBeTruthy();
    });

    // Asserts section breadcrumbs
    const breadcrumbs = screen.getByTestId("citation-breadcrumbs");
    expect(breadcrumbs.textContent).toBe("Aristotle > Logic > Demonstrations");

    // Asserts locator badge
    expect(screen.getByText("Page 42")).toBeTruthy();

    // Asserts highlighted focal quote inside mark
    const mark = screen.getByText("Demonstrations depend on necessary premises.");
    expect(mark.tagName.toLowerCase()).toBe("mark");

    // Asserts surrounding context is present
    expect(screen.getByText(/Logic begins with primary principles/)).toBeTruthy();
  });

  it("copies quote to clipboard when 'Copy Quote' button is clicked", async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    render(<CitationHoverCard reference={sampleReference()} />);

    const trigger = screen.getByRole("button", {
      name: "Reference 1: Stanford Encyclopedia of Philosophy",
    });
    await user.hover(trigger);

    const copyBtn = await screen.findByRole("button", { name: /copy quote/i });
    await user.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith(
      "Demonstrations depend on necessary premises.",
    );
    expect(await screen.findByText(/quote copied!/i)).toBeTruthy();
  });

  it("dispatches 'open-source-viewer' event with locator on clicking 'Open source'", async () => {
    const user = userEvent.setup();
    const listener = vi.fn();
    window.addEventListener("open-source-viewer", listener);

    render(
      <CitationHoverCard
        reference={sampleReference({
          url: null,
          locator: { pageNumber: 42, slideNumber: 3 },
        })}
      />,
    );

    const trigger = screen.getByRole("button", {
      name: "Reference 1: Stanford Encyclopedia of Philosophy",
    });
    await user.hover(trigger);

    const openSourceBtn = await screen.findByRole("button", { name: "Open source" });
    await user.click(openSourceBtn);

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: {
          sourceId: "source-1",
          locator: { pageNumber: 42, slideNumber: 3 },
        },
      }),
    );

    window.removeEventListener("open-source-viewer", listener);
  });

  it("renders external link with text fragment for URL sources", async () => {
    const user = userEvent.setup();
    render(<CitationHoverCard reference={sampleReference()} />);

    const trigger = screen.getByRole("button", {
      name: "Reference 1: Stanford Encyclopedia of Philosophy",
    });
    await user.hover(trigger);

    const externalLink = await screen.findByRole("button", { name: /open external source/i });
    expect(externalLink.getAttribute("href")).toBe(
      "https://example.com/aristotle-logic#:~:text=Demonstrations%20depend%20on",
    );
    expect(externalLink.getAttribute("target")).toBe("_blank");
  });

  it("gracefully degrades for legacy citations lacking sectionPath or context", async () => {
    const user = userEvent.setup();
    render(
      <CitationHoverCard
        reference={sampleReference({
          sectionPath: null,
          context: null,
          quote: "Legacy short quote.",
          locator: null,
          isAvailable: false,
        })}
      />,
    );

    const trigger = screen.getByRole("button", {
      name: "Reference 1: Stanford Encyclopedia of Philosophy",
    });
    await user.hover(trigger);

    await waitFor(() => {
      expect(screen.getByText("Stanford Encyclopedia of Philosophy")).toBeTruthy();
    });

    expect(screen.queryByTestId("citation-breadcrumbs")).toBeNull();
    expect(screen.getByText("Source unavailable")).toBeTruthy();
    expect(screen.getByText("Legacy short quote.")).toBeTruthy();
  });

  it("renders a row of hover card triggers via CitationChipRow", () => {
    render(
      <CitationChipRow
        references={[
          sampleReference(),
          sampleReference({
            id: "source-2",
            citationKey: "R2",
            number: 2,
            title: "Physics",
          }),
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: /Reference 1:/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Reference 2:/i })).toBeTruthy();
  });
});
