import { describe, expect, it } from "vitest";
import { clampTitle, formatDisplayTitle, MAX_TITLE_LENGTH } from "./title";

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

describe("formatDisplayTitle", () => {
  it("keeps normal non-url titles unchanged", () => {
    expect(formatDisplayTitle("My Research Notebook")).toBe("My Research Notebook");
    expect(formatDisplayTitle("Short string")).toBe("Short string");
  });

  it("keeps short URLs unchanged", () => {
    expect(formatDisplayTitle("https://example.com/doc")).toBe("https://example.com/doc");
  });

  it("middle-truncates long URLs with host and trailing slug", () => {
    const longUrl =
      "https://example.com/workspaces/acme/projects/q3-launch/docs/9f8e7d6c5b4a?tab=comments";
    const formatted = formatDisplayTitle(longUrl);
    expect(formatted).toBe("example.com/.../9f8e7d6c5b4a");
  });
});
