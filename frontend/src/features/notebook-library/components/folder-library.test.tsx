import { DndContext } from "@dnd-kit/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n/i18n";
import notebooksEn from "@/shared/i18n/locales/en/notebooks.json";
import { FolderLibrary } from "./folder-library";

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

const handlers = {
  onSortChange: () => {},
  selectedKey: null,
  onSelectItem: () => {},
  onOpenFolder: () => {},
  onMoveNotebook: () => {},
  onMoveFolder: () => {},
  onRenameFolder: () => {},
  onRemoveFolder: () => {},
  onOpenNotebook: () => {},
  onUpdateNotebook: () => {},
};

const folder = {
  id: "folder-1",
  name: "Philosophy",
  parentId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("FolderLibrary draft wiring", () => {
  it("commits a draft folder when its editor blurs unchanged", () => {
    const onCommitDraft = vi.fn();
    renderWithProviders(<DndContext>
        <FolderLibrary
          folders={[{ ...folder, name: "Untitled folder" }]}
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
    renderWithProviders(<DndContext>
        <FolderLibrary
          folders={[{ ...folder, name: "Untitled folder" }]}
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
    renderWithProviders(<DndContext>
        <FolderLibrary
          folders={[folder]}
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

describe("FolderLibrary selection", () => {
  it("reports the selected item key on card click", () => {
    const onSelectItem = vi.fn();
    renderWithProviders(<DndContext>
        <FolderLibrary
          folders={[folder]}
          notebooks={[]}
          activeFolderId={null}
          sortKey="name"
          draftId={null}
          onCommitDraft={() => {}}
          onCancelDraft={() => {}}
          {...handlers}
          onSelectItem={onSelectItem}
        />
      </DndContext>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Philosophy, 0 notebooks" }));
    expect(onSelectItem).toHaveBeenCalledWith("folder:folder-1");
  });

  it("marks the selected card and clears the selection on background click", () => {
    const onSelectItem = vi.fn();
    const { container } = renderWithProviders(<DndContext>
        <FolderLibrary
          folders={[folder]}
          notebooks={[]}
          activeFolderId={null}
          sortKey="name"
          draftId={null}
          onCommitDraft={() => {}}
          onCancelDraft={() => {}}
          {...handlers}
          selectedKey="folder:folder-1"
          onSelectItem={onSelectItem}
        />
      </DndContext>,
    );
    expect(
      screen.getByRole("button", { name: "Philosophy, 0 notebooks" }).getAttribute("data-selected"),
    ).toBe("true");
    const grid = container.querySelector(".library-grid");
    if (!grid) throw new Error("library grid not found");
    fireEvent.click(grid);
    expect(onSelectItem).toHaveBeenCalledWith(null);
  });

  it("clears the selection on Escape from a card", () => {
    const onSelectItem = vi.fn();
    renderWithProviders(<DndContext>
        <FolderLibrary
          folders={[folder]}
          notebooks={[]}
          activeFolderId={null}
          sortKey="name"
          draftId={null}
          onCommitDraft={() => {}}
          onCancelDraft={() => {}}
          {...handlers}
          selectedKey="folder:folder-1"
          onSelectItem={onSelectItem}
        />
      </DndContext>,
    );
    fireEvent.keyDown(screen.getByRole("button", { name: "Philosophy, 0 notebooks" }), {
      key: "Escape",
    });
    expect(onSelectItem).toHaveBeenCalledWith(null);
  });
});

describe("FolderLibrary nesting", () => {
  const nestedFolders = [
    { ...folder, id: "root-folder", name: "Root folder" },
    { ...folder, id: "child-folder", name: "Child folder", parentId: "root-folder" },
    { ...folder, id: "grandchild-folder", name: "Grandchild", parentId: "child-folder" },
  ];
  const nestedNotebook = {
    id: "nested-notebook",
    title: "Nested notebook",
    description: "",
    icon: "Notebook",
    coverUrl: null,
    coverVariants: null,
    folderId: "grandchild-folder",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  it("shows only immediate children and counts descendant notebooks", () => {
    renderWithProviders(<DndContext>
        <FolderLibrary
          folders={nestedFolders}
          notebooks={[nestedNotebook]}
          activeFolderId={null}
          sortKey="name"
          draftId={null}
          onCommitDraft={() => {}}
          onCancelDraft={() => {}}
          {...handlers}
        />
      </DndContext>,
    );

    expect(screen.getByRole("button", { name: "Root folder, 1 notebook" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Child folder,/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Nested notebook" })).toBeNull();
  });

  it("renders and navigates the full ancestor breadcrumb", () => {
    const onOpenFolder = vi.fn();
    renderWithProviders(<DndContext>
        <FolderLibrary
          folders={nestedFolders}
          notebooks={[nestedNotebook]}
          activeFolderId="grandchild-folder"
          sortKey="name"
          draftId={null}
          onCommitDraft={() => {}}
          onCancelDraft={() => {}}
          {...handlers}
          onOpenFolder={onOpenFolder}
        />
      </DndContext>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Child folder" }));
    expect(onOpenFolder).toHaveBeenCalledWith("child-folder");
    expect(
      screen
        .getByText("Grandchild", { selector: '[aria-current="page"]' })
        .getAttribute("aria-current"),
    ).toBe("page");
  });
});
