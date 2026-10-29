import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { AudioOverviewView } from "./AudioOverviewView";

const { startGenerationMock } = vi.hoisted(() => ({
  startGenerationMock: vi.fn(),
}));

vi.mock("@/features/study-material-generation/api/generation", () => ({
  startGeneration: startGenerationMock,
  cancelGeneration: vi.fn(),
}));

vi.mock("@/shared/api", () => ({
  getApiUrl: (path: string) => `http://local${path}`,
}));
vi.mock("@/features/notebook-chat/citations/citation-hover-card", () => ({
  CitationChipRow: ({ references }: { references: unknown[] }) => (
    <div data-testid="citations">{references.length} citations</div>
  ),
}));

describe("AudioOverviewView", () => {
  const renderView = (
    content: Parameters<typeof AudioOverviewView>[0]["content"],
    options?: unknown,
  ) =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AudioOverviewView
          materialId="material-1"
          notebookId="notebook-1"
          content={content}
          options={options}
        />
      </QueryClientProvider>,
    );
  const legacyContent = {
    title: "Cellular respiration",
    transcript: "Cells release energy from glucose. [ref:R1]",
    citations: [
      { sourceId: "source-1", sourceTitle: "Biology notes" },
    ] as never[],
  };

  it("provides a playable legacy transcript without rendering citations", () => {
    renderView(legacyContent);

    const player = screen.getByLabelText(
      "Audio player for Cellular respiration",
    ) as HTMLAudioElement;
    expect(player.tagName).toBe("AUDIO");
    expect(player.controls).toBe(true);
    expect(player.getAttribute("src")).toBe(
      "http://local/api/study-materials/material-1/audio?v=",
    );
    expect(screen.getByRole("heading", { name: "Transcript" })).toBeTruthy();
    expect(screen.getByText(legacyContent.transcript)).toBeTruthy();
    expect(screen.queryByTestId("citations")).toBeNull();
  });

  it("renders structured transcript sections without exposing citation metadata", () => {
    renderView({
      title: "Cellular respiration",
      sections: [
        {
          heading: "Opening",
          text: "Why cells need energy",
          citations: [{ sourceId: "source-1" }],
        },
        { heading: "How it works", text: "Cells break down glucose" },
      ],
      metadata: { sourceIds: ["source-1"] },
    });

    expect(screen.getByRole("heading", { name: "Opening" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Overview" })).toBeTruthy();
    expect(
      screen.getAllByRole("listitem").map((item) => item.textContent),
    ).toEqual(["Opening", "How it works"]);
    expect(screen.getByText("Cells break down glucose")).toBeTruthy();
    expect(screen.queryByTestId("citations")).toBeNull();
  });

  it("announces playback failure and clears it when playback becomes available", () => {
    renderView(legacyContent);
    const player = screen.getByLabelText(
      "Audio player for Cellular respiration",
    );

    fireEvent.error(player);
    expect(screen.getByRole("alert").textContent).toBe(
      "Audio playback failed. Try again or regenerate this overview.",
    );

    fireEvent.canPlay(player);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("regenerates from source IDs and settings stored in material options", async () => {
    startGenerationMock.mockReturnValue({
      requestIdPromise: Promise.resolve("request-1"),
      stream: (async function* () {
        yield {
          type: "done",
          requestId: "request-1",
          materialId: "material-1",
        };
      })(),
      abort: vi.fn(),
    });
    renderView(legacyContent, {
      kind: "audio_overview",
      sourceIds: ["source-1"],
      format: "deep_dive",
      length: "extended",
      audience: "advanced",
      brief: "Focus on the link between glycolysis and ATP production.",
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Regenerate overview" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Regenerate overview" }),
    );

    await waitFor(() =>
      expect(startGenerationMock).toHaveBeenCalledWith(
        "notebook-1",
        expect.objectContaining({
          sourceIds: ["source-1"],
          brief: "Focus on the link between glycolysis and ATP production.",
          audioOverviewOptions: {
            format: "deep_dive",
            length: "extended",
            audience: "advanced",
          },
          replaceMaterialId: "material-1",
        }),
      ),
    );
  });
});
