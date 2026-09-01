import type { UIMessage } from "@ai-sdk/react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CitedSourceDTO } from "../api/chat";
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

  it("calls onCopy and onRegenerate when buttons are clicked", async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    const onRegenerate = vi.fn();

    render(
      <AssistantMessage
        message={assistantMessage("Justice is harmony.")}
        citedSources={[]}
        onCopy={onCopy}
        onRegenerate={onRegenerate}
        showRegenerate
      />,
    );

    const copyBtn = screen.getByRole("button", { name: "Copy message" });
    await user.click(copyBtn);
    expect(onCopy).toHaveBeenCalledWith("Justice is harmony.");

    const regenBtn = screen.getByRole("button", { name: "Regenerate response" });
    await user.click(regenBtn);
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it("navigates between multiple response versions", async () => {
    const user = userEvent.setup();
    const v1: UIMessage = {
      id: "assistant-v1",
      role: "assistant",
      parts: [{ type: "text", text: "First version answer.", state: "done" }],
    };
    const v2: UIMessage = {
      id: "assistant-v2",
      role: "assistant",
      parts: [{ type: "text", text: "Second regenerated version answer.", state: "done" }],
    };

    render(
      <AssistantMessage
        versions={[v1, v2]}
        citedSources={[]}
        onCopy={vi.fn()}
        onRegenerate={vi.fn()}
        showRegenerate
      />,
    );

    // Defaults to latest version (2 of 2)
    expect(screen.getByText("2 of 2")).toBeTruthy();
    expect(screen.getByText("Second regenerated version answer.")).toBeTruthy();

    // Click previous version
    const prevBtn = screen.getByRole("button", { name: "Previous version" });
    await user.click(prevBtn);

    expect(screen.getByText("1 of 2")).toBeTruthy();
    expect(screen.getByText("First version answer.")).toBeTruthy();

    // Click next version
    const nextBtn = screen.getByRole("button", { name: "Next version" });
    await user.click(nextBtn);

    expect(screen.getByText("2 of 2")).toBeTruthy();
    expect(screen.getByText("Second regenerated version answer.")).toBeTruthy();
  });
});
