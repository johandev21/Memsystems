import { DndContext } from "@dnd-kit/core";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FolderCard, NotebookCard } from "./prototype-cards";

vi.mock("../hooks/use-fitted-folder-title", () => ({
  useFittedFolderTitle: () => 29.4,
}));

describe("draft card editing", () => {
  it("auto-edits a new folder and dismisses with its placeholder name", () => {
    const onDismissEdit = vi.fn();
    render(
      <DndContext>
        <FolderCard
          folder={{ id: "folder-1", name: "Untitled folder" }}
          notebooks={[]}
          autoEdit
          onOpen={() => {}}
          onRename={() => {}}
          onCancelEdit={() => {}}
          onDismissEdit={onDismissEdit}
          onRemove={() => {}}
        />
      </DndContext>,
    );
    const input = screen.getByRole("textbox");
    expect(input.getAttribute("maxlength")).toBe("50");
    fireEvent.blur(input);
    expect(onDismissEdit).toHaveBeenCalledWith("Untitled folder");
  });

  it("cancels a new folder edit on Escape", () => {
    const onCancelEdit = vi.fn();
    render(
      <DndContext>
        <FolderCard
          folder={{ id: "folder-1", name: "Untitled folder" }}
          notebooks={[]}
          autoEdit
          onOpen={() => {}}
          onRename={() => {}}
          onCancelEdit={onCancelEdit}
          onRemove={() => {}}
        />
      </DndContext>,
    );
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(onCancelEdit).toHaveBeenCalledTimes(1);
  });

  it("auto-edits a new notebook and commits a typed title", () => {
    const onRename = vi.fn();
    const onOpen = vi.fn();
    render(
      <DndContext>
        <NotebookCard
          notebook={{ id: "notebook-1", title: "Untitled notebook", description: "", coverUrl: null, folderId: null }}
          folders={[]}
          autoEdit
          onMove={() => {}}
          onOpen={onOpen}
          onRename={onRename}
          onCancelEdit={() => {}}
          onDismissEdit={() => {}}
        />
      </DndContext>,
    );
    const input = document.querySelector("input.prototype-notebook-title-input");
    if (!input) throw new Error("notebook title input not found");
    expect(document.querySelector(".prototype-inline-editable__sizer")).not.toBeNull();
    expect(input.getAttribute("maxlength")).toBe("50");
    fireEvent.change(input, { target: { value: "Ideas" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRename).toHaveBeenCalledWith("Ideas");
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe("card open guard", () => {
  it("does not open a folder while its title is being edited", () => {
    const onOpen = vi.fn();
    render(
      <DndContext>
        <FolderCard folder={{ id: "folder-1", name: "Philosophy" }} notebooks={[]} onOpen={onOpen} onRename={() => {}} onRemove={() => {}} />
      </DndContext>,
    );
    const card = screen.getByRole("article", { name: /Philosophy/ });
    fireEvent.keyDown(card, { key: "F2" });
    fireEvent.doubleClick(card);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("does not open a notebook while its title is being edited", () => {
    const onOpen = vi.fn();
    render(
      <DndContext>
        <NotebookCard notebook={{ id: "notebook-1", title: "Notebook", description: "", coverUrl: null, folderId: null }} folders={[]} onMove={() => {}} onOpen={onOpen} onRename={() => {}} />
      </DndContext>,
    );
    const card = screen.getByRole("button", { name: "Notebook" });
    fireEvent.keyDown(card, { key: "F2" });
    fireEvent.doubleClick(card);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("ignores a double-click right after an edit ends", () => {
    vi.useFakeTimers();
    try {
      const onOpen = vi.fn();
      render(
        <DndContext>
          <FolderCard folder={{ id: "folder-1", name: "Philosophy" }} notebooks={[]} onOpen={onOpen} onRename={() => {}} onRemove={() => {}} />
        </DndContext>,
      );
      const card = screen.getByRole("article", { name: /Philosophy/ });
      fireEvent.keyDown(card, { key: "F2" });
      fireEvent.blur(screen.getByRole("textbox"));
      fireEvent.doubleClick(card);
      expect(onOpen).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(600);
      });
      fireEvent.doubleClick(card);
      expect(onOpen).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("still opens on double-click when not editing", () => {
    const onOpen = vi.fn();
    render(
      <DndContext>
        <FolderCard folder={{ id: "folder-1", name: "Philosophy" }} notebooks={[]} onOpen={onOpen} onRename={() => {}} onRemove={() => {}} />
      </DndContext>,
    );
    fireEvent.doubleClick(screen.getByRole("article", { name: /Philosophy/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
