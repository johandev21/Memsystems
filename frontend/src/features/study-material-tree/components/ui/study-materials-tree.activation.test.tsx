import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StudyMaterialsTree } from "./study-materials-tree";
import type { FolderDTO } from "@/features/study-material-tree";
import type { StudyMaterialDTO } from "@/features/study-material-viewer";

const notebookId = "test-notebook-1";
const folders: FolderDTO[] = [
  {
    id: "folder-1",
    notebookId,
    parentId: null,
    name: "Foundations",
    deletedAt: null,
    createdAt: "2026-08-11T09:00:00.000Z",
    updatedAt: "2026-08-11T09:00:00.000Z",
  },
  {
    id: "folder-2",
    notebookId,
    parentId: "folder-1",
    name: "Metaphysics",
    deletedAt: null,
    createdAt: "2026-08-11T09:05:00.000Z",
    updatedAt: "2026-08-11T09:05:00.000Z",
  },
];
const materials: StudyMaterialDTO[] = [
  {
    id: "material-1",
    notebookId,
    kind: "quiz",
    title: "Epistemología comparada",
    folderId: null,
    content: {},
    options: {},
    deletedAt: null,
    createdAt: "2026-08-12T09:00:00.000Z",
    updatedAt: "2026-08-12T09:00:00.000Z",
  },
  {
    id: "material-2",
    notebookId,
    kind: "simple_flashcard",
    title: "Ser, esencia y existencia",
    folderId: "folder-2",
    content: {},
    options: {},
    deletedAt: null,
    createdAt: "2026-08-12T09:05:00.000Z",
    updatedAt: "2026-08-12T09:05:00.000Z",
  },
];

function getTreeItem(text: string) {
  const node = screen.getByText(text);
  const item = node.closest('[role="treeitem"]') as HTMLElement | null;
  if (!item) throw new Error(`No treeitem for ${text}`);
  return item;
}

describe("StudyMaterialsTree activation separation (production)", () => {
  it("does not activate on pointerDown, focus, or contextMenu, but activates on click", async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    const onSelectedChange = vi.fn();

    render(
      <StudyMaterialsTree
        folders={folders}
        materials={materials}
        onMaterialActivate={onActivate}
        onSelectedChange={onSelectedChange}
      />,
    );

    const material = getTreeItem("Epistemología comparada");
    expect(material).toBeTruthy();

    // pointerDown should select but not activate
    fireEvent.pointerDown(material);
    expect(onActivate).not.toHaveBeenCalled();
    // focus also should not activate
    fireEvent.focus(material);
    expect(onActivate).not.toHaveBeenCalled();
    // context menu (select) should not activate
    fireEvent.contextMenu(material);
    expect(onActivate).not.toHaveBeenCalled();

    // click should activate
    await user.click(material);
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onActivate).toHaveBeenCalledWith("material-1");
  });

  it("activates material on Enter and toggles folder on Enter", async () => {
    const onActivate = vi.fn();
    render(
      <StudyMaterialsTree
        folders={folders}
        materials={materials}
        onMaterialActivate={onActivate}
      />,
    );

    const material = getTreeItem("Epistemología comparada");
    material.focus();
    fireEvent.keyDown(material, { key: "Enter" });
    expect(onActivate).toHaveBeenCalledWith("material-1");

    onActivate.mockClear();
    const folder = getTreeItem("Foundations");
    const wasExpanded = folder.getAttribute("aria-expanded") === "true";
    folder.focus();
    fireEvent.keyDown(folder, { key: "Enter" });
    expect(onActivate).not.toHaveBeenCalled();
    expect(folder.getAttribute("aria-expanded")).toBe(wasExpanded ? "false" : "true");
  });

  it("does not activate when starting drag", async () => {
    const onActivate = vi.fn();
    render(
      <StudyMaterialsTree
        folders={folders}
        materials={materials}
        onMaterialActivate={onActivate}
      />,
    );

    const material = getTreeItem("Epistemología comparada");
    // drag start is via pointer events; we at least verify that material activation is not called on pointerDown
    fireEvent.pointerDown(material);
    expect(onActivate).not.toHaveBeenCalled();
  });
});
