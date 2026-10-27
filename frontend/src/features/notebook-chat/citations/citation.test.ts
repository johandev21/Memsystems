import { describe, expect, it } from "vitest";
import {
  stripCitationMarkers,
  stripCitationMarkersFromContent,
  readMaterialCitations,
} from "./citation";

describe("stripCitationMarkers", () => {
  it("removes [ref:Rn] citation markers from text", () => {
    expect(stripCitationMarkers("Mitochondria generate energy [ref:R1].")).toBe(
      "Mitochondria generate energy.",
    );
  });

  it("removes markdown-style link reference markers", () => {
    expect(stripCitationMarkers("Osmosis moves water [1](#reference-R2).")).toBe(
      "Osmosis moves water.",
    );
  });
});

describe("stripCitationMarkersFromContent", () => {
  it("strips citation markers recursively from strings, arrays, and objects", () => {
    const input = {
      title: "Cell Biology [ref:R1].",
      explanation: "Mitochondria generate energy [ref:R1].",
      bullets: ["Osmosis moves water [1](#reference-R2).", "Diffusion moves solutes [ref:R3]."],
      nested: {
        detail: "Deeply nested fact [ref:R4].",
      },
    };

    expect(stripCitationMarkersFromContent(input)).toEqual({
      title: "Cell Biology.",
      explanation: "Mitochondria generate energy.",
      bullets: ["Osmosis moves water.", "Diffusion moves solutes."],
      nested: {
        detail: "Deeply nested fact.",
      },
    });
  });

  it("leaves non-string primitive values untouched", () => {
    expect(stripCitationMarkersFromContent(42)).toBe(42);
    expect(stripCitationMarkersFromContent(true)).toBe(true);
    expect(stripCitationMarkersFromContent(null)).toBe(null);
  });
});

describe("readMaterialCitations", () => {
  it("reads citations array from content object", () => {
    const content = {
      citations: [
        {
          citationKey: "R1",
          sourceId: "src-1",
          chunkId: "chk-1",
          quote: "A quoted fact.",
        },
      ],
    };

    const citations = readMaterialCitations(content);
    expect(citations).toHaveLength(1);
    expect(citations[0].citationKey).toBe("R1");
    expect(citations[0].quote).toBe("A quoted fact.");
  });

  it("returns empty array when content has no citations", () => {
    expect(readMaterialCitations({})).toEqual([]);
    expect(readMaterialCitations(null)).toEqual([]);
  });
});
