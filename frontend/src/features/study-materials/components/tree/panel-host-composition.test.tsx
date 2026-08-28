import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { StudyMaterialsPanel } from "./study-materials-panel";
import { MobileStudyMaterialsPanel } from "./mobile-study-materials-panel";
import type { FolderDTO } from "@/entities/folder";
import type { StudyMaterialDTO } from "@/entities/study-material";

const notebookId = "nb-host-test";

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
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("StudyMaterials host composition — desktop and mobile share production tree", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("desktop panel renders real data via container and activates viewer only on deliberate click", async () => {
    const folders = [makeFolder({ id: "f1", name: "Foundations" })];
    const materials = [makeMaterial({ id: "m1", title: "Epistemology", folderId: "f1" })];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/folders")) return new Response(JSON.stringify(folders), { status: 200 });
      if (url.includes("/study-materials"))
        return new Response(JSON.stringify(materials), { status: 200 });
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const onSelect = vi.fn();
    const client = createClient();
    render(
      <QueryClientProvider client={client}>
        <StudyMaterialsPanel notebookId={notebookId} onSelectMaterial={onSelect} />
      </QueryClientProvider>,
    );

    const tree = await screen.findByRole("tree", { name: "Study materials" });
    expect(tree).toBeTruthy();
    // material should be visible (folder expanded by default top-level)
    expect(screen.getByText("Epistemology")).toBeTruthy();

    const materialRow = screen
      .getByText("Epistemology")
      .closest('[role="treeitem"]') as HTMLElement;
    // pointerDown should not activate viewer
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.pointerDown(materialRow);
    expect(onSelect).not.toHaveBeenCalled();

    // click should activate
    await userEvent.click(materialRow);
    expect(onSelect).toHaveBeenCalledWith("m1");
  });

  it("mobile panel renders same production tree and preserves activation separation", async () => {
    const folders = [makeFolder({ id: "f1", name: "Foundations" })];
    const materials = [makeMaterial({ id: "m1", title: "Epistemology", folderId: "f1" })];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/folders")) return new Response(JSON.stringify(folders), { status: 200 });
      if (url.includes("/study-materials"))
        return new Response(JSON.stringify(materials), { status: 200 });
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const onSelect = vi.fn();
    const client = createClient();
    render(
      <QueryClientProvider client={client}>
        <MobileStudyMaterialsPanel notebookId={notebookId} onSelectMaterial={onSelect} />
      </QueryClientProvider>,
    );

    const tree = await screen.findByRole("tree", { name: "Study materials" });
    expect(tree).toBeTruthy();
    expect(screen.getByText("Epistemology")).toBeTruthy();

    const row = screen.getByText("Epistemology").closest('[role="treeitem"]') as HTMLElement;
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.focus(row);
    expect(onSelect).not.toHaveBeenCalled();
    await userEvent.click(row);
    expect(onSelect).toHaveBeenCalledWith("m1");
  });
});
