import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotebookModelProvider } from "@/features/notebooks";
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
    queryFn: () => [
      { id: "src-1", title: "Source 1", kind: "file" },
    ],
  }),
}));

function createWrapper(notebookId = "nb-1", initialModel = "openai/gpt-5.6-sol") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

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

  beforeEach(() => {
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

    const instructions = screen.getByPlaceholderText(
      "Describe the topic, question, or connections you want to understand...",
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
      }),
      expect.anything(),
      expect.anything(),
    );
  });
});
