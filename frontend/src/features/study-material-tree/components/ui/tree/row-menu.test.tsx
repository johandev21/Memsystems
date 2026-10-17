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

describe("StudyMaterialsTree RowMenu", () => {
  it("renders clean menu items without visual shortcut badges on right-click", async () => {
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

    // Verify shortcuts are NOT displayed visually in menu items
    expect(newFolderItem.querySelector("kbd")).toBeNull();
    expect(newFolderItem.querySelector('[data-slot="context-menu-shortcut"]')).toBeNull();
    expect(newFolderItem.querySelector("svg.lucide-command")).toBeNull();
    expect(newFolderItem.textContent).not.toContain("⌘");

    const deleteItem = screen.getByRole("menuitem", { name: /Delete/i });
    expect(deleteItem).toBeTruthy();
    expect(deleteItem.querySelector("kbd")).toBeNull();
    expect(deleteItem.querySelector('[data-slot="context-menu-shortcut"]')).toBeNull();
    expect(deleteItem.querySelector("svg.lucide-delete")).toBeNull();
    expect(deleteItem.textContent).not.toContain("⌫");
    expect(deleteItem.textContent).not.toContain("Backspace");
  });

  it("handles keyboard shortcuts (F2, Delete, Backspace) when row is focused", async () => {
    const handleCommand = vi.fn().mockResolvedValue({ success: true });
    render(
      <StudyMaterialsTree
        folders={folders}
        materials={materials}
        selectedId={null}
        onSelectedChange={vi.fn()}
        onCommand={handleCommand}
      />,
    );

    const folderNode = screen.getByText("Documents");
    const row = folderNode.closest('[role="treeitem"]') as HTMLElement;
    expect(row).toBeTruthy();

    // Focus the row
    row.focus();

    // F2 triggers rename input
    fireEvent.keyDown(row, { key: "F2" });
    const renameInput = screen.getByRole("textbox");
    expect(renameInput).toBeTruthy();
    fireEvent.keyDown(renameInput, { key: "Escape" });

    // Delete or Backspace opens delete confirmation dialog
    fireEvent.keyDown(row, { key: "Backspace" });
    const deleteDialog = await screen.findByRole("alertdialog");
    expect(deleteDialog).toBeTruthy();
    expect(deleteDialog.textContent).toContain("Delete folder");
  });
});
