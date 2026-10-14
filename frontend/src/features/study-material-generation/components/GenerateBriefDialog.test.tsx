import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotebookModelProvider } from "@/features/notebooks";
import i18n from "@/shared/i18n/i18n";
import { GenerateBriefDialog } from "./GenerateBriefDialog";
import { useGenerationStore } from "../hooks/use-generation-store";

vi.mock("@/features/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/ai")>();
  return {
    ...actual,
    useConnectionStatus: () => ({ data: { ok: true } }),
    GatewayKeyPrompt: () => <div>Gateway Key Prompt</div>,
  };
});

vi.mock("@/features/sources", () => ({
  sourcesQueryOptions: () => ({
    queryKey: ["sources"],
    queryFn: () => [{ id: "src-1", title: "Source 1", kind: "file" }],
  }),
}));

const VERIFIED_CATALOG = {
  models: [
    {
      id: "openai/gpt-5.6-sol",
      displayName: "GPT-5.6 Sol",
      capabilities: { structuredOutput: true },
    },
    {
      id: "google/gemini-2.5-flash",
      displayName: "Gemini 2.5 Flash",
      capabilities: { structuredOutput: true },
    },
    {
      id: "anthropic/claude-3-7-sonnet",
      displayName: "Claude 3.7 Sonnet",
      capabilities: { structuredOutput: true },
    },
    {
      id: "deepseek/deepseek-chat",
      displayName: "DeepSeek Chat",
      capabilities: { structuredOutput: true },
    },
  ],
  capabilitiesVerified: true,
};

function createWrapper(
  notebookId = "nb-1",
  initialModel = "openai/gpt-5.6-sol",
  catalog: unknown = VERIFIED_CATALOG,
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  queryClient.setQueryData(["models"], catalog);

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <NotebookModelProvider notebookId={notebookId} initialModel={initialModel}>
          {children}
        </NotebookModelProvider>
      </QueryClientProvider>
    );
  };
}

describe("GenerateBriefDialog", () => {
  let mockStartBackgroundGeneration: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Namespaces load lazily; without the app-level Suspense boundary the first
    // render would suspend on a cold worker.
    await i18n.loadNamespaces(["generation", "notebooks"]);
    await i18n.changeLanguage("en");
    vi.clearAllMocks();
    mockStartBackgroundGeneration = vi.fn().mockResolvedValue(undefined);
    useGenerationStore.setState({
      startBackgroundGeneration: mockStartBackgroundGeneration as any,
    });
  });



  it("does not render any model selector in flashcard generation dialog and submits with global model", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onComplete = vi.fn();

    const Wrapper = createWrapper("nb-1", "google/gemini-2.5-flash");

    render(
      <GenerateBriefDialog
        notebookId="nb-1"
        kind="simple_flashcard"
        open={true}
        onOpenChange={onOpenChange}
        onComplete={onComplete}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText("Generate Flashcards")).toBeTruthy();
    expect(screen.queryByText("Select Model")).toBeNull();
    expect(screen.queryByText("AI Intelligence Model")).toBeNull();

    await user.click(screen.getByRole("button", { name: /Next Step/i }));

    const instructions = screen.getByPlaceholderText("What topics should these flashcards cover?");
    await user.type(instructions, "Key definitions in biology");

    const generateBtn = screen.getByRole("button", { name: "Generate" });
    await waitFor(() => {
      expect((generateBtn as HTMLButtonElement).disabled).toBe(false);
    });

    await user.click(generateBtn);

    expect(mockStartBackgroundGeneration).toHaveBeenCalledWith(
      "nb-1",
      expect.objectContaining({
        kind: "simple_flashcard",
        brief: "Key definitions in biology",
        model: "google/gemini-2.5-flash",
      }),
      expect.anything(),
      expect.anything(),
    );
  });

  it("does not render any model selector in quiz generation dialog and submits with global model", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onComplete = vi.fn();

    const Wrapper = createWrapper("nb-1", "anthropic/claude-3-7-sonnet");

    render(
      <GenerateBriefDialog
        notebookId="nb-1"
        kind="quiz"
        open={true}
        onOpenChange={onOpenChange}
        onComplete={onComplete}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText("Generate Quiz")).toBeTruthy();

    const nextBtn = screen.getByRole("button", { name: /Next Step/i });
    await user.click(nextBtn);

    expect(screen.queryByText("Select Model")).toBeNull();
    expect(screen.queryByText("AI Intelligence Model")).toBeNull();

    const instructions = screen.getByPlaceholderText(
      "Provide specific focus areas, topics, or instructions for this quiz...",
    );
    await user.type(instructions, "Cellular respiration");

    const generateBtn = screen.getByRole("button", { name: "Generate" });
    await waitFor(() => {
      expect((generateBtn as HTMLButtonElement).disabled).toBe(false);
    });

    await user.click(generateBtn);

    expect(mockStartBackgroundGeneration).toHaveBeenCalledWith(
      "nb-1",
      expect.objectContaining({
        kind: "quiz",
        brief: "Cellular respiration",
        model: "anthropic/claude-3-7-sonnet",
      }),
      expect.anything(),
      expect.anything(),
    );
  });

  it("submits the defaults for quiz when only instructions are provided", async () => {
    const user = userEvent.setup();
    render(
      <GenerateBriefDialog
        notebookId="nb-1"
        kind="quiz"
        open
        onOpenChange={vi.fn()}
        onComplete={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    await user.click(screen.getByRole("button", { name: /Next Step/i }));
    await user.type(
      screen.getByPlaceholderText(
        "Provide specific focus areas, topics, or instructions for this quiz...",
      ),
      "Quiz defaults",
    );

    const generateBtn = screen.getByRole("button", { name: "Generate" });
    await waitFor(() => {
      expect((generateBtn as HTMLButtonElement).disabled).toBe(false);
    });
    await user.click(generateBtn);

    expect(mockStartBackgroundGeneration).toHaveBeenCalledWith(
      "nb-1",
      expect.objectContaining({
        kind: "quiz",
        brief: "Quiz defaults",
        questionCount: 10,
        difficulty: "medium",
      }),
      expect.anything(),
      expect.anything(),
    );
  });

  it("does not render any model selector in roadmap generation dialog and submits with global model", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onComplete = vi.fn();

    const Wrapper = createWrapper("nb-1", "deepseek/deepseek-chat");

    render(
      <GenerateBriefDialog
        notebookId="nb-1"
        kind="roadmap"
        open={true}
        onOpenChange={onOpenChange}
        onComplete={onComplete}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText("Generate Roadmap")).toBeTruthy();
    expect(screen.queryByText("Select Model")).toBeNull();
    expect(screen.queryByText("AI Intelligence Model")).toBeNull();

    await user.click(screen.getByRole("button", { name: /Next Step/i }));

    const instructions = screen.getByPlaceholderText(
      "What do you want to learn? Describe the topic, goal, or target skill...",
    );
    await user.type(instructions, "Frontend architecture");

    const generateBtn = screen.getByRole("button", { name: "Generate" });
    await waitFor(() => {
      expect((generateBtn as HTMLButtonElement).disabled).toBe(false);
    });

    await user.click(generateBtn);

    expect(mockStartBackgroundGeneration).toHaveBeenCalledWith(
      "nb-1",
      expect.objectContaining({
        kind: "roadmap",
        brief: "Frontend architecture",
        model: "deepseek/deepseek-chat",
      }),
      expect.anything(),
      expect.anything(),
    );
  });

  it("does not render any model selector in mind map generation dialog and submits with global model", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onComplete = vi.fn();

    const Wrapper = createWrapper("nb-1", "google/gemini-2.5-flash");

    render(
      <GenerateBriefDialog
        notebookId="nb-1"
        kind="mind_map"
        open={true}
        onOpenChange={onOpenChange}
        onComplete={onComplete}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText("Generate Mind Map")).toBeTruthy();
    expect(screen.queryByText("Select model")).toBeNull();
    expect(screen.queryByText("AI model")).toBeNull();

    await user.click(screen.getByRole("button", { name: "20" }));
    await user.click(screen.getByRole("button", { name: /^Basic/ }));

    await user.click(screen.getByRole("button", { name: /Next Step/i }));

    await user.click(screen.getByRole("button", { name: /^Grouped colors/ }));

    await user.click(screen.getByRole("button", { name: /Next Step/i }));

    const instructions = screen.getByPlaceholderText(
      "What should this map explain? Describe the topic, question, or connections...",
    );
    await user.type(instructions, "Operating systems concepts");

    const generateBtn = screen.getByRole("button", { name: "Generate" });
    await waitFor(() => {
      expect((generateBtn as HTMLButtonElement).disabled).toBe(false);
    });

    await user.click(generateBtn);

    expect(mockStartBackgroundGeneration).toHaveBeenCalledWith(
      "nb-1",
      expect.objectContaining({
        kind: "mind_map",
        brief: "Operating systems concepts",
        model: "google/gemini-2.5-flash",
        mindMapOptions: {
          nodeCount: 20,
          structure: "hierarchical",
          colorGroups: true,
          crossLinks: false,
          detailLevel: "basic",
        },
      }),
      expect.anything(),
      expect.anything(),
    );
  });

  it("walks the slides wizard across three steps and submits with design options", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onComplete = vi.fn();

    const Wrapper = createWrapper("nb-1", "openai/gpt-5.6-sol");

    render(
      <GenerateBriefDialog
        notebookId="nb-1"
        kind="slides"
        open={true}
        onOpenChange={onOpenChange}
        onComplete={onComplete}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText("Generate Slides")).toBeTruthy();
    expect(screen.getByText("Slides Setup")).toBeTruthy();
    expect(screen.getByText("Step 1 of 3")).toBeTruthy();
    // Design step is visible first; the submit action lives on the last step.
    expect(screen.getByRole("button", { name: "Dark" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Generate" })).toBeNull();

    // Choose custom options for the slides wizard.
    await user.click(screen.getByRole("button", { name: "8" }));
    await user.click(screen.getByRole("button", { name: "Dark" }));

    await user.click(screen.getByRole("button", { name: /Next Step/i }));
    expect(screen.getByText("Step 2 of 3")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /^Detailed/ }));

    await user.click(screen.getByRole("button", { name: /Next Step/i }));
    expect(screen.getByText("Step 3 of 3")).toBeTruthy();

    const instructions = screen.getByPlaceholderText(
      "What should this deck explain? Describe the topic, audience, or narrative arc...",
    );
    await user.type(instructions, "Photosynthesis basics");

    const generateBtn = screen.getByRole("button", { name: "Generate" });
    await waitFor(() => {
      expect((generateBtn as HTMLButtonElement).disabled).toBe(false);
    });

    await user.click(generateBtn);

    expect(mockStartBackgroundGeneration).toHaveBeenCalledWith(
      "nb-1",
      expect.objectContaining({
        kind: "slides",
        brief: "Photosynthesis basics",
        model: "openai/gpt-5.6-sol",
        slidesOptions: {
          slideCount: 8,
          theme: "dark",
          detailLevel: "detailed",
        },
      }),
      expect.anything(),
      expect.anything(),
    );
  });

  it("blocks the brief form when the selected model cannot produce structured output", () => {
    const catalog = {
      models: [
        {
          id: "anthropic/claude-opus-5.5",
          displayName: "Claude Opus 5.5",
          capabilities: { structuredOutput: false },
        },
      ],
      capabilitiesVerified: true,
    };

    render(
      <GenerateBriefDialog
        notebookId="nb-1"
        kind="quiz"
        open
        onOpenChange={vi.fn()}
        onComplete={vi.fn()}
      />,
      { wrapper: createWrapper("nb-1", "anthropic/claude-opus-5.5", catalog) },
    );

    expect(screen.getByText("Generate Quiz")).toBeTruthy();
    expect(screen.getByText("This model can't generate study materials")).toBeTruthy();
    expect(
      screen.getByText(/Claude Opus 5\.5 doesn't support structured output/),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Next Step/i })).toBeNull();
    expect(screen.queryByRole("link", { name: "Refresh the catalog in Settings" })).toBeNull();
  });

  it("opens the picker from the gate and reveals the form after choosing a capable model", async () => {
    const user = userEvent.setup();
    const catalog = {
      models: [
        {
          id: "anthropic/claude-opus-5.5",
          displayName: "Claude Opus 5.5",
          capabilities: { structuredOutput: false },
        },
        {
          id: "openai/gpt-5.6-sol",
          displayName: "GPT-5.6 Sol",
          capabilities: { structuredOutput: true },
        },
      ],
      capabilitiesVerified: true,
    };

    render(
      <GenerateBriefDialog
        notebookId="nb-1"
        kind="quiz"
        open
        onOpenChange={vi.fn()}
        onComplete={vi.fn()}
      />,
      { wrapper: createWrapper("nb-1", "anthropic/claude-opus-5.5", catalog) },
    );

    await user.click(screen.getByRole("button", { name: "Choose a Model" }));
    expect(screen.queryByRole("checkbox", { name: "Structured output" })).toBeNull();
    expect(screen.queryByRole("option", { name: /Claude Opus 5.5/ })).toBeNull();
    expect(screen.queryByText("No structured output")).toBeNull();
    await user.click(await screen.findByRole("option", { name: /GPT-5.6 Sol/ }));

    expect(screen.getByRole("button", { name: /Next Step/i })).toBeTruthy();
    expect(screen.queryByText("This model can't generate study materials")).toBeNull();

    // The chosen model persists through the existing notebook model context.
    await user.click(screen.getByRole("button", { name: /Next Step/i }));
    await user.type(
      screen.getByPlaceholderText(
        "Provide specific focus areas, topics, or instructions for this quiz...",
      ),
      "Cellular respiration",
    );
    const generateBtn = screen.getByRole("button", { name: "Generate" });
    await waitFor(() => {
      expect((generateBtn as HTMLButtonElement).disabled).toBe(false);
    });
    await user.click(generateBtn);

    expect(mockStartBackgroundGeneration).toHaveBeenCalledWith(
      "nb-1",
      expect.objectContaining({ model: "openai/gpt-5.6-sol" }),
      expect.anything(),
      expect.anything(),
    );
  });

  it("explains an unverified catalog and links to Settings", () => {
    const catalog = {
      models: [
        {
          id: "openai/gpt-5.6-sol",
          displayName: "GPT-5.6 Sol",
          capabilities: { structuredOutput: true },
        },
      ],
      capabilitiesVerified: false,
    };

    render(
      <GenerateBriefDialog
        notebookId="nb-1"
        kind="quiz"
        open
        onOpenChange={vi.fn()}
        onComplete={vi.fn()}
      />,
      { wrapper: createWrapper("nb-1", "openai/gpt-5.6-sol", catalog) },
    );

    expect(
      screen.getByText(/couldn't be verified with the AI Gateway/),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Next Step/i })).toBeNull();
  });



  it("renders a mobile fullscreen modal on viewports under 640px", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: query === "(max-width: 639px)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList));

    render(
      <GenerateBriefDialog
        notebookId="nb-1"
        kind="quiz"
        open={true}
        onOpenChange={vi.fn()}
        onComplete={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByRole("heading", { name: "Generate Quiz" })).toBeTruthy();
    const dialogPopup = document.querySelector('[data-slot="mobile-fullscreen-dialog"]');
    expect(dialogPopup).toBeTruthy();
    expect(document.querySelector('[data-slot="mobile-fullscreen-close"]')).toBeTruthy();
  });
});
