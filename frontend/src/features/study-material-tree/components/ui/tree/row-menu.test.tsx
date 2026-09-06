import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StudyMaterialsTree } from "../study-materials-tree";
import type { FolderDTO } from "@/features/study-material-tree";
import type { StudyMaterialDTO } from "@/features/study-material-viewer";

const notebookId = "test-notebook-shortcuts";
const folders: FolderDTO[] = [
  {
    id: "folder-1",
    notebookId,
    parentId: null,
    name: "Documents",
    deletedAt: null,
    createdAt: "2026-08-11T09:00:00.000Z",
    updatedAt: "2026-08-11T09:00:00.000Z",
  },
];
const materials: StudyMaterialDTO[] = [];

describe("StudyMaterialsTree RowMenu shortcuts", () => {
  it("renders Lucide icon shortcuts instead of emojis on right-click", async () => {
    render(
      <StudyMaterialsTree
        folders={folders}
        materials={materials}
        selectedId={null}
        onSelectedChange={vi.fn()}
      />,
    );

    const folderNode = screen.getByText("Documents");
    const row = folderNode.closest('[role="treeitem"]');
    expect(row).toBeTruthy();

    if (row) {
      fireEvent.contextMenu(row);
    }

    // Context menu should appear
    const newFolderItem = await screen.findByRole("menuitem", { name: /New folder/i });
    expect(newFolderItem).toBeTruthy();

    // Verify button/kbd is removed
    expect(newFolderItem.querySelector("kbd")).toBeNull();

    // Verify Command icon exists with size-4 and accessible sr-only text
    const commandSvg = newFolderItem.querySelector("svg.lucide-command");
    expect(commandSvg).toBeTruthy();
    expect(commandSvg?.getAttribute("class")).toContain("size-4");
    expect(newFolderItem.textContent).not.toContain("⌘");
    expect(newFolderItem.textContent).toContain("N");
    expect(newFolderItem.textContent).toContain("Command N");

    // Verify Delete item has no button/kbd and renders Delete icon with size-5 and sr-only Backspace
    const deleteItem = screen.getByRole("menuitem", { name: /Delete/i });
    expect(deleteItem).toBeTruthy();
    expect(deleteItem.querySelector("kbd")).toBeNull();

    const deleteSvg = deleteItem.querySelector("svg.lucide-delete");
    expect(deleteSvg).toBeTruthy();
    expect(deleteSvg?.getAttribute("class")).toContain("size-5");
    expect(deleteItem.textContent).not.toContain("⌫");
    expect(deleteItem.textContent).toContain("Backspace");
  });
});
