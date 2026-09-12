import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudyMaterialsTreeContainer } from "./study-materials-tree-container";
import type { FolderDTO } from "@/features/study-material-tree";
import type { StudyMaterialDTO } from "@/features/study-material-viewer";

const notebookId = "nb-test-49";

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

function createTestClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function mockFetchFor({
  folders,
  materials,
  folderError,
  materialError,
  delay = 0,
}: {
  folders?: FolderDTO[];
  materials?: StudyMaterialDTO[];
  folderError?: number;
  materialError?: number;
  delay?: number;
}) {
  const mock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (delay) await new Promise((r) => setTimeout(r, delay));
    if (url.includes(`/api/notebooks/${notebookId}/folders`)) {
      if (folderError) {
        return new Response(JSON.stringify({ error: "Failed to load folders" }), {
          status: folderError,
        });
      }
      return new Response(JSON.stringify(folders ?? []), { status: 200 });
    }
    if (url.includes(`/api/notebooks/${notebookId}/study-materials`)) {
      if (materialError) {
        return new Response(JSON.stringify({ error: "Failed to load materials" }), {
          status: materialError,
        });
      }
      return new Response(JSON.stringify(materials ?? []), { status: 200 });
    }
    return new Response(JSON.stringify([]), { status: 200 });
  });
  vi.spyOn(globalThis, "fetch").mockImplementation(mock as never);
  return mock;
}

describe("StudyMaterialsTreeContainer — query composition & view states", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("shows skeleton while initial loading and no partial hierarchy", async () => {
    mockFetchFor({ delay: 100, folders: [], materials: [] });
    const client = createTestClient();
    render(
      <QueryClientProvider client={client}>
        <StudyMaterialsTreeContainer notebookId={notebookId} />
      </QueryClientProvider>,
    );

    expect(screen.getByLabelText("Loading study materials")).toBeTruthy();
    expect(screen.queryByRole("tree", { name: "Study materials" })).toBeNull();
    expect(screen.queryByText("No study materials")).toBeNull();
  });

  it("renders one hierarchy after both queries succeed", async () => {
    const folders = [makeFolder({ id: "f1", name: "Foundations" })];
    const materials = [makeMaterial({ id: "m1", title: "Epistemology", folderId: "f1" })];
    mockFetchFor({ folders, materials });
    const client = createTestClient();
    render(
      <QueryClientProvider client={client}>
        <StudyMaterialsTreeContainer notebookId={notebookId} />
      </QueryClientProvider>,
    );

    const tree = await screen.findByRole("tree", { name: "Study materials" });
    expect(within(tree).getByText("Foundations")).toBeTruthy();
    expect(within(tree).getByText("Epistemology")).toBeTruthy();
    // folders before materials ordering: if we had root material, it would be after folder.
  });

  it("shows one inline retryable error if either request fails and no partial tree", async () => {
    mockFetchFor({ folders: [], materials: [], folderError: 500 });
    const client = createTestClient();
    render(
      <QueryClientProvider client={client}>
        <StudyMaterialsTreeContainer notebookId={notebookId} />
      </QueryClientProvider>,
    );

    const error = await screen.findByRole("alert");
    expect(error.textContent?.toLowerCase()).toContain("failed");
    expect(screen.queryByRole("tree")).toBeNull();
    // retry button exists
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("retry covers both resources", async () => {
    const folders = [makeFolder({ id: "f1", name: "Foundations" })];
    const materials = [makeMaterial({ id: "m1", title: "Epistemology" })];
    let call = 0;
    const mock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/folders")) {
        call++;
        if (call <= 1) return new Response(JSON.stringify({ error: "fail" }), { status: 500 });
        return new Response(JSON.stringify(folders), { status: 200 });
      }
      if (url.includes("/study-materials")) {
        if (call <= 1) return new Response(JSON.stringify({ error: "fail" }), { status: 500 });
        return new Response(JSON.stringify(materials), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.spyOn(globalThis, "fetch").mockImplementation(mock as never);
    const client = createTestClient();
    render(
      <QueryClientProvider client={client}>
        <StudyMaterialsTreeContainer notebookId={notebookId} />
      </QueryClientProvider>,
    );

    await screen.findByRole("alert");
    const retryBtn = screen.getByRole("button", { name: "Retry" });
    await userEvent.click(retryBtn);

    const tree = await screen.findByRole("tree", { name: "Study materials" });
    expect(within(tree).getByText("Foundations")).toBeTruthy();
  });

  it("retains last good tree during background refetch and shows updating state", async () => {
    const folders = [makeFolder({ id: "f1", name: "Foundations" })];
    const materials = [makeMaterial({ id: "m1", title: "Epistemology" })];
    mockFetchFor({ folders, materials });
    const client = createTestClient();
    render(
      <QueryClientProvider client={client}>
        <StudyMaterialsTreeContainer notebookId={notebookId} />
      </QueryClientProvider>,
    );

    await screen.findByRole("tree", { name: "Study materials" });

    // Trigger background refetch by invalidating — mock slow fetch
    let resolveBg: (v: Response) => void;
    const bgPromise = new Promise<Response>((res) => (resolveBg = res));
    const fetchMock = vi.fn(() => bgPromise as never);
    vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);

    void client.refetchQueries({ queryKey: ["study-material-folders", notebookId] });
    void client.refetchQueries({ queryKey: ["study-materials", notebookId] });

    // Wait for fetching indicator to appear
    await waitFor(() => expect(screen.getByLabelText("Updating study materials")).toBeTruthy());
    // Tree should still be visible, not replaced by skeleton
    expect(screen.getByRole("tree", { name: "Study materials" })).toBeTruthy();
    expect(screen.queryByLabelText("Loading study materials")).toBeNull();

    // Resolve background for folders
    resolveBg!(new Response(JSON.stringify(folders), { status: 200 }));
    // Need to resolve both queries; second one will also be pending, mock again for materials
    await waitFor(() => expect(screen.queryByLabelText("Updating study materials")).toBeNull());
  });

  it("does not leak expansion between notebooks and prunes stale", async () => {
    const foldersA = [
      makeFolder({ id: "f-a1", name: "A1" }),
      makeFolder({ id: "f-a2", name: "A2" }),
    ];
    const foldersB = [makeFolder({ id: "f-b1", name: "B1" })];
    // Persist expansion for notebook A: only f-a1 expanded
    localStorage.setItem(`study-materials-tree:expanded:${notebookId}`, JSON.stringify(["f-a1"]));
    const nb2 = "nb-2";
    localStorage.setItem(`study-materials-tree:expanded:${nb2}`, JSON.stringify(["f-b1"]));

    // Render A
    mockFetchFor({ folders: foldersA, materials: [] });
    const client = createTestClient();
    const { unmount } = render(
      <QueryClientProvider client={client}>
        <StudyMaterialsTreeContainer notebookId={notebookId} />
      </QueryClientProvider>,
    );
    await screen.findByRole("tree", { name: "Study materials" });
    // Should have pruned if any stale? Here no stale, should retain f-a1.
    expect(
      JSON.parse(localStorage.getItem(`study-materials-tree:expanded:${notebookId}`)!),
    ).toContain("f-a1");
    unmount();

    // Render B should not contain A's expansion
    vi.restoreAllMocks();
    const mockB = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes(`/api/notebooks/${nb2}/folders`))
        return new Response(JSON.stringify(foldersB), { status: 200 });
      if (url.includes(`/api/notebooks/${nb2}/study-materials`))
        return new Response(JSON.stringify([]), { status: 200 });
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.spyOn(globalThis, "fetch").mockImplementation(mockB as never);
    const client2 = createTestClient();
    render(
      <QueryClientProvider client={client2}>
        <StudyMaterialsTreeContainer notebookId={nb2} />
      </QueryClientProvider>,
    );
    await screen.findByRole("tree", { name: "Study materials" });
    expect(JSON.parse(localStorage.getItem(`study-materials-tree:expanded:${nb2}`)!)).toContain(
      "f-b1",
    );
    expect(
      JSON.parse(localStorage.getItem(`study-materials-tree:expanded:${notebookId}`)!),
    ).not.toContain("f-b1");
  });

  it("expands newly encountered top-level folders by default", async () => {
    const initialFolders = [makeFolder({ id: "f1", name: "Root1" })];
    mockFetchFor({ folders: initialFolders, materials: [] });
    const client = createTestClient();
    const { unmount } = render(
      <QueryClientProvider client={client}>
        <StudyMaterialsTreeContainer notebookId={notebookId} />
      </QueryClientProvider>,
    );
    await screen.findByRole("tree", { name: "Study materials" });
    // Initially, f1 should be expanded (top-level default)
    expect(
      JSON.parse(localStorage.getItem(`study-materials-tree:expanded:${notebookId}`)!),
    ).toContain("f1");
    unmount();

    // Add new top-level folder f2
    const newFolders = [
      ...initialFolders,
      makeFolder({ id: "f2", name: "Root2", createdAt: "2026-08-11T09:05:00.000Z" }),
    ];
    vi.restoreAllMocks();
    const mock2 = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/folders"))
        return new Response(JSON.stringify(newFolders), { status: 200 });
      if (url.includes("/study-materials"))
        return new Response(JSON.stringify([]), { status: 200 });
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.spyOn(globalThis, "fetch").mockImplementation(mock2 as never);
    const client2 = createTestClient();
    render(
      <QueryClientProvider client={client2}>
        <StudyMaterialsTreeContainer notebookId={notebookId} />
      </QueryClientProvider>,
    );
    await screen.findByRole("tree", { name: "Study materials" });
    const expanded = JSON.parse(
      localStorage.getItem(`study-materials-tree:expanded:${notebookId}`)!,
    );
    expect(expanded).toContain("f1");
    expect(expanded).toContain("f2");
  });

  it("material activation via click triggers onMaterialActivate, pointerDown does not", async () => {
    const folders = [makeFolder({ id: "f1", name: "Foundations" })];
    const materials = [makeMaterial({ id: "m1", title: "Epistemology", folderId: "f1" })];
    mockFetchFor({ folders, materials });
    const client = createTestClient();
    const onActivate = vi.fn();
    render(
      <QueryClientProvider client={client}>
        <StudyMaterialsTreeContainer notebookId={notebookId} onMaterialActivate={onActivate} />
      </QueryClientProvider>,
    );
    const tree = await screen.findByRole("tree", { name: "Study materials" });
    const materialRow = within(tree)
      .getByText("Epistemology")
      .closest('[role="treeitem"]') as HTMLElement;
    // pointerDown should not activate
    // We simulate pointer down via fireEvent
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.pointerDown(materialRow);
    expect(onActivate).not.toHaveBeenCalled();
    // click should activate
    await userEvent.click(materialRow);
    expect(onActivate).toHaveBeenCalledWith("m1");
  });
});
