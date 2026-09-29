import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("handles expand-all and collapse-all via context menu", async () => {
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

    const user = userEvent.setup();
    render(
      <QueryClientProvider client={createTestClient()}>
        <SourcesPanel notebookId={notebookId} onSelectSource={vi.fn()} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Folder 1")).not.toBeNull();
      expect(screen.getByText("Folder 2")).not.toBeNull();
    });

    // Trigger collapse-all via right-click menu
    fireEvent.contextMenu(screen.getByText("Folder 1"));
    await user.click(await screen.findByRole("menuitem", { name: /Collapse all/i }));

    await waitFor(() => {
      expect(screen.queryByText("Folder 2")).toBeNull();
    });

    // Trigger expand-all via right-click menu
    fireEvent.contextMenu(screen.getByText("Folder 1"));
    await user.click(await screen.findByRole("menuitem", { name: /Expand all/i }));

    await waitFor(() => {
      expect(screen.getByText("Folder 2")).not.toBeNull();
    });
  });

  it("creates a source folder at root via context menu", async () => {
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

    const user = userEvent.setup();
    render(
      <QueryClientProvider client={createTestClient()}>
        <SourcesPanel notebookId={notebookId} onSelectSource={vi.fn()} />
      </QueryClientProvider>,
    );

    // Create folder via right-click menu on panel content
    await waitFor(() => {
      expect(document.querySelector('[data-slot="sources-panel-content"]')).not.toBeNull();
    });
    const panelContent = document.querySelector('[data-slot="sources-panel-content"]') as HTMLElement;
    fireEvent.contextMenu(panelContent);
    await user.click(await screen.findByRole("menuitem", { name: /New folder/i }));

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

  describe("Rename, delete, menus, header actions (#106)", () => {
    it("renames a folder inline with Enter, commits via PATCH, and updates UI", async () => {
      const folders: SourceFolder[] = [
        makeFolder({ id: "f-1", name: "Original Folder" }),
      ];

      const patchSpy = vi.fn(async (body: string) => {
        const parsed = JSON.parse(body);
        return { ...folders[0], name: parsed.name };
      });

      globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes(`/api/source-folders/f-1`)) {
          if (init?.method === "PATCH") {
            const updated = await patchSpy(init.body as string);
            return new Response(JSON.stringify(updated), { status: 200 });
          }
        }
        if (url.includes(`/api/notebooks/${notebookId}/source-folders`)) {
          return new Response(JSON.stringify(folders), { status: 200 });
        }
        if (url.includes(`/api/notebooks/${notebookId}/sources`)) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        return new Response("{}", { status: 200 });
      });

      const user = userEvent.setup();

      render(
        <QueryClientProvider client={createTestClient()}>
          <SourcesPanel notebookId={notebookId} onSelectSource={vi.fn()} />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("Original Folder")).not.toBeNull();
      });

      // Right-click folder to open ContextMenu
      fireEvent.contextMenu(screen.getByText("Original Folder"));

      const renameMenuItem = await screen.findByRole("menuitem", { name: /Rename/i });
      await user.click(renameMenuItem);

      // Inline rename input should appear
      const renameInput = await screen.findByDisplayValue("Original Folder");
      expect(renameInput).not.toBeNull();

      // Change input value and press Enter
      fireEvent.change(renameInput, { target: { value: "Updated Folder" } });
      fireEvent.keyDown(renameInput, { key: "Enter" });

      await waitFor(() => {
        expect(patchSpy).toHaveBeenCalledTimes(1);
      });

      const parsedBody = JSON.parse(patchSpy.mock.calls[0][0]);
      expect(parsedBody.name).toBe("Updated Folder");
    });

    it("cancels folder rename on Escape without making a PATCH request", async () => {
      const folders: SourceFolder[] = [
        makeFolder({ id: "f-esc", name: "Folder Escape" }),
      ];

      const patchSpy = vi.fn();

      globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes(`/api/source-folders/f-esc`)) {
          if (init?.method === "PATCH") {
            patchSpy();
            return new Response("{}", { status: 200 });
          }
        }
        if (url.includes(`/api/notebooks/${notebookId}/source-folders`)) {
          return new Response(JSON.stringify(folders), { status: 200 });
        }
        if (url.includes(`/api/notebooks/${notebookId}/sources`)) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        return new Response("{}", { status: 200 });
      });

      const user = userEvent.setup();

      render(
        <QueryClientProvider client={createTestClient()}>
          <SourcesPanel notebookId={notebookId} onSelectSource={vi.fn()} />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("Folder Escape")).not.toBeNull();
      });

      fireEvent.contextMenu(screen.getByText("Folder Escape"));
      const renameMenuItem = await screen.findByRole("menuitem", { name: /Rename/i });
      await user.click(renameMenuItem);

      const renameInput = await screen.findByDisplayValue("Folder Escape");
      fireEvent.change(renameInput, { target: { value: "Should Not Commit" } });
      fireEvent.keyDown(renameInput, { key: "Escape" });

      expect(patchSpy).not.toHaveBeenCalled();
      expect(screen.getByText("Folder Escape")).not.toBeNull();
    });

    it("no-ops folder rename when value is empty or unchanged", async () => {
      const folders: SourceFolder[] = [
        makeFolder({ id: "f-noop", name: "Unchanged Name" }),
      ];

      const patchSpy = vi.fn();

      globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes(`/api/source-folders/f-noop`) && init?.method === "PATCH") {
          patchSpy();
          return new Response("{}", { status: 200 });
        }
        if (url.includes(`/api/notebooks/${notebookId}/source-folders`)) {
          return new Response(JSON.stringify(folders), { status: 200 });
        }
        if (url.includes(`/api/notebooks/${notebookId}/sources`)) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        return new Response("{}", { status: 200 });
      });

      const user = userEvent.setup();

      render(
        <QueryClientProvider client={createTestClient()}>
          <SourcesPanel notebookId={notebookId} onSelectSource={vi.fn()} />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("Unchanged Name")).not.toBeNull();
      });

      // 1. Commit same value
      fireEvent.contextMenu(screen.getByText("Unchanged Name"));
      let renameMenuItem = await screen.findByRole("menuitem", { name: /Rename/i });
      await user.click(renameMenuItem);

      let renameInput = await screen.findByDisplayValue("Unchanged Name");
      fireEvent.keyDown(renameInput, { key: "Enter" });
      expect(patchSpy).not.toHaveBeenCalled();

      // 2. Commit all-whitespace value
      fireEvent.contextMenu(screen.getByText("Unchanged Name"));
      renameMenuItem = await screen.findByRole("menuitem", { name: /Rename/i });
      await user.click(renameMenuItem);

      renameInput = await screen.findByDisplayValue("Unchanged Name");
      fireEvent.change(renameInput, { target: { value: "   " } });
      fireEvent.keyDown(renameInput, { key: "Enter" });
      expect(patchSpy).not.toHaveBeenCalled();
    });

    it("renames a source inline with Enter, commits via PATCH, and updates UI", async () => {
      const sources: Source[] = [
        makeSource({ id: "s-rename", title: "Original Source Title" }),
      ];

      const patchSpy = vi.fn(async (body: string) => {
        const parsed = JSON.parse(body);
        return { ...sources[0], title: parsed.title };
      });

      globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes(`/api/sources/s-rename`) && init?.method === "PATCH") {
          const updated = await patchSpy(init.body as string);
          return new Response(JSON.stringify(updated), { status: 200 });
        }
        if (url.includes(`/api/notebooks/${notebookId}/source-folders`)) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        if (url.includes(`/api/notebooks/${notebookId}/sources`)) {
          return new Response(JSON.stringify(sources), { status: 200 });
        }
        return new Response("{}", { status: 200 });
      });

      const user = userEvent.setup();

      render(
        <QueryClientProvider client={createTestClient()}>
          <SourcesPanel notebookId={notebookId} onSelectSource={vi.fn()} />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("Original Source Title")).not.toBeNull();
      });

      // Right-click source row
      fireEvent.contextMenu(screen.getByText("Original Source Title"));

      const renameMenuItem = await screen.findByRole("menuitem", { name: /Rename/i });
      await user.click(renameMenuItem);

      const renameInput = await screen.findByDisplayValue("Original Source Title");
      fireEvent.change(renameInput, { target: { value: "Updated Source Title" } });
      fireEvent.keyDown(renameInput, { key: "Enter" });

      await waitFor(() => {
        expect(patchSpy).toHaveBeenCalledTimes(1);
      });

      const parsedBody = JSON.parse(patchSpy.mock.calls[0][0]);
      expect(parsedBody.title).toBe("Updated Source Title");
    });

    it("deletes a folder and reparents direct sources to root", async () => {
      const folders: SourceFolder[] = [
        makeFolder({ id: "f-del", name: "Folder To Delete" }),
      ];
      const sources: Source[] = [
        makeSource({ id: "s-in-del", title: "Nested Source Doc", folderId: "f-del" }),
      ];

      const deleteSpy = vi.fn();

      let currentFolders = [...folders];
      let currentSources = [...sources];

      globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes(`/api/source-folders/f-del`)) {
          if (init?.method === "DELETE") {
            deleteSpy();
            currentFolders = [];
            currentSources = currentSources.map((s) => ({ ...s, folderId: null }));
            return new Response("{}", { status: 200 });
          }
        }
        if (url.includes(`/api/notebooks/${notebookId}/source-folders`)) {
          return new Response(JSON.stringify(currentFolders), { status: 200 });
        }
        if (url.includes(`/api/notebooks/${notebookId}/sources`)) {
          return new Response(JSON.stringify(currentSources), { status: 200 });
        }
        return new Response("{}", { status: 200 });
      });

      const user = userEvent.setup();

      render(
        <QueryClientProvider client={createTestClient()}>
          <SourcesPanel notebookId={notebookId} onSelectSource={vi.fn()} />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("Folder To Delete")).not.toBeNull();
        expect(screen.getByText("Nested Source Doc")).not.toBeNull();
      });

      // Right-click folder to delete it
      fireEvent.contextMenu(screen.getByText("Folder To Delete"));

      const deleteMenuItem = await screen.findByRole("menuitem", { name: /Delete/i });
      await user.click(deleteMenuItem);

      await waitFor(() => {
        expect(deleteSpy).toHaveBeenCalledTimes(1);
      });

      // Optimistic update: folder is removed from DOM, source persists and remains visible!
      await waitFor(() => {
        expect(screen.queryByText("Folder To Delete")).toBeNull();
        expect(screen.getByText("Nested Source Doc")).not.toBeNull();
      });
    });

    it("renders per-row context menu items for folder and source", async () => {
      const folders: SourceFolder[] = [
        makeFolder({ id: "f-row", name: "My Folder" }),
      ];
      const sources: Source[] = [
        makeSource({ id: "s-row", title: "My Document", folderId: "f-row" }),
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

      await waitFor(() => {
        expect(screen.getByText("My Folder")).not.toBeNull();
        expect(screen.getByText("My Document")).not.toBeNull();
      });

      // Check folder context menu
      fireEvent.contextMenu(screen.getByText("My Folder"));
      expect(await screen.findByRole("menuitem", { name: /Rename/i })).not.toBeNull();
      expect(screen.getByRole("menuitem", { name: /^Collapse$/i })).not.toBeNull();
      expect(screen.getByRole("menuitem", { name: /New subfolder/i })).not.toBeNull();
      expect(screen.getByRole("menuitem", { name: /Delete/i })).not.toBeNull();

      // Close context menu by clicking outside / pressing Escape
      fireEvent.keyDown(document.body, { key: "Escape" });

      // Check source context menu
      fireEvent.contextMenu(screen.getByText("My Document"));
      expect(await screen.findByRole("menuitem", { name: /Rename/i })).not.toBeNull();
      expect(screen.getByRole("menuitem", { name: /Move to Sources root/i })).not.toBeNull();
      expect(screen.getByRole("menuitem", { name: /Delete/i })).not.toBeNull();
    });
  });

  describe("Keyboard navigation and ARIA semantics (#107)", () => {
    function mockTreeFetch(folders: SourceFolder[], sources: Source[]) {
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
    }

    function treeFixture() {
      const folders: SourceFolder[] = [makeFolder({ id: "f-parent", name: "Parent Folder" })];
      const sources: Source[] = [
        makeSource({ id: "s-in-parent", title: "Nested Doc", folderId: "f-parent" }),
        makeSource({ id: "s-root", title: "Root Doc" }),
      ];
      return { folders, sources };
    }

    function renderTreePanel() {
      render(
        <QueryClientProvider client={createTestClient()}>
          <SourcesPanel notebookId={notebookId} onSelectSource={vi.fn()} />
        </QueryClientProvider>,
      );
    }

    function treeitemFor(text: string): HTMLElement {
      const el = screen.getByText(text).closest('[role="treeitem"]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    }

    async function renderTree() {
      const { folders, sources } = treeFixture();
      mockTreeFetch(folders, sources);
      renderTreePanel();

      await waitFor(() => {
        expect(screen.getByText("Parent Folder")).not.toBeNull();
        expect(screen.getByText("Nested Doc")).not.toBeNull();
        expect(screen.getByText("Root Doc")).not.toBeNull();
      });
    }

    it("exposes role=tree/treeitem with correct aria-level and aria-expanded", async () => {
      await renderTree();

      expect(screen.getByRole("tree")).not.toBeNull();
      expect(screen.getAllByRole("treeitem")).toHaveLength(3);

      expect(treeitemFor("Parent Folder").getAttribute("aria-level")).toBe("1");
      expect(treeitemFor("Nested Doc").getAttribute("aria-level")).toBe("2");
      expect(treeitemFor("Root Doc").getAttribute("aria-level")).toBe("1");
      expect(treeitemFor("Parent Folder").getAttribute("aria-expanded")).toBe("true");
    });

    it("moves focus with ArrowDown and ArrowUp", async () => {
      await renderTree();

      fireEvent.keyDown(treeitemFor("Parent Folder"), { key: "ArrowDown" });
      expect(document.activeElement).toBe(treeitemFor("Nested Doc"));

      fireEvent.keyDown(treeitemFor("Nested Doc"), { key: "ArrowUp" });
      expect(document.activeElement).toBe(treeitemFor("Parent Folder"));
    });

    it("toggles a folder open/closed with Enter", async () => {
      await renderTree();

      fireEvent.keyDown(treeitemFor("Parent Folder"), { key: "Enter" });

      await waitFor(() => {
        expect(screen.queryByText("Nested Doc")).toBeNull();
      });
      expect(treeitemFor("Parent Folder").getAttribute("aria-expanded")).toBe("false");

      fireEvent.keyDown(treeitemFor("Parent Folder"), { key: "Enter" });

      await waitFor(() => {
        expect(screen.getByText("Nested Doc")).not.toBeNull();
      });
      expect(treeitemFor("Parent Folder").getAttribute("aria-expanded")).toBe("true");
    });

    it("marks the focused row with aria-selected", async () => {
      await renderTree();

      fireEvent.keyDown(treeitemFor("Parent Folder"), { key: "ArrowDown" });

      await waitFor(() => {
        expect(treeitemFor("Nested Doc").getAttribute("aria-selected")).toBe("true");
      });
      expect(treeitemFor("Parent Folder").getAttribute("aria-selected")).toBe("false");
    });

    it("begins rename with F2", async () => {
      await renderTree();

      fireEvent.keyDown(treeitemFor("Parent Folder"), { key: "F2" });

      expect(await screen.findByDisplayValue("Parent Folder")).not.toBeNull();
    });
  });

  describe("Cutover with status parity and flat-list removal (#108)", () => {
    function mockSourcesFetch(folders: SourceFolder[], sources: Source[]) {
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
    }

    it("renders folder-less notebooks as a tree (flat list removed)", async () => {
      const sources: Source[] = [
        makeSource({ id: "s-1", title: "First Doc" }),
        makeSource({ id: "s-2", title: "Second Doc" }),
      ];
      mockSourcesFetch([], sources);

      render(
        <QueryClientProvider client={createTestClient()}>
          <SourcesPanel notebookId={notebookId} onSelectSource={vi.fn()} />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("First Doc")).not.toBeNull();
        expect(screen.getByText("Second Doc")).not.toBeNull();
      });

      expect(screen.getByRole("tree")).not.toBeNull();
      const items = screen.getAllByRole("treeitem");
      expect(items).toHaveLength(2);
      for (const item of items) {
        expect(item.getAttribute("aria-level")).toBe("1");
      }
    });

    it("keeps processing, degraded, and failed status actions inside the tree", async () => {
      const folders: SourceFolder[] = [makeFolder({ id: "f-1", name: "Folder" })];
      const sources: Source[] = [
        makeSource({
          id: "s-processing",
          title: "Indexing Doc",
          folderId: "f-1",
          processingStatus: "processing",
          processingStage: "indexing",
        }),
        makeSource({
          id: "s-degraded",
          title: "Paywalled Doc",
          folderId: "f-1",
          processingStatus: "degraded",
          processingErrorCode: "quality_paywall",
        }),
        makeSource({
          id: "s-failed",
          title: "Broken Doc",
          folderId: "f-1",
          processingStatus: "failed",
          processingErrorMessage: "Extraction crashed",
        }),
      ];
      mockSourcesFetch(folders, sources);

      render(
        <QueryClientProvider client={createTestClient()}>
          <SourcesPanel notebookId={notebookId} onSelectSource={vi.fn()} />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("Indexing Doc")).not.toBeNull();
        expect(screen.getByText("Paywalled Doc")).not.toBeNull();
        expect(screen.getByText("Broken Doc")).not.toBeNull();
      });

      // All rows are treeitems even with statuses attached
      expect(screen.getAllByRole("treeitem")).toHaveLength(4);
      // Processing stage label, degraded reason, and failed error stay visible
      expect(screen.getByText("Indexing source…")).not.toBeNull();
      expect(
        screen.getByText(
          "This source is mostly a paywall or sign-in message. · Paste the text you can access or import the file version.",
        ),
      ).not.toBeNull();
      expect(screen.getByText("Processing failed")).not.toBeNull();
      expect(screen.getByTitle("Extraction crashed")).not.toBeNull();
      // Retry/cancel row actions stay intact
      expect(
        screen.getByRole("button", { name: "Cancel source processing" }),
      ).not.toBeNull();
      expect(screen.getByRole("button", { name: "Retry source processing" })).not.toBeNull();
    });

    it("retries failed loads from the error state", async () => {
      const sources: Source[] = [makeSource({ id: "s-1", title: "Recovered Doc" })];
      let failuresRemaining = 1;
      const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (failuresRemaining > 0) {
          failuresRemaining -= 1;
          return new Response(JSON.stringify({ error: "boom" }), { status: 500 });
        }
        if (url.includes(`/api/notebooks/${notebookId}/source-folders`)) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        if (url.includes(`/api/notebooks/${notebookId}/sources`)) {
          return new Response(JSON.stringify(sources), { status: 200 });
        }
        return new Response("{}", { status: 200 });
      });
      globalThis.fetch = fetchSpy;

      render(
        <QueryClientProvider client={createTestClient()}>
          <SourcesPanel notebookId={notebookId} onSelectSource={vi.fn()} />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByRole("alert")).not.toBeNull();
      });

      fireEvent.click(screen.getByRole("button", { name: "Retry" }));

      await waitFor(() => {
        expect(screen.getByText("Recovered Doc")).not.toBeNull();
      });
      expect(fetchSpy).toHaveBeenCalled();
    });

    it("virtualizes notebooks with 25+ sources over the visible tree", async () => {
      // jsdom reports zero layout size, which collapses TanStack Virtual's
      // window; stub element geometry so rows measure like in a browser.
      vi.spyOn(window.HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(40);
      vi.spyOn(window.HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(800);

      const sources: Source[] = Array.from({ length: 30 }, (_, i) =>
        makeSource({ id: `s-${i}`, title: `Doc ${i}` }),
      );
      mockSourcesFetch([], sources);

      render(
        <QueryClientProvider client={createTestClient()}>
          <SourcesPanel notebookId={notebookId} onSelectSource={vi.fn()} />
        </QueryClientProvider>,
      );

      // The tree renders a virtual window, not the flat full list: a subset
      // of rows is mounted as treeitems inside the estimated total spacer.
      await waitFor(() => {
        expect(screen.getAllByRole("treeitem").length).toBeGreaterThan(0);
      });
      const items = screen.getAllByRole("treeitem");
      expect(items.length).toBeLessThan(30);
      for (const item of items) {
        expect(item.getAttribute("aria-level")).toBe("1");
      }
      const virtualWindow = document.querySelector(
        '[data-slot="sources-tree-virtual-window"]',
      ) as HTMLElement;
      expect(screen.getByRole("tree").contains(virtualWindow)).toBe(true);
      // 30 visible rows × 40px measured rows
      expect(virtualWindow.style.getPropertyValue("--virtual-total")).toBe("1200px");
    });
  });
});


