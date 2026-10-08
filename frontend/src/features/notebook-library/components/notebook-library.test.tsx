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

let mockLibraryData = { folders: [] as LibraryFolder[], notebooks: [] as any[] };

vi.mock("../api/library", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/library")>();
  return {
    ...actual,
    libraryQueryOptions: {
      queryKey: ["library"],
      queryFn: async () => mockLibraryData,
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

const mockNavigate = vi.fn();
let mockSearch: Record<string, unknown> = {};

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearch: () => mockSearch,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mockSearch = {};
  mockLibraryData = { folders: [], notebooks: [] };
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

    await screen.findAllByText("No notebooks yet");

    await user.click(screen.getAllByRole("button", { name: "Create" })[0]);
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

describe("NotebookLibrary URL navigation and history", () => {
  it("navigates into a folder with replace: false (history push)", async () => {
    const user = userEvent.setup();
    mockLibraryData = {
      folders: [
        {
          id: "folder-1",
          name: "Algorithms",
          parentId: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      notebooks: [],
    };
    const client = createQueryClient();

    render(
      <QueryClientProvider client={client}>
        <NotebookLibrary />
      </QueryClientProvider>,
    );

    const folderCard = await screen.findByRole("button", {
      name: "Algorithms, 0 notebooks",
    });

    await user.dblClick(folderCard);

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/",
      search: expect.any(Function),
      replace: false,
    });

    const searchFn = mockNavigate.mock.calls[0][0].search;
    expect(searchFn({})).toEqual({ folderId: "folder-1" });
  });

  it("cleans up invalid folderId in URL search params once data loads", async () => {
    mockSearch = { folderId: "nonexistent-folder" };
    mockLibraryData = {
      folders: [
        {
          id: "folder-1",
          name: "Algorithms",
          parentId: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      notebooks: [],
    };
    const client = createQueryClient();

    render(
      <QueryClientProvider client={client}>
        <NotebookLibrary />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/",
        search: expect.any(Function),
        replace: true,
      });
    });

    const matchingCall = mockNavigate.mock.calls.find(
      (call) => call[0].replace === true,
    );
    expect(matchingCall).toBeDefined();
    const searchFn = matchingCall![0].search;
    expect(searchFn({ folderId: "nonexistent-folder" })).toEqual({
      folderId: undefined,
    });
  });

  it("updates sort order in place with replace: true", async () => {
    const user = userEvent.setup();
    mockLibraryData = {
      folders: [
        {
          id: "folder-1",
          name: "Algorithms",
          parentId: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      notebooks: [],
    };
    const client = createQueryClient();

    render(
      <QueryClientProvider client={client}>
        <NotebookLibrary />
      </QueryClientProvider>,
    );

    const sortTriggers = await screen.findAllByRole("combobox", {
      name: "Sort library",
    });
    const sortTrigger = sortTriggers[0];
    await user.click(sortTrigger);

    const updatedAtOption = await screen.findByRole("option", {
      name: /Last modified/,
    });
    await user.click(updatedAtOption);

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/",
      search: expect.any(Function),
      replace: true,
    });

    const searchFn = mockNavigate.mock.calls[0][0].search;
    expect(searchFn({})).toEqual({ sort: "updatedAt" });
  });

  it("navigates to ancestor folders via breadcrumbs with history push", async () => {
    const user = userEvent.setup();
    mockSearch = { folderId: "subfolder-1" };
    mockLibraryData = {
      folders: [
        {
          id: "parent-1",
          name: "Parent",
          parentId: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "subfolder-1",
          name: "Child",
          parentId: "parent-1",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      notebooks: [],
    };
    const client = createQueryClient();

    render(
      <QueryClientProvider client={client}>
        <NotebookLibrary />
      </QueryClientProvider>,
    );

    await screen.findAllByRole("heading", { name: "Child" });

    const parentCrumb = screen.getByRole("button", { name: "Parent" });
    await user.click(parentCrumb);

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/",
      search: expect.any(Function),
      replace: false,
    });

    const searchFn = mockNavigate.mock.calls[0][0].search;
    expect(searchFn({ folderId: "subfolder-1" })).toEqual({
      folderId: "parent-1",
    });
  });
});

