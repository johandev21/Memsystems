import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { BriefFormData } from "./types";
import { AudioOverviewBriefForm } from "./AudioOverviewBriefForm";

vi.mock("@/features/notebooks", () => ({
  canSubmitBrief: (_mode: string, hasSources: boolean, hasBrief: boolean, disabled: boolean) =>
    !disabled && (hasSources || hasBrief),
  useNotebookGroundingMode: () => "free",
}));
vi.mock("@/features/sources", () => ({
  sourcesQueryOptions: () => ({
    queryKey: ["sources", "notebook-1"],
    queryFn: async () => [{ id: "source-1", title: "Biology notes", kind: "document" }],
  }),
}));
vi.mock("./generation-source-popover", () => ({
  GenerationSourcePopover: ({
    selectedIds,
    onChange,
  }: {
    selectedIds: string[];
    onChange: (ids: string[]) => void;
  }) => (
    <button
      type="button"
      aria-pressed={selectedIds.length > 0}
      onClick={() => onChange(selectedIds.length ? [] : ["source-1"])}
    >
      Select source
    </button>
  ),
}));

function FormHarness({ onSubmit = vi.fn() }: { onSubmit?: (value: BriefFormData) => void }) {
  const [value, setValue] = useState<BriefFormData>({
    brief: "",
    sourceIds: [],
    folderId: null,
  });
  return (
    <QueryClientProvider client={new QueryClient()}>
      <AudioOverviewBriefForm
        notebookId="notebook-1"
        kind="audio_overview"
        value={value}
        onChange={(patch) => setValue((current) => ({ ...current, ...patch }))}
        onSubmit={() => onSubmit(value)}
      />
    </QueryClientProvider>
  );
}

describe("AudioOverviewBriefForm", () => {
  it("requires a source before moving to instructions, including in free grounding mode", async () => {
    render(<FormHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Next Step" }));
    expect(screen.getByText("Step 2 of 3")).toBeTruthy();
    expect(
      screen.getByText(
        "Select at least one source. Audio Overviews use your selected material to keep the discussion grounded.",
      ),
    ).toBeTruthy();
    expect(screen.getAllByText("Knowledge Sources").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Next Step" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Step 3" }));
    expect(screen.getByText("Step 2 of 3")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Select source" }));
    await waitFor(() => expect(screen.getByText("Selected sources: Biology notes")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Next Step" }));
    expect(screen.getByText("Step 3 of 3")).toBeTruthy();
    expect(screen.getByText("Briefing · Standard (5–7 min) · Some background")).toBeTruthy();
    expect(screen.getByText("1 source selected")).toBeTruthy();
  });

  it("shows the defaults and lets the user configure overview options", () => {
    const onSubmit = vi.fn();
    render(<FormHarness onSubmit={onSubmit} />);

    expect(screen.getByRole("button", { name: /Briefing/ }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(
      screen.getByRole("button", { name: /Standard \(5–7 min\)/ }).getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /Deep dive/ }));
    fireEvent.click(screen.getByRole("button", { name: /Extended \(10–12 min\)/ }));
    fireEvent.click(screen.getByRole("button", { name: "Next Step" }));
    expect(
      screen.getByRole("button", { name: /Some background/ }).getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /Advanced/ }));
    fireEvent.click(screen.getByRole("button", { name: "Select source" }));
    fireEvent.click(screen.getByRole("button", { name: "Next Step" }));
    fireEvent.click(screen.getByRole("button", { name: "Generate Audio Overview" }));

    expect(screen.getByText("Deep dive · Extended (10–12 min) · Advanced")).toBeTruthy();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        format: "deep_dive",
        length: "extended",
        audience: "advanced",
        sourceIds: ["source-1"],
      }),
    );
  });
});
