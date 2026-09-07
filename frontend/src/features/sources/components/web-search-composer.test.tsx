import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotebookModelProvider } from "@/features/notebooks";
import { WebSearchComposer } from "./web-search-composer";

const { sampleModels, mockStartWebSearchJob, mockDismissWebSearchJob } = vi.hoisted(() => {
  const models = [
    {
      id: "openai/gpt-4o-mini",
      displayName: "GPT-4o Mini",
      supportsWebSearch: true,
    },
    {
      id: "openai/gpt-5.6-sol",
      displayName: "GPT-5.6 Sol",
      supportsWebSearch: true,
    },
    {
      id: "anthropic/claude-3-7-sonnet",
      displayName: "Claude 3.7 Sonnet",
      supportsWebSearch: false,
    },
  ];

  return {
    sampleModels: models,
    mockStartWebSearchJob: vi.fn().mockResolvedValue({ id: "job-1", status: "pending" }),
    mockDismissWebSearchJob: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@/features/sources/api/web-search", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/sources/api/web-search")>();
  return {
    ...actual,
    startWebSearchJob: (...args: unknown[]) => mockStartWebSearchJob(...args),
    dismissWebSearchJob: (...args: unknown[]) => mockDismissWebSearchJob(...args),
    webSearchJobQueryOptions: (notebookId: string) => ({
      queryKey: ["web-search-job", notebookId],
      queryFn: () => null,
      initialData: null,
      staleTime: Infinity,
    }),
  };
});

vi.mock("../api/web-search", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/web-search")>();
  return {
    ...actual,
    startWebSearchJob: (...args: unknown[]) => mockStartWebSearchJob(...args),
    dismissWebSearchJob: (...args: unknown[]) => mockDismissWebSearchJob(...args),
    webSearchJobQueryOptions: (notebookId: string) => ({
      queryKey: ["web-search-job", notebookId],
      queryFn: () => null,
      initialData: null,
      staleTime: Infinity,
    }),
  };
});

vi.mock("@/features/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/ai")>();
  return {
    ...actual,
    modelsQueryOptions: {
      queryKey: ["models"],
      queryFn: () => sampleModels,
      initialData: sampleModels,
      staleTime: Infinity,
    },
  };
});

function createWrapper(
  notebookId = "nb-1",
  initialModel = "openai/gpt-5.6-sol",
  initialJob: Record<string, unknown> | null = null,
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });

  queryClient.setQueryData(["models"], sampleModels);
  queryClient.setQueryData(["web-search-job", notebookId], initialJob);

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

describe("WebSearchComposer", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockStartWebSearchJob.mockResolvedValue({ id: "job-1", status: "pending" });
    mockDismissWebSearchJob.mockResolvedValue(undefined);
  });

  it("renders without any model selector dropdown", () => {
    const Wrapper = createWrapper("nb-1", "openai/gpt-5.6-sol");
    render(<WebSearchComposer notebookId="nb-1" remainingSourceSlots={295} />, {
      wrapper: Wrapper,
    });

    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText("Select model")).toBeNull();
    expect(screen.queryByText("No compatible model")).toBeNull();
    expect(screen.queryByText(/Web · GPT-5.6 Sol/)).toBeNull();
  });

  it("enables search input and runs search with global model when model supports web search", async () => {
    const user = userEvent.setup();
    const Wrapper = createWrapper("nb-1", "openai/gpt-5.6-sol");
    render(<WebSearchComposer notebookId="nb-1" remainingSourceSlots={295} />, {
      wrapper: Wrapper,
    });

    const textarea = screen.getByPlaceholderText(
      "What would you like to research?",
    ) as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(false);

    await user.type(textarea, "Machine learning architectures");

    const sendButton = screen.getByRole("button", { name: "Search" }) as HTMLButtonElement;
    await waitFor(() => {
      expect(sendButton.disabled).toBe(false);
    });

    await user.click(sendButton);

    await waitFor(() => {
      expect(mockStartWebSearchJob).toHaveBeenCalledWith("nb-1", {
        query: "Machine learning architectures",
        modelId: "openai/gpt-5.6-sol",
      });
    });
  });

  it("blocks search and offers compatible models when the selected model is unsupported", async () => {
    const user = userEvent.setup();
    const Wrapper = createWrapper("nb-1", "anthropic/claude-3-7-sonnet");
    render(<WebSearchComposer notebookId="nb-1" remainingSourceSlots={295} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText("Choose a model that can search the web")).toBeTruthy();

    const textarea = screen.getByPlaceholderText(
      "What would you like to research?",
    ) as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(false);

    await user.type(textarea, "Existentialism");

    const sendButton = screen.getByRole("button", { name: "Search" }) as HTMLButtonElement;
    expect(sendButton.disabled).toBe(true);
    await user.click(sendButton);

    expect(mockStartWebSearchJob).not.toHaveBeenCalled();
  });

  it("sanitizes and dismisses a persisted failed-job error", async () => {
    const user = userEvent.setup();
    const Wrapper = createWrapper("nb-1", "openai/gpt-5.6-sol", {
      id: "job-failed",
      notebookId: "nb-1",
      query: "Nietzsche",
      modelId: "openai/gpt-5.6-sol",
      status: "failed",
      summary: null,
      candidates: [],
      lastError: "Tool choice `web_search_preview` not found in `tools` parameter.",
      createdAt: "2026-09-03T12:00:00.000Z",
      completedAt: "2026-09-03T12:00:01.000Z",
    });
    render(<WebSearchComposer notebookId="nb-1" remainingSourceSlots={295} />, {
      wrapper: Wrapper,
    });

    expect(await screen.findByText(/doesn't support web search/i)).toBeTruthy();
    expect(screen.queryByText(/web_search_preview/)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Clear results" }));
    await waitFor(() => {
      expect(screen.queryByText(/doesn't support web search/i)).toBeNull();
    });
    expect(mockDismissWebSearchJob).toHaveBeenCalledWith("nb-1");
  });

  it("clears persisted results, retains the query, and restores input focus", async () => {
    const user = userEvent.setup();
    mockStartWebSearchJob.mockResolvedValueOnce({
      id: "job-ready",
      notebookId: "nb-1",
      query: "Plato",
      modelId: "openai/gpt-5.6-sol",
      status: "ready",
      summary: "A concise overview of Plato.",
      candidates: [
        {
          title: "Plato",
          url: "https://plato.stanford.edu/entries/plato/",
          description: "An overview of Plato's life and philosophy.",
        },
      ],
      lastError: null,
      createdAt: "2026-09-03T12:00:00.000Z",
      completedAt: "2026-09-03T12:00:01.000Z",
    });
    const Wrapper = createWrapper("nb-1", "openai/gpt-5.6-sol");
    render(<WebSearchComposer notebookId="nb-1" remainingSourceSlots={295} />, {
      wrapper: Wrapper,
    });

    const textarea = screen.getByPlaceholderText(
      "What would you like to research?",
    ) as HTMLTextAreaElement;
    await user.type(textarea, "Plato");
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("1 source found")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Clear results" }));

    await waitFor(() => expect(screen.queryByText("1 source found")).toBeNull());
    expect(textarea.value).toBe("Plato");
    expect(document.activeElement).toBe(textarea);
    expect(screen.getByText("Search results cleared")).toBeTruthy();
    expect(mockDismissWebSearchJob).toHaveBeenCalledOnce();
  });

  it("keeps results visible and offers retry when clearing fails", async () => {
    const user = userEvent.setup();
    mockDismissWebSearchJob.mockRejectedValueOnce(new Error("Network unavailable"));
    const Wrapper = createWrapper("nb-1", "openai/gpt-5.6-sol", {
      id: "job-ready",
      notebookId: "nb-1",
      query: "Plato",
      modelId: "openai/gpt-5.6-sol",
      status: "ready",
      summary: null,
      candidates: [
        {
          title: "Plato",
          url: "https://plato.stanford.edu/entries/plato/",
          description: null,
        },
      ],
      lastError: null,
      createdAt: "2026-09-03T12:00:00.000Z",
      completedAt: "2026-09-03T12:00:01.000Z",
    });
    render(<WebSearchComposer notebookId="nb-1" remainingSourceSlots={295} />, {
      wrapper: Wrapper,
    });

    expect(await screen.findByText("1 source found")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Clear results" }));

    expect(await screen.findByText("Results weren't cleared")).toBeTruthy();
    expect(screen.getByText("Couldn't clear these results. Try again.")).toBeTruthy();
    expect(screen.getByText("1 source found")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Clear results" })).toBeTruthy();
  });

  it("prevents duplicate dismissal while results are clearing", async () => {
    const user = userEvent.setup();
    let resolveDismissal: (() => void) | undefined;
    mockDismissWebSearchJob.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveDismissal = resolve;
      }),
    );
    const Wrapper = createWrapper("nb-1", "openai/gpt-5.6-sol", {
      id: "job-ready",
      notebookId: "nb-1",
      query: "Plato",
      modelId: "openai/gpt-5.6-sol",
      status: "ready",
      summary: null,
      candidates: [
        {
          title: "Plato",
          url: "https://plato.stanford.edu/entries/plato/",
          description: null,
        },
      ],
      lastError: null,
      createdAt: "2026-09-03T12:00:00.000Z",
      completedAt: "2026-09-03T12:00:01.000Z",
    });
    render(<WebSearchComposer notebookId="nb-1" remainingSourceSlots={295} />, {
      wrapper: Wrapper,
    });

    await user.click(await screen.findByRole("button", { name: "Clear results" }));
    const clearingButton = await screen.findByRole("button", { name: "Clearing…" });
    expect((clearingButton as HTMLButtonElement).disabled).toBe(true);
    await user.click(clearingButton);
    expect(mockDismissWebSearchJob).toHaveBeenCalledOnce();

    resolveDismissal?.();
    await waitFor(() => expect(screen.queryByText("1 source found")).toBeNull());
  });
});
