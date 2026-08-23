import type { UIMessage } from "@ai-sdk/react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CitedSourceDTO } from "@/shared/api";
import { AssistantMessage } from "./assistant-message";

const citedSource: CitedSourceDTO = {
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
  quote: "The passage connects justice with the structure of the ideal city.",
  isAvailable: true,
};

function assistantMessage(text: string, state: "streaming" | "done" = "done"): UIMessage {
  return {
    id: "assistant-1",
    role: "assistant",
    parts: [{ type: "text", text, state }],
  };
}

describe("AssistantMessage references", () => {
  it("renders a completed citation marker as an inline reference Popover", async () => {
    const user = userEvent.setup();
    render(
      <AssistantMessage
        message={assistantMessage("Justice is developed through the city. [ref:R1]")}
        citedSources={[citedSource]}
        onCopy={vi.fn()}
        onRegenerate={vi.fn()}
        showRegenerate
      />,
    );

    const trigger = screen.getByRole("button", {
      name: "Reference 1: Internet Encyclopedia of Philosophy",
    });
    expect(trigger.textContent).toBe("(Internet Encyclopedia of Philosophy)");

    await user.click(trigger);
    expect(
      screen.getByText("The passage connects justice with the structure of the ideal city."),
    ).toBeTruthy();
  });

  it("does not expose incomplete citation syntax while streaming", () => {
    const { container } = render(
      <AssistantMessage
        message={assistantMessage("Justice is developed through the city. [ref:R", "streaming")}
        citedSources={[]}
        onCopy={vi.fn()}
        onRegenerate={vi.fn()}
        showRegenerate
      />,
    );

    expect(container.textContent).toContain("Justice is developed through the city.");
    expect(container.textContent).not.toContain("[ref:");
  });
});
