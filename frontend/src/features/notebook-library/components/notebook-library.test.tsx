import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { LibraryFolder } from "../api/library";
import { createLibraryFolder } from "../api/library";
import { NotebookLibrary } from "./notebook-library";

vi.mock("../hooks/use-fitted-folder-title", () => ({
  useFittedFolderTitle: () => 29.4,
}));

vi.mock("../api/library", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/library")>();
  return {
    ...actual,
    libraryQueryOptions: {
      queryKey: ["library"],
      queryFn: async () => ({ folders: [], notebooks: [] }),
    },
    createLibraryFolder: vi.fn(),
    updateLibraryFolder: vi.fn(),
    deleteLibraryFolder: vi.fn(),
  };
});

vi.mock("@/features/notebooks/api/notebooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/notebooks/api/notebooks")>();
  return {
    ...actual,
    createNotebook: vi.fn(),
    updateNotebook: vi.fn(),
    deleteNotebook: vi.fn(),
  };
});

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...actual, useNavigate: () => vi.fn() };
});

beforeEach(() => {
  vi.clearAllMocks();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

describe("NotebookLibrary create flow", () => {
  it("focuses a new folder and keeps it selected after the server row arrives", async () => {
    const user = userEvent.setup();
    const create = deferred<LibraryFolder>();
    (createLibraryFolder as Mock).mockReturnValue(create.promise);
    const client = createQueryClient();

    render(
      <QueryClientProvider client={client}>
        <NotebookLibrary />
      </QueryClientProvider>,
    );

    await screen.findByText("No notebooks yet");

    await user.click(screen.getByRole("button", { name: "Create" }));
    await user.click(await screen.findByRole("menuitem", { name: /Folder/ }));

    const input = (await screen.findByRole("textbox")) as HTMLInputElement;
    expect(document.activeElement).toBe(input);

    await act(async () => {
      create.resolve({
        id: "server-folder",
        name: "Untitled folder",
        parentId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });
      await create.promise;
    });

    expect(screen.getByRole("textbox")).toBe(input);
    expect(document.activeElement).toBe(input);
    await waitFor(() => {
      expect(
        screen
          .getByRole("button", { name: "Untitled folder, 0 notebooks" })
          .getAttribute("data-selected"),
      ).toBe("true");
    });
  });
});
