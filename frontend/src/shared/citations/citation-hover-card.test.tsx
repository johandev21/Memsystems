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

    // Asserts passage text is present uniformly without mark tag / highlight background
    expect(screen.getByText(/Demonstrations depend on necessary premises\./)).toBeTruthy();
    expect(document.querySelector("mark")).toBeNull();

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

  it("handles smooth clustered hover transitions between adjacent citation badges", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <CitationHoverCard reference={sampleReference({ id: "source-1", number: 1, title: "Source One" })} />
        <CitationHoverCard reference={sampleReference({ id: "source-2", number: 2, title: "Source Two" })} />
      </div>,
    );

    const trigger1 = screen.getByRole("button", { name: "Reference 1: Source One" });
    const trigger2 = screen.getByRole("button", { name: "Reference 2: Source Two" });

    // Hover first citation badge
    await user.hover(trigger1);
    await waitFor(() => {
      expect(screen.getByText("Source One")).toBeTruthy();
    });

    // Hover second citation badge in cluster
    await user.hover(trigger2);
    await waitFor(() => {
      expect(screen.getByText("Source Two")).toBeTruthy();
    });
  });

  it("opens an accessible Bottom Sheet / Drawer on mobile touch devices (pointer: coarse)", async () => {
    const user = userEvent.setup();
    render(<CitationHoverCard reference={sampleReference()} forceDrawer />);

    const trigger = screen.getByRole("button", {
      name: "Reference 1: Stanford Encyclopedia of Philosophy",
    });

    // On touch device, tapping trigger opens Drawer
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByTestId("citation-breadcrumbs")).toBeTruthy();
    });

    const bottomSheet = screen.getByTestId("citation-breadcrumbs").closest("[data-slot='citation-bottom-sheet']");
    expect(bottomSheet).toBeTruthy();
    expect(screen.getAllByText("Stanford Encyclopedia of Philosophy").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Aristotle > Logic > Demonstrations")).toBeTruthy();
    expect(screen.getAllByText("Demonstrations depend on necessary premises.").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /copy quote/i })).toBeTruthy();
  });

  it("smooths broken newlines, strips backslash escapes, and cleans breadcrumbs", async () => {
    const user = userEvent.setup();
    render(
      <CitationHoverCard
        reference={sampleReference({
          sectionPath: ["Plato", "5\\. Plato's indirectness"],
          quote: "above, the authenticity of\nPlato's letters is a matter of great controversy; and in any",
          context:
            "above, the authenticity of\nPlato's letters is a matter of great controversy; and in any\ncase, the author of the seventh letter declares his opposition to\nthe\nwriting of philosophical books.\n\nWhether Plato wrote it or not, it\ncannot be regarded as a philosophical treatise.\n\n\\ In all of his writings",
        })}
      />,
    );

    const trigger = screen.getByRole("button", {
      name: "Reference 1: Stanford Encyclopedia of Philosophy",
    });
    await user.hover(trigger);

    await waitFor(() => {
      expect(screen.getByTestId("citation-breadcrumbs")).toBeTruthy();
    });

    // Unescapes backslash in breadcrumb
    expect(screen.getByTestId("citation-breadcrumbs").textContent).toBe(
      "Plato > 5. Plato's indirectness",
    );

    // Text is smoothed into continuous prose without mark tag / highlight background
    expect(
      screen.getByText(/above, the authenticity of Plato's letters is a matter of great controversy; and in any/),
    ).toBeTruthy();
    expect(document.querySelector("mark")).toBeNull();

    // Context is smoothed into continuous prose without hard newlines
    const evidence = screen.getByTestId("citation-breadcrumbs")
      .closest("[data-slot='hover-card-content']")
      ?.querySelector("[data-slot='citation-evidence']");
    expect(evidence).toBeTruthy();
    expect(evidence?.textContent).toContain(
      "opposition to the writing of philosophical books.",
    );
    expect(evidence?.textContent).toContain(
      "Whether Plato wrote it or not, it cannot be regarded as a philosophical treatise.",
    );
    expect(evidence?.textContent).toContain("In all of his writings");
    expect(evidence?.textContent).not.toContain("\\");
  });

  it("renders markdown formatting like italics for markdown sources and cleans breadcrumbs", async () => {
    const user = userEvent.setup();
    render(
      <CitationHoverCard
        reference={sampleReference({
          kind: "url",
          sectionPath: ["Plato", "5\\. Plato's indirectness"],
          context:
            "Why, after all, did Plato write so many works (for example: _Phaedo_, _Symposium_, _Republic_) in which one character dominates?",
        })}
      />,
    );

    const trigger = screen.getByRole("button", {
      name: "Reference 1: Stanford Encyclopedia of Philosophy",
    });
    await user.hover(trigger);

    await waitFor(() => {
      expect(screen.getByTestId("citation-breadcrumbs")).toBeTruthy();
    });

    // Asserts unescaped breadcrumbs
    expect(screen.getByTestId("citation-breadcrumbs").textContent).toBe(
      "Plato > 5. Plato's indirectness",
    );

    // Asserts italics for _Phaedo_ (rendered as <em>Phaedo</em>)
    const emPhaedo = screen.getByText("Phaedo");
    expect(emPhaedo.tagName.toLowerCase()).toBe("em");
    const emSymposium = screen.getByText("Symposium");
    expect(emSymposium.tagName.toLowerCase()).toBe("em");

    // Asserts no highlight background or mark tag
    expect(document.querySelector("mark")).toBeNull();
  });
});


