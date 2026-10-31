import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioOverviewView } from "./AudioOverviewView";

vi.mock("./audio-overview/use-audio-timeline", () => ({ useAudioTimeline: () => null }));
vi.mock("@/shared/api", () => ({ getApiUrl: (path: string) => `http://local${path}` }));

describe("AudioOverviewView", () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps audio playback without source references, transcript, or regeneration controls", () => {
    render(
      <AudioOverviewView
        materialId="material-1"
        notebookId="notebook-1"
        content={{
          title: "Cellular respiration",
          transcript: "Cells release energy from glucose.",
          sections: [{ heading: "Opening", text: "Why cells need energy" }],
          metadata: { sourceIds: ["source-1"] },
        }}
      />,
    );
    expect(screen.getByLabelText("Audio player for Cellular respiration").getAttribute("src")).toBe(
      "http://local/api/study-materials/material-1/audio?v=",
    );
    expect(screen.getByRole("button", { name: "Play Cellular respiration" })).toBeTruthy();
    expect(screen.queryByText("1 source")).toBeNull();
    expect(screen.queryByText("Cells release energy from glucose.")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Opening" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Transcript" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Regenerate/ })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("preserves saved format and audience metadata", () => {
    render(
      <AudioOverviewView
        materialId="material-1"
        notebookId="notebook-1"
        content={{ title: "A topic" }}
        options={{ format: "deep_dive", audience: "advanced" }}
      />,
    );
    expect(screen.getByText("Deep dive · Advanced")).toBeTruthy();
  });
});
