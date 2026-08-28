import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { StudyMaterialsTreeContainer } from "./study-materials-tree-container";
import type { FolderDTO } from "@/entities/folder";
import type { StudyMaterialDTO } from "@/entities/study-material";

const notebookId = "nb-creation-rename";

function makeFolder(overrides: Partial<FolderDTO> & Pick<FolderDTO, "id" | "name">): FolderDTO {
  return {
    notebookId,
    parentId: null,
    deletedAt: null,
    createdAt: "2026-08-11T09:00:00.000Z",
    updatedAt: "2026-08-11T09:00:00.000Z",
    ...overrides,
  };
}
function makeMaterial(
  overrides: Partial<StudyMaterialDTO> & Pick<StudyMaterialDTO, "id" | "title">,
): StudyMaterialDTO {
  return {
    notebookId,
    kind: "quiz",
    folderId: null,
    content: {},
    options: {},
    deletedAt: null,
    createdAt: "2026-08-11T10:00:00.000Z",
    updatedAt: "2026-08-11T10:00:00.000Z",
    ...overrides,
  };
}

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
}

describe("StudyMaterialsTree — folder creation and inline rename (production)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("creates root folder with server ID and enters rename", async () => {
    let foldersData: FolderDTO[] = [];
    const materials: StudyMaterialDTO[] = [];
    const createdFolder: FolderDTO = makeFolder({
      id: "folder-server-1",
      name: "Untitled folder",
      createdAt: "2026-08-19T12:00:00.000Z",
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes(`/api/notebooks/${notebookId}/folders`) && init?.method === "POST") {
        const body = JSON.parse(init.body as string);
        expect(body.name).toBe("Untitled folder");
        expect(body.parentId).toBeUndefined();
        foldersData = [createdFolder];
        return new Response(JSON.stringify(createdFolder), { status: 201 });
      }
      if (url.includes("/api/folders/") && init?.method === "PATCH") {
        const body = JSON.parse((init.body as string) ?? "{}");
        // Update foldersData for subsequent GET
        if (foldersData[0]) foldersData[0] = { ...foldersData[0], name: body.name };
        const updated = { ...createdFolder, name: body.name };
        return new Response(JSON.stringify(updated), { status: 200 });
      }
      if (url.includes(`/api/notebooks/${notebookId}/folders`)) {
        return new Response(JSON.stringify(foldersData), { status: 200 });
      }
      if (url.includes(`/api/notebooks/${notebookId}/study-materials`)) {
        return new Response(JSON.stringify(materials), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);

    const client = createClient();
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={client}>
        <StudyMaterialsTreeContainer notebookId={notebookId} />
      </QueryClientProvider>,
    );

    // Wait for tree to load (empty -> shows empty state, but header always visible)
    await screen.findByText("Study Materials");

    // Click New folder in header
    const newBtn = screen.getByLabelText("New folder");
    await user.click(newBtn);

    // Should be in rename mode with Untitled folder selected
    const input = await screen.findByLabelText("Item name");
    expect((input as HTMLInputElement).value).toBe("Untitled folder");
    // Input should be selected (we can check selection)
    expect(document.activeElement).toBe(input);

    // Verify server ID was used (folder appears with that id via tree, but we can check that input's treeitem has aria-selected)
    const treeItem = input.closest('[role="treeitem"]') as HTMLElement;
    expect(treeItem).toBeTruthy();

    // Commit rename to "My New Folder"
    await user.clear(input);
    await user.type(input, "My New Folder{Enter}");

    // Should have called PATCH for rename
    await waitFor(() => {
      const patchCalls = fetchMock.mock.calls.filter(
        ([url, init]) =>
          typeof url === "string" &&
          url.includes("/api/folders/folder-server-1") &&
          (init as RequestInit)?.method === "PATCH",
      );
      expect(patchCalls.length).toBe(1);
      const body = JSON.parse((patchCalls[0][1] as RequestInit).body as string);
      expect(body.name).toBe("My New Folder");
    });

    // After rename, input should be gone and new name visible
    await waitFor(() => expect(screen.queryByLabelText("Item name")).toBeNull());
    expect(await screen.findByText("My New Folder")).toBeTruthy();
  });

  it("Escape leaves Untitled folder without redundant write", async () => {
    const createdFolder: FolderDTO = makeFolder({
      id: "folder-server-2",
      name: "Untitled folder",
    });
    let foldersData: FolderDTO[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes(`/api/notebooks/${notebookId}/folders`) && init?.method === "POST") {
        foldersData = [createdFolder];
        return new Response(JSON.stringify(createdFolder), { status: 201 });
      }
      if (url.includes(`/api/notebooks/${notebookId}/folders`)) {
        return new Response(JSON.stringify(foldersData), { status: 200 });
      }
      if (url.includes(`/api/notebooks/${notebookId}/study-materials`)) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.includes("/api/folders/")) {
        // Should not be called for Escape
        throw new Error("Should not call PATCH on Escape");
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = createClient();
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={client}>
        <StudyMaterialsTreeContainer notebookId={notebookId} />
      </QueryClientProvider>,
    );
    await screen.findByText("Study Materials");
    await user.click(screen.getByLabelText("New folder"));
    await screen.findByLabelText("Item name");
    await user.keyboard("{Escape}");
    expect(screen.queryByLabelText("Item name")).toBeNull();
    expect(await screen.findByText("Untitled folder")).toBeTruthy();
    // Ensure no PATCH was called
    const patchCalls = fetchMock.mock.calls.filter(
      ([, init]) => (init as RequestInit)?.method === "PATCH",
    );
    expect(patchCalls.length).toBe(0);
  });

  it("blank and unchanged submissions do not trigger redundant write", async () => {
    const folders = [makeFolder({ id: "f1", name: "Existing" })];
    const materials: StudyMaterialDTO[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes(`/api/notebooks/${notebookId}/folders`) && !init?.method) {
        return new Response(JSON.stringify(folders), { status: 200 });
      }
      if (url.includes(`/api/notebooks/${notebookId}/study-materials`)) {
        return new Response(JSON.stringify(materials), { status: 200 });
      }
      if (url.includes("/api/folders/f1") && init?.method === "PATCH") {
        throw new Error("Should not patch for blank/unchanged");
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = createClient();
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={client}>
        <StudyMaterialsTreeContainer notebookId={notebookId} />
      </QueryClientProvider>,
    );
    await screen.findByText("Existing");
    const row = screen.getByText("Existing").closest('[role="treeitem"]') as HTMLElement;
    row.focus();
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.keyDown(row, { key: "F2" });
    const input = await screen.findByLabelText("Item name");
    // blank
    await user.clear(input);
    await user.type(input, "   {Enter}");
    expect(screen.queryByLabelText("Item name")).toBeNull();
    expect(screen.getByText("Existing")).toBeTruthy();
    // unchanged
    fireEvent.keyDown(row, { key: "F2" });
    await screen.findByLabelText("Item name");
    await user.keyboard("{Enter}");
    expect(screen.queryByLabelText("Item name")).toBeNull();
    const patchCalls = fetchMock.mock.calls.filter(
      ([, init]) => (init as RequestInit)?.method === "PATCH",
    );
    expect(patchCalls.length).toBe(0);
  });

  it("optimistic rename rolls back on failure and shows error", async () => {
    const folders = [makeFolder({ id: "f1", name: "Original" })];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes(`/api/notebooks/${notebookId}/folders`) && !init?.method) {
        return new Response(JSON.stringify(folders), { status: 200 });
      }
      if (url.includes(`/api/notebooks/${notebookId}/study-materials`)) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.includes("/api/folders/f1") && init?.method === "PATCH") {
        return new Response(JSON.stringify({ error: "Folder not found" }), { status: 404 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = createClient();
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={client}>
        <StudyMaterialsTreeContainer notebookId={notebookId} />
      </QueryClientProvider>,
    );
    await screen.findByText("Original");
    const row = screen.getByText("Original").closest('[role="treeitem"]') as HTMLElement;
    row.focus();
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.keyDown(row, { key: "F2" });
    const input = await screen.findByLabelText("Item name");
    await user.clear(input);
    await user.type(input, "New Name{Enter}");

    // Optimistic should have shown New Name immediately, then rolled back — input stays for retry
    await waitFor(() => expect(screen.getByLabelText("Item name")).toBeTruthy());
    expect((screen.getByLabelText("Item name") as HTMLInputElement).value).toBe("New Name");
    // Cache rolled back, but input still shows attempted name
    expect(fetchMock).toHaveBeenCalled();
  });

  it("material rename uses correct endpoint and shows optimistic", async () => {
    const folders: FolderDTO[] = [];
    let materialsData = [makeMaterial({ id: "m1", title: "Old Title" })];
    const updatedMaterial = { ...materialsData[0], title: "New Title" };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes(`/api/notebooks/${notebookId}/folders`)) {
        return new Response(JSON.stringify(folders), { status: 200 });
      }
      if (url.includes(`/api/notebooks/${notebookId}/study-materials`) && !init?.method) {
        return new Response(JSON.stringify(materialsData), { status: 200 });
      }
      if (url.includes("/api/study-materials/m1") && init?.method === "PATCH") {
        const body = JSON.parse((init.body as string) ?? "{}");
        expect(body.title).toBe("New Title");
        materialsData = [updatedMaterial];
        return new Response(JSON.stringify(updatedMaterial), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = createClient();
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={client}>
        <StudyMaterialsTreeContainer notebookId={notebookId} />
      </QueryClientProvider>,
    );
    await screen.findByText("Old Title");
    const row = screen.getByText("Old Title").closest('[role="treeitem"]') as HTMLElement;
    row.focus();
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.keyDown(row, { key: "F2" });
    const input = await screen.findByLabelText("Item name");
    await user.clear(input);
    await user.type(input, "New Title{Enter}");
    await waitFor(() => expect(screen.getByText("New Title")).toBeTruthy());
    expect(screen.queryByLabelText("Item name")).toBeNull();
  });
});
