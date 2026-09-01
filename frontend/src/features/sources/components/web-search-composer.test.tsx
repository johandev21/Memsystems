import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotebookModelProvider } from "@/features/notebooks";
import { WebSearchComposer } from "./web-search-composer";

const { sampleModels, mockStartWebSearchJob } = vi.hoisted(() => {
  const models = [
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
  };
});

vi.mock("@/features/sources/api/web-search", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/sources/api/web-search")>();
  return {
    ...actual,
    startWebSearchJob: (...args: unknown[]) => mockStartWebSearchJob(...args),
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

function createWrapper(notebookId = "nb-1", initialModel = "openai/gpt-5.6-sol") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });

  queryClient.setQueryData(["models"], sampleModels);
  queryClient.setQueryData(["web-search-job", notebookId], null);

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
  });

  it("renders without any model selector dropdown", () => {
    const Wrapper = createWrapper("nb-1", "openai/gpt-5.6-sol");
    render(<WebSearchComposer notebookId="nb-1" />, { wrapper: Wrapper });

    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText("Select model")).toBeNull();
    expect(screen.queryByText("No compatible model")).toBeNull();
  });

  it("enables search input and runs search with global model when model supports web search", async () => {
    const user = userEvent.setup();
    const Wrapper = createWrapper("nb-1", "openai/gpt-5.6-sol");
    render(<WebSearchComposer notebookId="nb-1" />, { wrapper: Wrapper });

    const textarea = screen.getByPlaceholderText(
      "Describe the topic, question, or material you need...",
    ) as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(false);

    await user.type(textarea, "Machine learning architectures");

    const sendButton = screen.getByRole("button", { name: "Run web search" }) as HTMLButtonElement;
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

  it("displays unavailable alert and disables search input when selected model does not support web search", async () => {
    const Wrapper = createWrapper("nb-1", "anthropic/claude-3-7-sonnet");
    render(<WebSearchComposer notebookId="nb-1" />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("Web search unavailable")).toBeTruthy();
    });

    const textarea = screen.getByPlaceholderText(
      "Describe the topic, question, or material you need...",
    ) as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(true);

    const sendButton = screen.getByRole("button", { name: "Run web search" }) as HTMLButtonElement;
    expect(sendButton.disabled).toBe(true);
  });
});
