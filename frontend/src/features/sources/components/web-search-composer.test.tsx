import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebSearchComposer } from "./web-search-composer";

const { mockStartWebSearchJob, mockDismissWebSearchJob } = vi.hoisted(() => {
  return {
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

function createWrapper(
  notebookId = "nb-1",
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

  queryClient.setQueryData(["web-search-job", notebookId], initialJob);

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("WebSearchComposer", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockStartWebSearchJob.mockResolvedValue({ id: "job-1", status: "pending" });
    mockDismissWebSearchJob.mockResolvedValue(undefined);
  });

  it("renders no model notice and no model selector", () => {
    const Wrapper = createWrapper("nb-1");
    render(<WebSearchComposer notebookId="nb-1" remainingSourceSlots={295} />, {
      wrapper: Wrapper,
    });

    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText("Choose a model that can search the web")).toBeNull();
    expect(screen.queryByText("Select model")).toBeNull();
    expect(screen.queryByText("No compatible model")).toBeNull();
  });

  it("enables search input and runs search without any model", async () => {
    const user = userEvent.setup();
    const Wrapper = createWrapper("nb-1");
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
      });
    });
  });

  it("shows a persisted failed-job error as-is and dismisses it", async () => {
    const user = userEvent.setup();
    const Wrapper = createWrapper("nb-1", {
      id: "job-failed",
      notebookId: "nb-1",
      query: "Nietzsche",
      status: "failed",
      summary: null,
      candidates: [],
      lastError: "Firecrawl rate limit hit: slow down and retry later.",
      createdAt: "2026-09-03T12:00:00.000Z",
      completedAt: "2026-09-03T12:00:01.000Z",
    });
    render(<WebSearchComposer notebookId="nb-1" remainingSourceSlots={295} />, {
      wrapper: Wrapper,
    });

    expect(await screen.findByText(/slow down and retry later/i)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Clear results" }));
    await waitFor(() => {
      expect(screen.queryByText(/slow down and retry later/i)).toBeNull();
    });
    expect(mockDismissWebSearchJob).toHaveBeenCalledWith("nb-1");
  });

  it("clears persisted results, retains the query, and restores input focus", async () => {
    const user = userEvent.setup();
    mockStartWebSearchJob.mockResolvedValueOnce({
      id: "job-ready",
      notebookId: "nb-1",
      query: "Plato",
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
    const Wrapper = createWrapper("nb-1");
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
    const Wrapper = createWrapper("nb-1", {
      id: "job-ready",
      notebookId: "nb-1",
      query: "Plato",
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
    const Wrapper = createWrapper("nb-1", {
      id: "job-ready",
      notebookId: "nb-1",
      query: "Plato",
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
