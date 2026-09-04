import type { UIMessage } from "@ai-sdk/react";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { CitedSourceDTO } from "../api/chat";
import { AssistantMessage } from "./assistant-message";

it("renders a model citation wrapped in backticks as an interactive reference", () => {
  const message: UIMessage = {
    id: "assistant-repro",
    role: "assistant",
    parts: [{ type: "text", text: "Claim `[ref:R3]`.", state: "done" }],
  };
  const citedSource: CitedSourceDTO = {
    id: "source-3",
    schemaVersion: 1,
    citationKey: "R3",
    chunkId: "chunk-3",
    chunkIndex: 0,
    number: 4,
    title: "Nietzsche source",
    kind: "url",
    url: "https://example.com/source",
    description: null,
    quote: "Supporting excerpt",
    isAvailable: true,
  };

  render(
    <AssistantMessage
      message={message}
      citedSources={[citedSource]}
      onCopy={vi.fn()}
      onRegenerate={vi.fn()}
    />,
  );

  expect(screen.queryByText("[4](#reference-R3)")).toBeNull();
  expect(screen.getByRole("button", { name: "Reference 4: Nietzsche source" })).toBeTruthy();
});
