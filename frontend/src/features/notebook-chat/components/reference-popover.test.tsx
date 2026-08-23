import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { CitedSourceDTO } from "@/shared/api";
import { ReferencePopover } from "./reference-popover";

function reference(overrides: Partial<CitedSourceDTO> = {}): CitedSourceDTO {
  return {
    id: "source-1",
    schemaVersion: 1,
    citationKey: "R1",
    chunkId: "chunk-1",
    chunkIndex: 0,
    number: 1,
    title: "Internet Encyclopedia of Philosophy",
    kind: "url",
    url: "https://example.com/republic",
    description: null,
    quote: "Plato develops the account through the structure of the ideal city.",
    isAvailable: true,
    ...overrides,
  };
}

describe("ReferencePopover", () => {
  it("shows the source title and supporting excerpt", async () => {
    const user = userEvent.setup();
    render(<ReferencePopover reference={reference()} />);

    const trigger = screen.getByRole("button", {
      name: "Reference 1: Internet Encyclopedia of Philosophy",
    });
    await user.click(trigger);

    expect(screen.getAllByText("Internet Encyclopedia of Philosophy")).toHaveLength(2);
    expect(
      screen.getByText("Plato develops the account through the structure of the ideal city."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /open source/i }).getAttribute("href")).toBe(
      "https://example.com/republic",
    );
  });

  it("keeps deleted or invalid references readable without an external action", async () => {
    const user = userEvent.setup();
    render(
      <ReferencePopover
        reference={reference({
          isAvailable: false,
          url: "javascript:alert(1)",
          quote: null,
          description: null,
        })}
      />,
    );

    const trigger = screen.getByRole("button", {
      name: "Reference 1: Internet Encyclopedia of Philosophy",
    });
    await user.click(trigger);

    expect(screen.getByText("Source unavailable")).toBeTruthy();
    expect(screen.getByText("No excerpt is available for this reference.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /open source/i })).toBeNull();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(trigger.getAttribute("aria-expanded")).toBe("false"));
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
