import { describe, expect, it } from "vitest";
import type { CitedSourceDTO } from "@/shared/api";
import {
  getReferenceExcerpt,
  getReferenceKeyFromHref,
  getSafeReferenceUrl,
  prepareReferenceMessage,
} from "./message-reference";

function reference(overrides: Partial<CitedSourceDTO> = {}): CitedSourceDTO {
  return {
    id: "source-1",
    schemaVersion: 1,
    citationKey: "R1",
    chunkId: "chunk-1",
    chunkIndex: 0,
    number: 1,
    title: "The Republic [Overview]",
    kind: "url",
    url: "https://example.com/republic",
    description: null,
    quote: "A short supporting passage.",
    isAvailable: true,
    ...overrides,
  };
}

describe("message reference mapping", () => {
  it("turns valid markers into internal markdown links and preserves response order", () => {
    const result = prepareReferenceMessage("A grounded claim. [ref:R1]", [reference()], false);

    expect(result.markdown).toBe(
      "A grounded claim. [(The Republic \\[Overview\\])](#reference-R1)",
    );
    expect([...result.inlineCitationKeys]).toEqual(["R1"]);
    expect(getReferenceKeyFromHref("#reference-R1")).toBe("R1");
  });

  it("removes unknown markers instead of creating unsafe links", () => {
    const result = prepareReferenceMessage("Unsupported. [ref:R99]", [reference()], false);

    expect(result.markdown).toBe("Unsupported. ");
    expect(result.inlineCitationKeys.size).toBe(0);
  });

  it("turns legacy parenthesized source titles into the same inline reference link", () => {
    const result = prepareReferenceMessage(
      "A legacy claim. (The Republic)",
      [
        reference({
          schemaVersion: 0,
          citationKey: "legacy-1",
          title: "The Republic",
        }),
      ],
      false,
    );

    expect(result.markdown).toBe("A legacy claim. [(The Republic)](#reference-legacy-1)");
    expect([...result.inlineCitationKeys]).toEqual(["legacy-1"]);
  });

  it("hides complete and incomplete markers while streaming", () => {
    expect(
      prepareReferenceMessage("First. [ref:R1] Second. [ref:R", [reference()], true).markdown,
    ).toBe("First. Second.");
  });

  it("uses excerpt fallbacks and validates source URLs", () => {
    expect(getReferenceExcerpt(reference({ quote: null, description: "Source summary" }))).toBe(
      "Source summary",
    );
    expect(getReferenceExcerpt(reference({ quote: null, description: null }))).toBe(
      "No excerpt is available for this reference.",
    );
    expect(getSafeReferenceUrl("javascript:alert(1)")).toBeNull();
    expect(getSafeReferenceUrl("https://example.com/source")).toBe("https://example.com/source");
  });
});
