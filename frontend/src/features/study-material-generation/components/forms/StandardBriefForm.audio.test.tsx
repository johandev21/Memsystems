import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StandardBriefForm } from "./StandardBriefForm";

vi.mock("@/features/notebooks", () => ({
  canSubmitBrief: (_mode: string, hasSources: boolean, hasBrief: boolean, disabled: boolean) =>
    !disabled && (hasSources || hasBrief),
  useNotebookGroundingMode: () => "free",
}));
vi.mock("./folder-picker", () => ({ FolderPicker: () => <div /> }));
vi.mock("./source-multi-select", () => ({
  SourceMultiSelect: ({
    value,
    onChange,
  }: {
    value: string[];
    onChange: (value: string[]) => void;
  }) => (
    <button type="button" onClick={() => onChange(["source-1"])} aria-pressed={value.length > 0}>
      Select source
    </button>
  ),
}));

describe("StandardBriefForm for Audio Overview", () => {
  const baseProps = {
    notebookId: "notebook-1",
    kind: "audio_overview" as const,
    value: { brief: "Explain the main ideas", sourceIds: [], folderId: null },
    onChange: vi.fn(),
    onSubmit: vi.fn(),
  };

  it("keeps submit disabled when free grounding has no source selected", () => {
    render(<StandardBriefForm {...baseProps} />);

    expect(
      screen.getByText("Select at least one source to generate an Audio Overview."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Generate" }).hasAttribute("disabled")).toBe(true);
  });

  it("enables submit after a source is selected and submits", () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const { rerender } = render(
      <StandardBriefForm {...baseProps} onChange={onChange} onSubmit={onSubmit} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Select source" }));
    expect(onChange).toHaveBeenCalledWith({ sourceIds: ["source-1"] });
    rerender(
      <StandardBriefForm
        {...baseProps}
        value={{ ...baseProps.value, sourceIds: ["source-1"] }}
        onChange={onChange}
        onSubmit={onSubmit}
      />,
    );
    const submit = screen.getByRole("button", { name: "Generate" });
    expect(submit.hasAttribute("disabled")).toBe(false);
    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("shows the agreed audio overview choices", () => {
    render(
      <StandardBriefForm {...baseProps} value={{ ...baseProps.value, sourceIds: ["source-1"] }} />,
    );
    expect((screen.getByLabelText("Format") as HTMLSelectElement).value).toBe("briefing");
    expect(screen.getByRole("option", { name: "Short (2–3 min)" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Deep dive" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Advanced" })).toBeTruthy();
  });
});
