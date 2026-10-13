import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SourceFolder } from "../../types/source-folder.types";
import { MobileFolderActionDrawer } from "./mobile-folder-action-drawer";

function makeFolder(id: string, name: string, parentId: string | null = null): SourceFolder {
  return {
    id,
    name,
    parentId,
    notebookId: "nb-1",
    createdAt: "2026-10-09T10:00:00.000Z",
    updatedAt: "2026-10-09T10:00:00.000Z",
  };
}

describe("MobileFolderActionDrawer", () => {
  const currentFolder = makeFolder("f-1", "Philosophy Folder");
  const otherFolder = makeFolder("f-2", "History Folder");

  it("renders folder name and action buttons when open", () => {
    render(
      <MobileFolderActionDrawer
        folder={currentFolder}
        allFolders={[currentFolder, otherFolder]}
        canMove={() => true}
        onOpenChange={vi.fn()}
        onRename={vi.fn()}
        onCreateSubfolder={vi.fn()}
        onMove={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Philosophy Folder" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /rename/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /new subfolder/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /move to folder/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /delete/i })).toBeTruthy();
  });

  it("calls onRename and closes when Rename is selected", () => {
    const handleRename = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <MobileFolderActionDrawer
        folder={currentFolder}
        allFolders={[currentFolder]}
        canMove={() => true}
        onOpenChange={handleOpenChange}
        onRename={handleRename}
        onCreateSubfolder={vi.fn()}
        onMove={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /rename/i }));
    expect(handleRename).toHaveBeenCalledWith("f-1");
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onCreateSubfolder and closes when New subfolder is selected", () => {
    const handleCreateSubfolder = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <MobileFolderActionDrawer
        folder={currentFolder}
        allFolders={[currentFolder]}
        canMove={() => true}
        onOpenChange={handleOpenChange}
        onRename={vi.fn()}
        onCreateSubfolder={handleCreateSubfolder}
        onMove={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /new subfolder/i }));
    expect(handleCreateSubfolder).toHaveBeenCalledWith("f-1");
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onDelete when Delete is selected", () => {
    const handleDelete = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <MobileFolderActionDrawer
        folder={currentFolder}
        allFolders={[currentFolder]}
        canMove={() => true}
        onOpenChange={handleOpenChange}
        onRename={vi.fn()}
        onCreateSubfolder={vi.fn()}
        onMove={vi.fn()}
        onDelete={handleDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(handleDelete).toHaveBeenCalledWith("f-1");
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it("handles move to destination folder flow", () => {
    const handleMove = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <MobileFolderActionDrawer
        folder={currentFolder}
        allFolders={[currentFolder, otherFolder]}
        canMove={(id, targetId) => id !== targetId}
        onOpenChange={handleOpenChange}
        onRename={vi.fn()}
        onCreateSubfolder={vi.fn()}
        onMove={handleMove}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /move to folder/i }));
    expect(screen.getByRole("button", { name: "History Folder" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "History Folder" }));
    expect(handleMove).toHaveBeenCalledWith("f-1", "f-2");
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });
});
