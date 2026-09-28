import { describe, expect, it } from "vitest";
import {
  canSubmitBrief,
  DEFAULT_GROUNDING_MODE,
  isGroundingMode,
  resolveGroundingMode,
} from "./grounding-mode";

describe("resolveGroundingMode", () => {
  it("prefers the per-request override", () => {
    expect(resolveGroundingMode("free", "strict")).toBe("free");
  });

  it("falls back to the notebook value", () => {
    expect(resolveGroundingMode(undefined, "moderate")).toBe("moderate");
  });

  it("defaults to strict for missing or unknown values", () => {
    expect(resolveGroundingMode(undefined, undefined)).toBe("strict");
    expect(resolveGroundingMode(undefined, null)).toBe("strict");
    expect(resolveGroundingMode("turbo", "strict")).toBe("strict");
    expect(resolveGroundingMode(undefined, "turbo")).toBe("strict");
    expect(DEFAULT_GROUNDING_MODE).toBe("strict");
  });

  it("guards the mode union", () => {
    expect(isGroundingMode("strict")).toBe(true);
    expect(isGroundingMode("moderate")).toBe(true);
    expect(isGroundingMode("free")).toBe(true);
    expect(isGroundingMode("strict ")).toBe(false);
    expect(isGroundingMode(undefined)).toBe(false);
  });
});

describe("canSubmitBrief", () => {
  it("requires sources or instructions in strict and moderate", () => {
    for (const mode of ["strict", "moderate"] as const) {
      expect(canSubmitBrief(mode, false, false)).toBe(false);
      expect(canSubmitBrief(mode, true, false)).toBe(true);
      expect(canSubmitBrief(mode, false, true)).toBe(true);
      expect(canSubmitBrief(mode, true, true)).toBe(true);
    }
  });

  it("allows a fully empty brief-only request in free", () => {
    expect(canSubmitBrief("free", false, false)).toBe(true);
    expect(canSubmitBrief("free", true, false)).toBe(true);
  });

  it("never submits while disabled", () => {
    expect(canSubmitBrief("free", true, true, true)).toBe(false);
    expect(canSubmitBrief("strict", true, true, true)).toBe(false);
  });
});
