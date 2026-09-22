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
    expect(trigger.textContent).toBe("1");

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

describe("AssistantMessage no-evidence state", () => {
  function noEvidenceMessage(): UIMessage {
    return {
      id: "assistant-no-evidence-1",
      role: "assistant",
      parts: [
        {
          type: "text",
          text: "I could not find usable material in this Notebook to answer that question.",
          state: "done",
        },
      ],
      metadata: {
        noEvidence: {
          abstentionReason: "no_indexed_chunks",
          degradedSources: [
            {
              id: "source-1",
              title: "Beyond Good and Evil Summary",
              reason: "navigation",
            },
          ],
          unhelpfulSources: [{ id: "source-2", title: "Lecture notes" }],
        },
      },
    } as UIMessage;
  }

  it("renders the distinct no-evidence state naming degraded and unhelpful sources", () => {
    render(
      <AssistantMessage
        message={noEvidenceMessage()}
        citedSources={[citedSource]}
        onCopy={vi.fn()}
        onRegenerate={vi.fn()}
        showRegenerate
      />,
    );

    const panel = screen.getByTestId("no-evidence-panel");
    expect(panel.textContent).toContain("No usable evidence in this notebook");
    expect(panel.textContent).toContain("Beyond Good and Evil Summary");
    expect(panel.textContent).toContain(
      "Most of this source is links, navigation, or a table of contents.",
    );
    expect(panel.textContent).toContain(
      "Import the file version or paste the text into a new source.",
    );
    expect(panel.textContent).toContain("Lecture notes");
    expect(panel.textContent).toContain(
      "Suggested fix: import the file version or paste the source text, then ask again.",
    );
  });

  it("never presents the no-evidence state as a source-grounded reply with references", () => {
    render(
      <AssistantMessage
        message={noEvidenceMessage()}
        citedSources={[citedSource]}
        onCopy={vi.fn()}
        onRegenerate={vi.fn()}
        showRegenerate
      />,
    );

    expect(
      screen.queryByRole("button", {
        name: "Reference 1: Internet Encyclopedia of Philosophy",
      }),
    ).toBeNull();
    expect(screen.queryByText("The passage connects justice with the structure of the ideal city.")).toBeNull();
  });

  it("still lets the user copy and regenerate from the no-evidence state", async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();

    render(
      <AssistantMessage
        message={noEvidenceMessage()}
        citedSources={[]}
        onCopy={onCopy}
        onRegenerate={vi.fn()}
        showRegenerate
      />,
    );

    await user.click(screen.getByRole("button", { name: "Copy message" }));
    expect(onCopy).toHaveBeenCalledWith(
      "I could not find usable material in this Notebook to answer that question.",
    );
    await user.click(screen.getByRole("button", { name: "Regenerate response" }));
    expect(onCopy).toHaveBeenCalledTimes(1);
  });
});

describe("AssistantMessage reasoning streaming", () => {
  function reasoningMessage(
    text: string,
    state: "streaming" | "done" = "streaming",
    extraParts: UIMessage["parts"] = [],
  ): UIMessage {
    return {
      id: "assistant-reasoning-1",
      role: "assistant",
      parts: [{ type: "reasoning", text, state }, ...extraParts],
    } as UIMessage;
  }

  it("shows live Thinking state for reasoning-only streaming parts", () => {
    const { container } = render(
      <AssistantMessage
        message={reasoningMessage("Considering Plato…", "streaming")}
        citedSources={[]}
        onCopy={vi.fn()}
        onRegenerate={vi.fn()}
        showRegenerate
      />,
    );

    // Reasoning block renders even with no answer text yet…
    expect(container.textContent).toContain("Considering Plato");
    // …and reports the live Thinking state (not "Thought for …").
    expect(container.textContent).toContain("Thinking...");
  });

  it("marks reasoning done once answer text streams", () => {
    const { container } = render(
      <AssistantMessage
        message={reasoningMessage("Considering Plato…", "done", [
          { type: "text", text: "The cave represents…", state: "streaming" },
        ])}
        citedSources={[]}
        onCopy={vi.fn()}
        onRegenerate={vi.fn()}
        showRegenerate
      />,
    );

    expect(container.textContent).toContain("The cave represents");
    expect(container.textContent).not.toContain("Thinking...");
  });

  it("renders persisted reasoning without live state", () => {
    const { container } = render(
      <AssistantMessage
        message={reasoningMessage("Considering Plato…", "done")}
        citedSources={[]}
        onCopy={vi.fn()}
        onRegenerate={vi.fn()}
        showRegenerate
      />,
    );

    // Done reasoning collapses behind the trigger ("Thought for …"), so the
    // body text is hidden until expanded — but it must NOT show live state.
    expect(container.textContent).toContain("Thought for");
    expect(container.textContent).not.toContain("Thinking...");
  });
});
