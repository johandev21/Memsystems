import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { SourcesPanel } from "./sources-panel";
import type { Source } from "../api/sources";
import type { SourceFolder } from "../types/source-folder.types";

const notebookId = "nb-sources-test";

function makeSource(overrides: Partial<Source> & Pick<Source, "id" | "title">): Source {
  return {
    notebookId,
    kind: "text",
    url: null,
    contentType: null,
    fileSize: null,
    folderId: null,
    createdAt: "2026-08-11T10:00:00.000Z",
    ...overrides,
  };
}

function makeFolder(overrides: Partial<SourceFolder> & Pick<SourceFolder, "id" | "name">): SourceFolder {
  return {
    notebookId,
    parentId: null,
    createdAt: "2026-08-11T09:00:00.000Z",
    updatedAt: "2026-08-11T09:00:00.000Z",
    ...overrides,
  };
}

function createTestClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

describe("SourcesPanel with Source Folders (#104)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders source folders before sources in stable creation order", async () => {
    const folders: SourceFolder[] = [
      makeFolder({ id: "f2", name: "Folder B", createdAt: "2026-08-11T09:02:00.000Z" }),
      makeFolder({ id: "f1", name: "Folder A", createdAt: "2026-08-11T09:01:00.000Z" }),
    ];
    const sources: Source[] = [
      makeSource({ id: "s1", title: "Source 1", createdAt: "2026-08-11T08:00:00.000Z" }),
    ];

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes(`/api/notebooks/${notebookId}/source-folders`)) {
        return new Response(JSON.stringify(folders), { status: 200 });
      }
      if (url.includes(`/api/notebooks/${notebookId}/sources`)) {
        return new Response(JSON.stringify(sources), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });

    render(
      <QueryClientProvider client={createTestClient()}>
        <SourcesPanel notebookId={notebookId} onSelectSource={vi.fn()} />
      </QueryClientProvider>,
    );

    // Wait for folders and sources to appear
    await waitFor(() => {
      expect(screen.getByText("Folder A")).not.toBeNull();
      expect(screen.getByText("Folder B")).not.toBeNull();
      expect(screen.getByText("Source 1")).not.toBeNull();
    });

    // Check DOM order: Folder A -> Folder B -> Source 1
    const folderA = screen.getByText("Folder A");
    const folderB = screen.getByText("Folder B");
    const source1 = screen.getByText("Source 1");

    expect(folderA.compareDocumentPosition(folderB)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(folderB.compareDocumentPosition(source1)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("toggles expand and collapse per folder and persists per notebook in localStorage", async () => {
    const folders: SourceFolder[] = [
      makeFolder({ id: "parent", name: "Parent Folder" }),
      makeFolder({ id: "child", name: "Nested Child", parentId: "parent" }),
    ];

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes(`/api/notebooks/${notebookId}/source-folders`)) {
        return new Response(JSON.stringify(folders), { status: 200 });
      }
      if (url.includes(`/api/notebooks/${notebookId}/sources`)) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });

    render(
      <QueryClientProvider client={createTestClient()}>
        <SourcesPanel notebookId={notebookId} onSelectSource={vi.fn()} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Parent Folder")).not.toBeNull();
    });

    // Top-level folders are expanded by default
    expect(screen.getByText("Nested Child")).not.toBeNull();

    // Clicking parent folder toggles collapse
    const parentRow = screen.getByText("Parent Folder");
    fireEvent.click(parentRow);

    await waitFor(() => {
      expect(screen.queryByText("Nested Child")).toBeNull();
    });

    // Check localStorage persistence
    const saved = localStorage.getItem(`sources-tree:expanded:${notebookId}`);
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(saved!);
    expect(parsed).not.toContain("parent");

    // Clicking again expands it
    fireEvent.click(parentRow);
    await waitFor(() => {
      expect(screen.getByText("Nested Child")).not.toBeNull();
    });
  });

  it("handles expand-all and collapse-all events", async () => {
    const folders: SourceFolder[] = [
      makeFolder({ id: "f1", name: "Folder 1" }),
      makeFolder({ id: "f2", name: "Folder 2", parentId: "f1" }),
    ];

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes(`/api/notebooks/${notebookId}/source-folders`)) {
        return new Response(JSON.stringify(folders), { status: 200 });
      }
      if (url.includes(`/api/notebooks/${notebookId}/sources`)) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });

    render(
      <QueryClientProvider client={createTestClient()}>
        <SourcesPanel notebookId={notebookId} onSelectSource={vi.fn()} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Folder 1")).not.toBeNull();
      expect(screen.getByText("Folder 2")).not.toBeNull();
    });

    // Trigger collapse-all event
    act(() => {
      window.dispatchEvent(new CustomEvent("sources:collapse-all"));
    });

    await waitFor(() => {
      expect(screen.queryByText("Folder 2")).toBeNull();
    });

    // Trigger expand-all event
    act(() => {
      window.dispatchEvent(new CustomEvent("sources:expand-all"));
    });

    await waitFor(() => {
      expect(screen.getByText("Folder 2")).not.toBeNull();
    });
  });

  it("creates a source folder at root when create-folder event is received", async () => {
    let foldersList: SourceFolder[] = [];
    const postSpy = vi.fn(async (body: string) => {
      const parsed = JSON.parse(body);
      const newFolder = makeFolder({ id: "new-f1", name: parsed.name, parentId: parsed.parentId });
      foldersList = [newFolder];
      return newFolder;
    });

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes(`/api/notebooks/${notebookId}/source-folders`)) {
        if (init?.method === "POST") {
          const newFolder = await postSpy(init.body as string);
          return new Response(JSON.stringify(newFolder), { status: 201 });
        }
        return new Response(JSON.stringify(foldersList), { status: 200 });
      }
      if (url.includes(`/api/notebooks/${notebookId}/sources`)) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });

    render(
      <QueryClientProvider client={createTestClient()}>
        <SourcesPanel notebookId={notebookId} onSelectSource={vi.fn()} />
      </QueryClientProvider>,
    );

    // Dispatch create-folder event
    act(() => {
      window.dispatchEvent(new CustomEvent("sources:create-folder"));
    });

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledTimes(1);
    });

    const callArg = JSON.parse(postSpy.mock.calls[0][0]);
    expect(callArg.parentId).toBeNull();
    expect(callArg.name).toBe("Untitled folder");
  });

  it("keeps existing source interactions working (select, delete dialog)", async () => {
    const source = makeSource({ id: "s-test", title: "Test Doc" });
    const onSelect = vi.fn();

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes(`/api/notebooks/${notebookId}/source-folders`)) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.includes(`/api/notebooks/${notebookId}/sources`)) {
        return new Response(JSON.stringify([source]), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });

    render(
      <QueryClientProvider client={createTestClient()}>
        <SourcesPanel notebookId={notebookId} onSelectSource={onSelect} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Test Doc")).not.toBeNull();
    });

    // Clicking source selects it
    fireEvent.click(screen.getByText("Test Doc"));
    expect(onSelect).toHaveBeenCalledWith("s-test");

    // Clicking delete opens confirmation dialog
    const deleteBtn = screen.getByRole("button", { name: "Delete source" });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByText('Are you sure you want to delete "Test Doc"?')).not.toBeNull();
    });
  });

  describe("Source filing and moving (#105)", () => {
    it("moves a source into a folder via row context menu", async () => {
      const folders: SourceFolder[] = [
        makeFolder({ id: "f-target", name: "Target Folder" }),
      ];
      const sources: Source[] = [
        makeSource({ id: "s-1", title: "Moveable Source", folderId: null }),
      ];

      const patchSpy = vi.fn(async (body: string) => {
        const parsed = JSON.parse(body);
        return { ...sources[0], folderId: parsed.folderId };
      });

      globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes(`/api/notebooks/${notebookId}/source-folders`)) {
          return new Response(JSON.stringify(folders), { status: 200 });
        }
        if (url.includes(`/api/sources/s-1/move`)) {
          if (init?.method === "PATCH") {
            const updated = await patchSpy(init.body as string);
            return new Response(JSON.stringify(updated), { status: 200 });
          }
        }
        if (url.includes(`/api/notebooks/${notebookId}/sources`)) {
          return new Response(JSON.stringify(sources), { status: 200 });
        }
        return new Response("{}", { status: 200 });
      });

      render(
        <QueryClientProvider client={createTestClient()}>
          <SourcesPanel notebookId={notebookId} onSelectSource={vi.fn()} />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("Moveable Source")).not.toBeNull();
      });

      // Right-click on source row to open ContextMenu
      const sourceElement = screen.getByText("Moveable Source");
      fireEvent.contextMenu(sourceElement);

      // Verify "Move to Sources root" is not visible since source is already at root
      expect(screen.queryByText("Move to Sources root")).toBeNull();

      // Find "Move to folder" submenu trigger
      const moveToFolderTrigger = await screen.findByText("Move to folder");
      expect(moveToFolderTrigger).not.toBeNull();

      fireEvent.pointerEnter(moveToFolderTrigger);
      fireEvent.click(moveToFolderTrigger);

      // Submenu should contain "Target Folder"
      const targetFolderMenuItem = await screen.findByRole("menuitem", { name: /Target Folder/i });
      fireEvent.click(targetFolderMenuItem);

      await waitFor(() => {
        expect(patchSpy).toHaveBeenCalledTimes(1);
      });

      const parsedBody = JSON.parse(patchSpy.mock.calls[0][0]);
      expect(parsedBody.folderId).toBe("f-target");
    });

    it("moves a source from a folder back to root via row menu action", async () => {
      const folders: SourceFolder[] = [
        makeFolder({ id: "f-parent", name: "Parent Folder" }),
      ];
      const sources: Source[] = [
        makeSource({ id: "s-nested", title: "Nested Source", folderId: "f-parent" }),
      ];

      const patchSpy = vi.fn(async (body: string) => {
        const parsed = JSON.parse(body);
        return { ...sources[0], folderId: parsed.folderId };
      });

      globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes(`/api/notebooks/${notebookId}/source-folders`)) {
          return new Response(JSON.stringify(folders), { status: 200 });
        }
        if (url.includes(`/api/sources/s-nested/move`)) {
          if (init?.method === "PATCH") {
            const updated = await patchSpy(init.body as string);
            return new Response(JSON.stringify(updated), { status: 200 });
          }
        }
        if (url.includes(`/api/notebooks/${notebookId}/sources`)) {
          return new Response(JSON.stringify(sources), { status: 200 });
        }
        return new Response("{}", { status: 200 });
      });

      render(
        <QueryClientProvider client={createTestClient()}>
          <SourcesPanel notebookId={notebookId} onSelectSource={vi.fn()} />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("Nested Source")).not.toBeNull();
      });

      // Right-click on nested source row
      const sourceElement = screen.getByText("Nested Source");
      fireEvent.contextMenu(sourceElement);

      // "Move to Sources root" should be visible because source has folderId !== null
      const moveToRootItem = await screen.findByText("Move to Sources root");
      fireEvent.click(moveToRootItem);

      await waitFor(() => {
        expect(patchSpy).toHaveBeenCalledTimes(1);
      });

      const parsedBody = JSON.parse(patchSpy.mock.calls[0][0]);
      expect(parsedBody.folderId).toBeNull();
    });

    it("optimistically updates and rolls back with toast on failure", async () => {
      const toastErrorSpy = vi.spyOn(toast, "error");
      const folders: SourceFolder[] = [
        makeFolder({ id: "f-1", name: "Folder 1" }),
      ];
      const sources: Source[] = [
        makeSource({ id: "s-fail", title: "Failing Source", folderId: null }),
      ];

      globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes(`/api/notebooks/${notebookId}/source-folders`)) {
          return new Response(JSON.stringify(folders), { status: 200 });
        }
        if (url.includes(`/api/sources/s-fail/move`)) {
          if (init?.method === "PATCH") {
            return new Response(JSON.stringify({ error: "Server error" }), { status: 500 });
          }
        }
        if (url.includes(`/api/notebooks/${notebookId}/sources`)) {
          return new Response(JSON.stringify(sources), { status: 200 });
        }
        return new Response("{}", { status: 200 });
      });

      render(
        <QueryClientProvider client={createTestClient()}>
          <SourcesPanel notebookId={notebookId} onSelectSource={vi.fn()} />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("Failing Source")).not.toBeNull();
      });

      // Open context menu and trigger move
      fireEvent.contextMenu(screen.getByText("Failing Source"));
      const moveToFolderTrigger = await screen.findByText("Move to folder");
      fireEvent.pointerEnter(moveToFolderTrigger);
      fireEvent.click(moveToFolderTrigger);

      const targetFolderItem = await screen.findByRole("menuitem", { name: /Folder 1/i });
      fireEvent.click(targetFolderItem);

      await waitFor(() => {
        expect(toastErrorSpy).toHaveBeenCalledWith("Server error");
      });
    });

    it("refuses moving a folder into its descendant in folder row menu", async () => {
      const folders: SourceFolder[] = [
        makeFolder({ id: "f-parent", name: "Parent Folder", parentId: null }),
        makeFolder({ id: "f-child", name: "Child Folder", parentId: "f-parent" }),
      ];

      globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes(`/api/notebooks/${notebookId}/source-folders`)) {
          return new Response(JSON.stringify(folders), { status: 200 });
        }
        if (url.includes(`/api/notebooks/${notebookId}/sources`)) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        return new Response("{}", { status: 200 });
      });

      render(
        <QueryClientProvider client={createTestClient()}>
          <SourcesPanel notebookId={notebookId} onSelectSource={vi.fn()} />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("Parent Folder")).not.toBeNull();
      });

      // Right-click on Parent Folder
      fireEvent.contextMenu(screen.getByText("Parent Folder"));

      // Parent folder has only 1 other folder (Child Folder), which is its descendant!
      // Therefore, movableFolders is empty for Parent Folder, so "Move to folder" is not even shown.
      expect(screen.queryByText("Move to folder")).toBeNull();
    });
  });
});

