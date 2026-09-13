import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import i18n from "@/shared/i18n/i18n";
import notebooksEn from "@/shared/i18n/locales/en/notebooks.json";
import type { Notebook } from "@/features/notebooks/types";
import { libraryQueryOptions, type LibraryFolder, type LibraryResponse } from "../api/library";
import { useLibraryMutations } from "./use-library-mutations";

vi.mock("../api/library", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/library")>();
  return {
    ...actual,
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

import { createLibraryFolder, deleteLibraryFolder, updateLibraryFolder } from "../api/library";
import {
  createNotebook as createNotebookApi,
  deleteNotebook as deleteNotebookApi,
  updateNotebook as updateNotebookApi,
} from "@/features/notebooks/api/notebooks";

beforeAll(() => {
  i18n.addResourceBundle("en", "notebooks", notebooksEn, true, true);
});

beforeEach(() => {
  vi.clearAllMocks();
});

const iso = (day: number) => `2026-01-${String(day).padStart(2, "0")}T00:00:00.000Z`;

function folder(id: string, name: string, parentId: string | null = null): LibraryFolder {
  return { id, name, parentId, createdAt: iso(1), updatedAt: iso(2) };
}

function notebook(id: string, title: string, folderId: string | null = null): Notebook {
  return {
    id,
    title,
    description: "",
    icon: "notebook",
    folderId,
    banner: null,
    bannerUrl: null,
    bannerVariants: null,
    bannerFocalPoint: null,
    createdAt: iso(1),
    updatedAt: iso(2),
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function wrapperFor(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function seedLibrary(client: QueryClient, data: Partial<LibraryResponse> = {}) {
  const full: LibraryResponse = { folders: [], notebooks: [], ...data };
  client.setQueryData(libraryQueryOptions.queryKey, full);
  return full;
}

function readLibrary(client: QueryClient): LibraryResponse {
  const data = client.getQueryData<LibraryResponse>(libraryQueryOptions.queryKey);
  if (!data) throw new Error("library cache missing");
  return data;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("optimistic folder creates", () => {
  it("inserts a temp folder immediately and swaps it for the server row", async () => {
    const client = createQueryClient();
    seedLibrary(client);
    const create = deferred<LibraryFolder>();
    (createLibraryFolder as Mock).mockReturnValue(create.promise);

    const { result } = renderHook(() => useLibraryMutations(), {
      wrapper: wrapperFor(client),
    });

    let tempId = "";
    await act(async () => {
      tempId = result.current.createFolder({ name: "Untitled folder", parentId: null }).tempId;
    });
    expect(readLibrary(client).folders.map((item) => item.id)).toContain(tempId);

    await act(async () => {
      create.resolve(folder("real-1", "Untitled folder"));
      await create.promise;
    });

    await waitFor(() => {
      const ids = readLibrary(client).folders.map((item) => item.id);
      expect(ids).toContain("real-1");
      expect(ids).not.toContain(tempId);
    });
  });

  it("removes the optimistic folder when the create fails", async () => {
    const client = createQueryClient();
    seedLibrary(client);
    (createLibraryFolder as Mock).mockRejectedValue(new Error("create failed"));

    const { result } = renderHook(() => useLibraryMutations(), {
      wrapper: wrapperFor(client),
    });

    let tempId = "";
    act(() => {
      tempId = result.current.createFolder({ name: "Untitled folder", parentId: null }).tempId;
    });

    await waitFor(() => {
      expect(readLibrary(client).folders.some((item) => item.id === tempId)).toBe(false);
    });
  });

  it("dismisses a pending create instantly and deletes it server-side", async () => {
    const client = createQueryClient();
    seedLibrary(client);
    const create = deferred<LibraryFolder>();
    (createLibraryFolder as Mock).mockReturnValue(create.promise);
    (deleteLibraryFolder as Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useLibraryMutations(), {
      wrapper: wrapperFor(client),
    });

    let tempId = "";
    await act(async () => {
      tempId = result.current.createFolder({ name: "Untitled folder", parentId: null }).tempId;
    });
    expect(readLibrary(client).folders.map((item) => item.id)).toContain(tempId);

    await act(async () => {
      void result.current.deleteFolder(tempId);
    });
    expect(readLibrary(client).folders.map((item) => item.id)).not.toContain(tempId);

    await act(async () => {
      create.resolve(folder("real-1", "Untitled folder"));
      await create.promise;
    });
    await waitFor(() => {
      expect(deleteLibraryFolder).toHaveBeenCalledWith("real-1");
    });
  });

  it("queues a rename typed before the create resolves", async () => {
    const client = createQueryClient();
    seedLibrary(client);
    const create = deferred<LibraryFolder>();
    (createLibraryFolder as Mock).mockReturnValue(create.promise);
    (updateLibraryFolder as Mock).mockImplementation(
      async (id: string, input: { name?: string }) =>
        ({ ...folder(id, input.name ?? "Untitled folder"), ...input }) as LibraryFolder,
    );

    const { result } = renderHook(() => useLibraryMutations(), {
      wrapper: wrapperFor(client),
    });

    let tempId = "";
    act(() => {
      tempId = result.current.createFolder({ name: "Untitled folder", parentId: null }).tempId;
    });
    act(() => {
      void result.current.updateFolder(tempId, { name: "Ideas" });
    });
    await act(async () => {
      create.resolve(folder("real-1", "Untitled folder"));
      await create.promise;
    });

    await waitFor(() => {
      expect(updateLibraryFolder).toHaveBeenCalledWith("real-1", { name: "Ideas" });
    });
    await waitFor(() => {
      expect(readLibrary(client).folders[0]?.name).toBe("Ideas");
    });
  });

  it("resolves a temp folder target when moving a notebook", async () => {
    const client = createQueryClient();
    seedLibrary(client, { notebooks: [notebook("n1", "Notebook")] });
    const create = deferred<LibraryFolder>();
    (createLibraryFolder as Mock).mockReturnValue(create.promise);
    (updateNotebookApi as Mock).mockImplementation(
      async (id: string, input: { folderId?: string | null }) =>
        ({ ...notebook(id, "Notebook", input.folderId ?? null), ...input }) as Notebook,
    );

    const { result } = renderHook(() => useLibraryMutations(), {
      wrapper: wrapperFor(client),
    });

    let tempId = "";
    act(() => {
      tempId = result.current.createFolder({ name: "New folder", parentId: null }).tempId;
    });
    act(() => {
      void result.current.updateNotebook("n1", { folderId: tempId });
    });
    await act(async () => {
      create.resolve(folder("real-f", "New folder"));
      await create.promise;
    });

    await waitFor(() => {
      expect(updateNotebookApi).toHaveBeenCalledWith("n1", { folderId: "real-f" });
    });
  });
});

describe("optimistic updates and rollbacks", () => {
  it("rolls back an optimistic folder rename on failure", async () => {
    const client = createQueryClient();
    seedLibrary(client, { folders: [folder("f1", "Original")] });
    (updateLibraryFolder as Mock).mockRejectedValue(new Error("update failed"));

    const { result } = renderHook(() => useLibraryMutations(), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.updateFolder("f1", { name: "Renamed" });
    });

    expect(readLibrary(client).folders.find((item) => item.id === "f1")?.name).toBe("Original");
  });

  it("keeps the notebook detail cache in sync with an optimistic rename", async () => {
    const client = createQueryClient();
    seedLibrary(client, { notebooks: [notebook("n1", "Old title")] });
    client.setQueryData(["notebooks", "n1"], notebook("n1", "Old title"));
    (updateNotebookApi as Mock).mockImplementation(
      async (id: string, input: { title?: string }) =>
        ({ ...notebook(id, input.title ?? "Old title"), ...input }) as Notebook,
    );

    const { result } = renderHook(() => useLibraryMutations(), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.updateNotebook("n1", { title: "New title" });
    });

    const detail = client.getQueryData<Notebook>(["notebooks", "n1"]);
    expect(detail?.title).toBe("New title");
  });

  it("re-parents folder children and notebooks when deleting optimistically", async () => {
    const client = createQueryClient();
    seedLibrary(client, {
      folders: [folder("parent", "Parent"), folder("target", "Target", "parent"), folder("child", "Child", "target")],
      notebooks: [notebook("n1", "Filed", "target")],
    });
    (deleteLibraryFolder as Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useLibraryMutations(), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.deleteFolder("target");
    });

    const data = readLibrary(client);
    expect(data.folders.some((item) => item.id === "target")).toBe(false);
    expect(data.folders.find((item) => item.id === "child")?.parentId).toBe("parent");
    expect(data.notebooks.find((item) => item.id === "n1")?.folderId).toBe("parent");
  });

  it("removes a deleted notebook from the cache and detail queries", async () => {
    const client = createQueryClient();
    seedLibrary(client, { notebooks: [notebook("n1", "Doomed")] });
    client.setQueryData(["notebooks", "n1"], notebook("n1", "Doomed"));
    (deleteNotebookApi as Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useLibraryMutations(), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.deleteNotebook("n1");
    });

    expect(readLibrary(client).notebooks).toHaveLength(0);
    expect(client.getQueryData(["notebooks", "n1"])).toBeUndefined();
  });

  it("removes a failed optimistic notebook create", async () => {
    const client = createQueryClient();
    seedLibrary(client);
    (createNotebookApi as Mock).mockRejectedValue(new Error("create failed"));

    const { result } = renderHook(() => useLibraryMutations(), {
      wrapper: wrapperFor(client),
    });

    let tempId = "";
    act(() => {
      tempId = result.current.createNotebook({ title: "Untitled notebook", folderId: null }).tempId;
    });

    await waitFor(() => {
      expect(readLibrary(client).notebooks.some((item) => item.id === tempId)).toBe(false);
    });
  });
});
