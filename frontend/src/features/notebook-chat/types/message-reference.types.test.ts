import { describe, expect, it } from "vitest";
import type { CitedSourceDTO } from "../api/chat";
import { getReferenceLocatorLabel, prepareReferenceMessage } from "./message-reference.types";

const baseReference: CitedSourceDTO = {
  id: "source-1",
  schemaVersion: 2,
  citationKey: "R1",
  chunkId: "chunk-1",
  chunkIndex: 0,
  number: 1,
  title: "Source",
  kind: "file",
  url: null,
  description: null,
  quote: null,
  isAvailable: true,
};

describe("getReferenceLocatorLabel", () => {
  it.each([
    [{ pageNumber: 3 }, "Page 3"],
    [{ slideNumber: 8 }, "Slide 8"],
    [{ startOffsetMs: 65_000, endOffsetMs: 90_000 }, "1:05–1:30"],
    [{ startOffsetMs: 84_000 }, "1:24"],
    [{ startOffsetMs: 0 }, "0:00"],
    [{ startOffsetMs: 3665_000, endOffsetMs: 3720_000 }, "1:01:05–1:02:00"],
    [{ sheetName: "Budget", cellRange: "B2:D9" }, 'Sheet "Budget" · B2:D9'],
    [{ symbol: "calculateTotal", lineStart: 12, lineEnd: 21 }, "calculateTotal · Lines 12–21"],
    [{ imageRegion: { x: 0.1, y: 0.2, width: 0.5, height: 0.4 } }, "Visual region"],
    [
      { pageNumber: 2, imageRegion: { x: 0.1, y: 0.2, width: 0.5, height: 0.4 } },
      "Page 2 · Visual region",
    ],
  ])("formats %o as %s", (locator, expected) => {
    expect(getReferenceLocatorLabel({ ...baseReference, locator })).toBe(expected);
  });

  it("returns null when no supported locator is available", () => {
    expect(getReferenceLocatorLabel(baseReference)).toBeNull();
  });
});

describe("prepareReferenceMessage", () => {
  it("renders a completed reference marker with its display number", () => {
    const result = prepareReferenceMessage(
      "Justice is developed through the city. [ref:r1]",
      [{ ...baseReference, number: 12, title: "A very long source title" }],
      false,
    );

    expect(result.markdown).toBe("Justice is developed through the city. [12](#reference-R1)");
    expect(result.inlineCitationKeys).toEqual(new Set(["R1"]));
  });

  it("converts legacy title citations to numbered reference links", () => {
    const legacyReference = {
      ...baseReference,
      schemaVersion: 0,
      citationKey: "legacy-1",
      title: "A very long source title",
    };

    const result = prepareReferenceMessage(
      "Justice is discussed in (A very long source title).",
      [legacyReference],
      false,
    );

    expect(result.markdown).toBe("Justice is discussed in [1](#reference-legacy-1).");
    expect(result.inlineCitationKeys).toEqual(new Set(["legacy-1"]));
  });

  it("removes unknown and incomplete markers without exposing citation syntax", () => {
    expect(prepareReferenceMessage("Answer [ref:missing]", [baseReference], false).markdown).toBe(
      "Answer ",
    );
    expect(prepareReferenceMessage("Answer [ref:R", [baseReference], true).markdown).toBe("Answer");
  });

  it("unwraps backticked markers and renormalizes invented link numbers", () => {
    const refs = [
      { ...baseReference, citationKey: "R2", number: 2 },
      { ...baseReference, citationKey: "R3", number: 4, id: "source-3" },
    ];
    expect(prepareReferenceMessage("Claim `[ref:R3]`.", refs, false).markdown).toBe(
      "Claim [4](#reference-R3).",
    );
    expect(prepareReferenceMessage("Claim [9](#reference-R3).", refs, false).markdown).toBe(
      "Claim [4](#reference-R3).",
    );
    expect(
      prepareReferenceMessage("A [2](#reference-R2)[5](#reference-R7).", refs, false).markdown,
    ).toBe("A [2](#reference-R2)5.");
  });

  it("unwraps citation clusters sharing one code span and spaces adjacent links", () => {
    const refs = [
      { ...baseReference, citationKey: "R2", number: 2 },
      { ...baseReference, citationKey: "R7", number: 5, id: "source-7" },
    ];
    expect(prepareReferenceMessage("Vitality `[ref:R2][ref:R7]`.", refs, false).markdown).toBe(
      "Vitality [2](#reference-R2) [5](#reference-R7).",
    );
    expect(prepareReferenceMessage("Vitality [ref:R2][ref:R7].", refs, false).markdown).toBe(
      "Vitality [2](#reference-R2) [5](#reference-R7).",
    );
    expect(
      prepareReferenceMessage("Vitality `[2](#reference-R2)[9](#reference-R7)`.", refs, false)
        .markdown,
    ).toBe("Vitality [2](#reference-R2) [5](#reference-R7).");
  });

  it("leaves genuine code alone while matching case-insensitive markers", () => {
    const refs = [{ ...baseReference, citationKey: "R1", number: 1 }];
    expect(prepareReferenceMessage("Run `[REF:R1]`.", refs, false).markdown).toBe(
      "Run [1](#reference-R1).",
    );
    expect(prepareReferenceMessage("Run `array[0]`.", refs, false).markdown).toBe(
      "Run `array[0]`.",
    );
  });

  it("leaves real code blocks untouched while stripping link syntax when streaming", () => {
    const refs = [{ ...baseReference, citationKey: "R1", number: 1 }];
    expect(prepareReferenceMessage("```\n[ref:R1]\n```", refs, false).markdown).toBe(
      "```\n[ref:R1]\n```",
    );
    expect(prepareReferenceMessage("Claim `const x = 1`.", refs, false).markdown).toBe(
      "Claim `const x = 1`.",
    );
    expect(prepareReferenceMessage("Vitality [2](#reference-R2).", refs, true).markdown).toBe(
      "Vitality.",
    );
  });
});
