import { describe, expect, it } from "vitest";
import {
  bannerDraftReducer,
  DEFAULT_FOCAL_POINT,
  type BannerDraftState,
} from "./notebook-banner-draft";

function draft(overrides: Partial<BannerDraftState> = {}): BannerDraftState {
  return {
    title: "Notebook",
    description: "",
    icon: "notebook",
    groundingMode: "strict",
    focalPoint: DEFAULT_FOCAL_POINT,
    previewUrl: null,
    bannerRemoved: false,
    imageError: false,
    ...overrides,
  };
}

describe("bannerDraftReducer grounding mode", () => {
  it("switches the mode without touching other fields", () => {
    const next = bannerDraftReducer(
      draft({ title: "Keep me" }),
      { type: "SET_GROUNDING_MODE", groundingMode: "free" },
    );

    expect(next.groundingMode).toBe("free");
    expect(next.title).toBe("Keep me");
  });

  it("resets back to the notebook mode", () => {
    const edited = bannerDraftReducer(draft(), {
      type: "SET_GROUNDING_MODE",
      groundingMode: "moderate",
    });
    expect(edited.groundingMode).toBe("moderate");

    const reset = bannerDraftReducer(edited, { type: "RESET", payload: draft() });
    expect(reset.groundingMode).toBe("strict");
  });
});
