import { DndContext } from "@dnd-kit/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n/i18n";
import notebooksEn from "@/shared/i18n/locales/en/notebooks.json";
import { FolderCard, NotebookCard } from "./library-cards";

vi.mock("../hooks/use-fitted-folder-title", () => ({
  useFittedFolderTitle: () => 29.4,
}));

function renderWithProviders(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

// The notebooks namespace loads lazily; register the bundle directly so the
// first render cannot race the namespace fetch.
beforeAll(() => {
  i18n.addResourceBundle("en", "notebooks", notebooksEn, true, true);
});

describe("draft card editing", () => {
  it("auto-edits a new folder and dismisses with its placeholder name", () => {
    const onDismissEdit = vi.fn();
    renderWithProviders(<DndContext>
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
    renderWithProviders(<DndContext>
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
    renderWithProviders(<DndContext>
        <NotebookCard
          notebook={{
            id: "notebook-1",
            title: "Untitled notebook",
            description: "",
            coverUrl: null,
            folderId: null,
          }}
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
    const input = document.querySelector("input.library-notebook-title-input");
    if (!input) throw new Error("notebook title input not found");
    expect(document.querySelector(".library-inline-editable__sizer")).not.toBeNull();
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
    renderWithProviders(<DndContext>
        <FolderCard
          folder={{ id: "folder-1", name: "Philosophy" }}
          notebooks={[]}
          onOpen={onOpen}
          onRename={() => {}}
          onRemove={() => {}}
        />
      </DndContext>,
    );
    const card = screen.getByRole("button", { name: "Philosophy, 0 notebooks" });
    fireEvent.keyDown(card, { key: "F2" });
    fireEvent.doubleClick(card);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("does not open a notebook while its title is being edited", () => {
    const onOpen = vi.fn();
    renderWithProviders(<DndContext>
        <NotebookCard
          notebook={{
            id: "notebook-1",
            title: "Notebook",
            description: "",
            coverUrl: null,
            folderId: null,
          }}
          folders={[]}
          onMove={() => {}}
          onOpen={onOpen}
          onRename={() => {}}
        />
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
      renderWithProviders(<DndContext>
          <FolderCard
            folder={{ id: "folder-1", name: "Philosophy" }}
            notebooks={[]}
            onOpen={onOpen}
            onRename={() => {}}
            onRemove={() => {}}
          />
        </DndContext>,
      );
      const card = screen.getByRole("button", { name: "Philosophy, 0 notebooks" });
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
    renderWithProviders(<DndContext>
        <FolderCard
          folder={{ id: "folder-1", name: "Philosophy" }}
          notebooks={[]}
          onOpen={onOpen}
          onRename={() => {}}
          onRemove={() => {}}
        />
      </DndContext>,
    );
    fireEvent.doubleClick(screen.getByRole("button", { name: "Philosophy, 0 notebooks" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe("selection", () => {
  it("selects a folder on click without opening it", () => {
    const onSelect = vi.fn();
    const onOpen = vi.fn();
    renderWithProviders(<DndContext>
        <FolderCard
          folder={{ id: "folder-1", name: "Philosophy" }}
          notebooks={[]}
          onSelect={onSelect}
          onOpen={onOpen}
          onRename={() => {}}
          onRemove={() => {}}
        />
      </DndContext>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Philosophy, 0 notebooks" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("marks the selected folder card", () => {
    renderWithProviders(<DndContext>
        <FolderCard
          folder={{ id: "folder-1", name: "Philosophy" }}
          notebooks={[]}
          selected
          onOpen={() => {}}
          onRename={() => {}}
          onRemove={() => {}}
        />
      </DndContext>,
    );
    expect(
      screen.getByRole("button", { name: "Philosophy, 0 notebooks" }).getAttribute("data-selected"),
    ).toBe("true");
  });

  it("selects a notebook on click without opening it", () => {
    const onSelect = vi.fn();
    const onOpen = vi.fn();
    renderWithProviders(<DndContext>
        <NotebookCard
          notebook={{
            id: "notebook-1",
            title: "Notebook",
            description: "",
            coverUrl: null,
            folderId: null,
          }}
          folders={[]}
          onSelect={onSelect}
          onMove={() => {}}
          onOpen={onOpen}
          onRename={() => {}}
        />
      </DndContext>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Notebook" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
