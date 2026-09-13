import { describe, expect, it } from "vitest";
import { clampTitle, MAX_TITLE_LENGTH } from "./title";

describe("clampTitle", () => {
  it("keeps titles at or under the limit", () => {
    expect(MAX_TITLE_LENGTH).toBe(50);
    expect(clampTitle("Reading List")).toBe("Reading List");
  });

  it("truncates to 50 characters", () => {
    expect(clampTitle("a".repeat(80))).toBe("a".repeat(50));
  });

  it("counts astral characters as single characters", () => {
    const clamped = clampTitle("😀".repeat(60));
    expect(Array.from(clamped)).toHaveLength(50);
    expect(clamped).toBe("😀".repeat(50));
  });
});
