import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ModelOption } from "@/features/ai";
import { toast } from "sonner";
import { Composer } from "./composer";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

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

const capableModels: ModelOption[] = [
  {
    id: "openai/gpt-5.6-luna",
    displayName: "GPT-5.6 Luna",
    supportsWebSearch: true,
    capabilities: {
      structuredOutput: true,
      fileInput: true,
      imageInput: true,
    },
  },
];

const unsupportedModels: ModelOption[] = [
  {
    id: "deepseek/deepseek-r1",
    displayName: "DeepSeek R1",
    supportsWebSearch: false,
    capabilities: {
      structuredOutput: true,
      fileInput: false,
      imageInput: false,
    },
  },
];

function ComposerHarness({
  isLoading = false,
  isDisabled = false,
  onStop = vi.fn(),
  onSubmit = vi.fn(),
  onModelChange = vi.fn(),
  models: modelList = models,
  selectedModel = models[0].id,
  capabilitiesVerified = true,
}: {
  isLoading?: boolean;
  isDisabled?: boolean;
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
      isDisabled={isDisabled}
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
    expect(await screen.findByRole("option", { name: /Claude Opus 5.5/ })).toBeTruthy();
    expect(screen.queryByText("No structured output")).toBeNull();

    await user.click(screen.getByRole("option", { name: /Claude Opus 5.5/ }));
    expect(onModelChange).toHaveBeenCalledWith("anthropic/claude-opus-5.5");
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

  it("keeps submit disabled during branch selection without showing the stop state", async () => {
    const user = userEvent.setup();
    render(<ComposerHarness isDisabled />);

    await user.type(screen.getByRole("textbox"), "Continue in this branch");

    const composer = screen.getByRole("textbox").closest("form");
    expect(composer?.getAttribute("data-composer-state")).toBe("ready");
    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
    expect((screen.getByRole("button", { name: "Submit" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("renders desktop dialog on desktop viewports", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      media: "(min-width: 640px)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList);

    render(<ComposerHarness />);

    await user.click(screen.getByRole("button", { name: /GPT-5.6 Luna/ }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(await screen.findByRole("option", { name: /GPT-5.6 Luna/ })).toBeTruthy();
  });

  it("renders a visible and keyboard-accessible attach button that opens the file dialog", async () => {
    const user = userEvent.setup();
    render(<ComposerHarness />);

    const attachButton = screen.getByRole("button", { name: "Attach files" });
    expect(attachButton).toBeTruthy();

    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click");

    attachButton.focus();
    expect(document.activeElement).toBe(attachButton);

    await user.click(attachButton);
    expect(clickSpy).toHaveBeenCalled();
  });

  it("enables files-only submission and triggers onSubmit without text", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    const { container } = render(
      <ComposerHarness
        models={capableModels}
        selectedModel="openai/gpt-5.6-luna"
        onSubmit={onSubmit}
      />,
    );

    const submit = screen.getByRole("button", { name: "Submit" });
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const file = new File(["test file content"], "document.pdf", {
      type: "application/pdf",
    });

    await user.upload(fileInput, file);

    expect((submit as HTMLButtonElement).disabled).toBe(false);

    await user.click(submit);

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          files: expect.arrayContaining([
            expect.objectContaining({ filename: "document.pdf" }),
          ]),
        }),
      );
    });
  });

  it("shows model capability warning/error when non-image attachment is added for unsupported model", async () => {
    const user = userEvent.setup();
    vi.clearAllMocks();

    const { container } = render(
      <ComposerHarness
        models={unsupportedModels}
        selectedModel="deepseek/deepseek-r1"
      />,
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["test document"], "notes.txt", {
      type: "text/plain",
    });

    await user.upload(fileInput, file);

    expect(toast.error).toHaveBeenCalledWith("This model does not support file attachments");
    expect(screen.getByRole("alert").textContent).toContain("This model does not support file attachments");
  });

  it("shows model capability warning/error when image attachment is added for unsupported model", async () => {
    const user = userEvent.setup();
    vi.clearAllMocks();

    const { container } = render(
      <ComposerHarness
        models={unsupportedModels}
        selectedModel="deepseek/deepseek-r1"
      />,
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["fake image content"], "photo.png", {
      type: "image/png",
    });

    await user.upload(fileInput, file);

    expect(toast.error).toHaveBeenCalledWith("This model does not support image attachments");
    expect(screen.getByRole("alert").textContent).toContain("This model does not support image attachments");
  });
});
