import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ModelOption } from "@/features/ai";
import { Composer } from "./composer";

const models = [
  {
    id: "openai/gpt-5.6-luna",
    displayName: "GPT-5.6 Luna",
    supportsWebSearch: true,
    capabilities: { structuredOutput: true },
  },
];

const mixedModels: ModelOption[] = [
  {
    id: "openai/gpt-5.6-luna",
    displayName: "GPT-5.6 Luna",
    supportsWebSearch: true,
    capabilities: { structuredOutput: true },
  },
  {
    id: "anthropic/claude-opus-5.5",
    displayName: "Claude Opus 5.5",
    capabilities: { structuredOutput: false },
  },
];

function ComposerHarness({
  isLoading = false,
  onStop = vi.fn(),
  onSubmit = vi.fn(),
  onModelChange = vi.fn(),
  models: modelList = models,
  selectedModel = models[0].id,
  capabilitiesVerified = true,
}: {
  isLoading?: boolean;
  onStop?: () => void;
  onSubmit?: (submission: { text: string; files?: unknown[] } | string) => void;
  onModelChange?: (model: string) => void;
  models?: ModelOption[];
  selectedModel?: string;
  capabilitiesVerified?: boolean;
}) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <Composer
      input={input}
      onInputChange={setInput}
      onSubmit={onSubmit}
      isLoading={isLoading}
      onStop={onStop}
      models={modelList}
      selectedModel={selectedModel}
      onModelChange={onModelChange}
      capabilitiesVerified={capabilitiesVerified}
      textareaRef={textareaRef}
    />
  );
}

describe("Composer", () => {
  it("lists models in the selector without capability badges", async () => {
    const user = userEvent.setup();
    render(<ComposerHarness />);
    await user.click(screen.getByRole("button", { name: /GPT-5.6 Luna/ }));
    expect(await screen.findByRole("option", { name: /GPT-5.6 Luna/ })).toBeTruthy();
    expect(screen.queryByText("Web")).toBeNull();
    expect(screen.queryByText("Free")).toBeNull();
    expect(screen.queryByText("No structured output")).toBeNull();
  });

  it("marks models without structured output and keeps them selectable", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    render(<ComposerHarness models={mixedModels} onModelChange={onModelChange} />);

    await user.click(screen.getByRole("button", { name: /GPT-5.6 Luna/ }));
    expect(await screen.findByText("No structured output")).toBeTruthy();

    await user.click(screen.getByRole("option", { name: /Claude Opus 5.5/ }));
    expect(onModelChange).toHaveBeenCalledWith("anthropic/claude-opus-5.5");
  });

  it("hides models without structured output when the filter is on", async () => {
    const user = userEvent.setup();
    render(<ComposerHarness models={mixedModels} />);

    await user.click(screen.getByRole("button", { name: /GPT-5.6 Luna/ }));
    expect(await screen.findByRole("option", { name: /Claude Opus 5.5/ })).toBeTruthy();

    await user.click(screen.getByRole("checkbox", { name: "Structured output" }));

    expect(screen.queryByRole("option", { name: /Claude Opus 5.5/ })).toBeNull();
    expect(screen.getByRole("option", { name: /GPT-5.6 Luna/ })).toBeTruthy();
  });

  it("fails closed for image attachments when capability metadata is absent", () => {
    render(<ComposerHarness />);
    expect(screen.queryByRole("button", { name: "Attach photo" })).toBeNull();
  });

  it("moves from an empty disabled state to a ready submit state", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<ComposerHarness onSubmit={onSubmit} />);

    const composer = screen.getByRole("textbox").closest("form");
    const submit = screen.getByRole("button", { name: "Submit" });

    expect(composer?.getAttribute("data-composer-state")).toBe("empty");
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    await user.type(screen.getByRole("textbox"), "Explain this source");

    expect(composer?.getAttribute("data-composer-state")).toBe("ready");
    expect((submit as HTMLButtonElement).disabled).toBe(false);

    await user.click(submit);

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ text: "Explain this source" }));
  });

  it("exposes the streaming stop state without requiring input", async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();

    render(<ComposerHarness isLoading onStop={onStop} />);

    const composer = screen.getByRole("textbox").closest("form");
    const stop = screen.getByRole("button", { name: "Stop" });

    expect(composer?.getAttribute("data-composer-state")).toBe("streaming");
    expect((stop as HTMLButtonElement).disabled).toBe(false);

    await user.click(stop);

    expect(onStop).toHaveBeenCalledOnce();
  });
});