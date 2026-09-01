import { describe, expect, it } from "vitest";
import type { CitedSourceDTO } from "../api/chat";
import { getReferenceLocatorLabel } from "./message-reference.types";

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
    [{ pageNumber: 2, imageRegion: { x: 0.1, y: 0.2, width: 0.5, height: 0.4 } }, "Page 2 · Visual region"],
  ])("formats %o as %s", (locator, expected) => {
    expect(getReferenceLocatorLabel({ ...baseReference, locator })).toBe(expected);
  });

  it("returns null when no supported locator is available", () => {
    expect(getReferenceLocatorLabel(baseReference)).toBeNull();
  });
});
