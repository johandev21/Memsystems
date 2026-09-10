import { DndContext } from "@dnd-kit/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FolderLibrary } from "./folder-library";

vi.mock("../hooks/use-fitted-folder-title", () => ({
  useFittedFolderTitle: () => 29.4,
}));

const handlers = {
  onSortChange: () => {},
  onOpenFolder: () => {},
  onMoveNotebook: () => {},
  onRenameFolder: () => {},
  onRemoveFolder: () => {},
  onOpenNotebook: () => {},
  onUpdateNotebook: () => {},
};

describe("FolderLibrary draft wiring", () => {
  it("commits a draft folder when its editor blurs unchanged", () => {
    const onCommitDraft = vi.fn();
    render(
      <DndContext>
        <FolderLibrary
          folders={[{ id: "folder-1", name: "Untitled folder", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }]}
          notebooks={[]}
          activeFolderId={null}
          sortKey="name"
          draftId="folder-1"
          onCommitDraft={onCommitDraft}
          onCancelDraft={() => {}}
          {...handlers}
        />
      </DndContext>,
    );
    fireEvent.blur(screen.getByRole("textbox"));
    expect(onCommitDraft).toHaveBeenCalledWith("Untitled folder");
  });

  it("cancels a draft folder on Escape", () => {
    const onCancelDraft = vi.fn();
    render(
      <DndContext>
        <FolderLibrary
          folders={[{ id: "folder-1", name: "Untitled folder", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }]}
          notebooks={[]}
          activeFolderId={null}
          sortKey="name"
          draftId="folder-1"
          onCommitDraft={() => {}}
          onCancelDraft={onCancelDraft}
          {...handlers}
        />
      </DndContext>,
    );
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(onCancelDraft).toHaveBeenCalledTimes(1);
  });

  it("does not treat an existing folder as a draft", () => {
    const onCommitDraft = vi.fn();
    const onRenameFolder = vi.fn();
    render(
      <DndContext>
        <FolderLibrary
          folders={[{ id: "folder-1", name: "Philosophy", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }]}
          notebooks={[]}
          activeFolderId={null}
          sortKey="name"
          draftId={null}
          onCommitDraft={onCommitDraft}
          onCancelDraft={() => {}}
          {...handlers}
          onRenameFolder={onRenameFolder}
        />
      </DndContext>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit folder Philosophy" }));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Ideas" } });
    fireEvent.blur(input);
    expect(onCommitDraft).not.toHaveBeenCalled();
    expect(onRenameFolder).toHaveBeenCalledWith("folder-1", "Ideas");
  });
});
