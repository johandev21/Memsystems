import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Source } from "../api/sources";
import type { SourceFolder } from "../types/source-folder.types";
import { MobileSourceActionDrawer } from "./mobile-source-action-drawer";
import { MobileSourceTile } from "./mobile/mobile-source-tile";

function makeSource(overrides: Partial<Source> = {}): Source {
  return {
    id: "src-1",
    notebookId: "nb-1",
    kind: "file",
    title: "Test Source Document.pdf",
    url: null,
    modality: "document",
    contentType: "application/pdf",
    fileSize: 1024,
    folderId: null,
    processingStatus: "ready",
    createdAt: "2026-10-09T10:00:00.000Z",
    ...overrides,
  };
}

function makeFolder(overrides: Partial<SourceFolder> = {}): SourceFolder {
  return {
    id: "f-1",
    notebookId: "nb-1",
    name: "Research Folder",
    parentId: null,
    createdAt: "2026-10-09T10:00:00.000Z",
    updatedAt: "2026-10-09T10:00:00.000Z",
    ...overrides,
  };
}

describe("MobileSourceActionDrawer", () => {
  it("renders source title and primary action buttons when open", () => {
    const source = makeSource();
    render(
      <MobileSourceActionDrawer
        source={source}
        open={true}
        onOpenChange={vi.fn()}
        onViewContent={vi.fn()}
        onBeginRename={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Test Source Document.pdf")).toBeTruthy();
    expect(screen.getByRole("button", { name: /view content/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /rename/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /delete/i })).toBeTruthy();
  });

  it("calls onViewContent and closes when View content is tapped", () => {
    const handleView = vi.fn();
    const handleOpenChange = vi.fn();
    render(
      <MobileSourceActionDrawer
        source={makeSource()}
        open={true}
        onOpenChange={handleOpenChange}
        onViewContent={handleView}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /view content/i }));
    expect(handleOpenChange).toHaveBeenCalledWith(false);
    expect(handleView).toHaveBeenCalledOnce();
  });

  it("calls onBeginRename and closes when Rename is tapped", () => {
    const handleRename = vi.fn();
    const handleOpenChange = vi.fn();
    render(
      <MobileSourceActionDrawer
        source={makeSource()}
        open={true}
        onOpenChange={handleOpenChange}
        onBeginRename={handleRename}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /rename/i }));
    expect(handleOpenChange).toHaveBeenCalledWith(false);
    expect(handleRename).toHaveBeenCalledOnce();
  });

  it("calls onDelete and closes when Delete is tapped", () => {
    const handleDelete = vi.fn();
    const handleOpenChange = vi.fn();
    render(
      <MobileSourceActionDrawer
        source={makeSource()}
        open={true}
        onOpenChange={handleOpenChange}
        onDelete={handleDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(handleOpenChange).toHaveBeenCalledWith(false);
    expect(handleDelete).toHaveBeenCalledOnce();
  });

  it("renders retry button when source processing failed", () => {
    const handleRetry = vi.fn();
    render(
      <MobileSourceActionDrawer
        source={makeSource({ processingStatus: "failed" })}
        open={true}
        onOpenChange={vi.fn()}
        onRetry={handleRetry}
      />,
    );

    const retryBtn = screen.getByRole("button", { name: /retry.*processing/i });
    expect(retryBtn).toBeTruthy();
    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledOnce();
  });

  it("renders cancel button when source processing is active", () => {
    const handleCancel = vi.fn();
    render(
      <MobileSourceActionDrawer
        source={makeSource({ processingStatus: "processing", processingStage: "extracting" })}
        open={true}
        onOpenChange={vi.fn()}
        onCancel={handleCancel}
      />,
    );

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    expect(cancelBtn).toBeTruthy();
    fireEvent.click(cancelBtn);
    expect(handleCancel).toHaveBeenCalledOnce();
  });

  it("handles move to folder drill-down flow", () => {
    const handleMove = vi.fn();
    const handleOpenChange = vi.fn();
    const folder1 = makeFolder({ id: "f-1", name: "Folder A" });
    const folder2 = makeFolder({ id: "f-2", name: "Folder B" });

    render(
      <MobileSourceActionDrawer
        source={makeSource({ folderId: "f-1" })}
        open={true}
        onOpenChange={handleOpenChange}
        allFolders={[folder1, folder2]}
        onMove={handleMove}
      />,
    );

    // Click Move to folder
    const moveBtn = screen.getByRole("button", { name: /move to folder/i });
    fireEvent.click(moveBtn);

    // Should display Sources root option because source is currently in Folder A
    const rootOption = screen.getByRole("button", { name: /move to sources root/i });
    expect(rootOption).toBeTruthy();

    // Should display Folder B option (valid target)
    const folderBOption = screen.getByRole("button", { name: "Folder B" });
    expect(folderBOption).toBeTruthy();

    // Selecting Folder B moves the source
    fireEvent.click(folderBOption);
    expect(handleMove).toHaveBeenCalledWith("f-2");
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it("enforces tactile min-h-12 and touch-manipulation on action rows", () => {
    render(
      <MobileSourceActionDrawer
        source={makeSource()}
        open={true}
        onOpenChange={vi.fn()}
        onViewContent={vi.fn()}
        onBeginRename={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const viewBtn = screen.getByRole("button", { name: /view content/i });
    expect(viewBtn.className).toContain("min-h-12");
    expect(viewBtn.className).toContain("touch-manipulation");
    expect(viewBtn.className).toContain("active:scale-98");
  });

  it("renders mobile trigger button in MobileSourceTile and triggers actions callback on tap", () => {
    const source = makeSource();
    const handleActions = vi.fn();
    render(
      <MobileSourceTile
        source={source}
        onOpen={vi.fn()}
        onActions={handleActions}
      />,
    );

    const trigger = screen.getByRole("button", { name: /source actions/i });
    expect(trigger).toBeTruthy();
    expect(trigger.className).toContain("touch-manipulation");
    expect(trigger.className).toContain("size-12");

    fireEvent.click(trigger);
    expect(handleActions).toHaveBeenCalledOnce();
  });
});
