import { describe, expect, it } from "vitest";
import { parseLibrarySearch } from "./search-params";

describe("parseLibrarySearch", () => {
  it("parses empty search params with defaults", () => {
    const result = parseLibrarySearch({});
    expect(result.folderId).toBeUndefined();
    expect(result.sort).toBeUndefined();
  });

  it("extracts valid folderId and sort", () => {
    const result = parseLibrarySearch({
      folderId: "folder-123",
      sort: "updatedAt",
    });
    expect(result.folderId).toBe("folder-123");
    expect(result.sort).toBe("updatedAt");
  });

  it("normalizes empty or whitespace folderId to undefined", () => {
    const resultEmpty = parseLibrarySearch({ folderId: "" });
    expect(resultEmpty.folderId).toBeUndefined();

    const resultWhitespace = parseLibrarySearch({ folderId: "   " });
    expect(resultWhitespace.folderId).toBeUndefined();
  });

  it("falls back to undefined when sort is invalid", () => {
    const result = parseLibrarySearch({ sort: "invalid-sort-order" });
    expect(result.sort).toBeUndefined();
  });
});
