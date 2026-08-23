import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Composer } from "./composer";

const models = [
  {
    id: "openai/gpt-5.6-luna",
    displayName: "GPT-5.6 Luna",
  },
];

function ComposerHarness({
  isLoading = false,
  onStop = vi.fn(),
  onSubmit = vi.fn(),
}: {
  isLoading?: boolean;
  onStop?: () => void;
  onSubmit?: (text: string) => void;
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
      models={models}
      selectedModel={models[0].id}
      onModelChange={vi.fn()}
      textareaRef={textareaRef}
    />
  );
}

describe("Composer", () => {
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

    expect(onSubmit).toHaveBeenCalledWith("Explain this source");
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
