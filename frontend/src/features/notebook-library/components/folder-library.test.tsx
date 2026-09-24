import { DndContext } from "@dnd-kit/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  draftClientId: null,
  onSelectItem: () => {},
  onOpenFolder: () => {},
  onRenameFolder: () => {},
  onRemoveFolder: () => {},
  onRemoveNotebook: () => {},
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
    renderWithProviders(
      <DndContext>
        <FolderLibrary
          folders={[{ ...folder, name: "Untitled folder" }]}
          notebooks={[]}
          activeFolderId={null}
          sortKey="name"
          draftId="folder-1"
          onCommitDraft={onCommitDraft}
          onCancelDraft={() => {}}
          {...handlers}
          draftClientId="folder-1"
        />
      </DndContext>,
    );
    fireEvent.blur(screen.getByRole("textbox"));
    expect(onCommitDraft).toHaveBeenCalledWith("Untitled folder");
  });

  it("cancels a draft folder on Escape", () => {
    const onCancelDraft = vi.fn();
    renderWithProviders(
      <DndContext>
        <FolderLibrary
          folders={[{ ...folder, name: "Untitled folder" }]}
          notebooks={[]}
          activeFolderId={null}
          sortKey="name"
          draftId="folder-1"
          onCommitDraft={() => {}}
          onCancelDraft={onCancelDraft}
          {...handlers}
          draftClientId="folder-1"
        />
      </DndContext>,
    );
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(onCancelDraft).toHaveBeenCalledTimes(1);
  });

  it("does not treat an existing folder as a draft", () => {
    const onCommitDraft = vi.fn();
    const onRenameFolder = vi.fn();
    renderWithProviders(
      <DndContext>
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
    renderWithProviders(
      <DndContext>
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
    const { container } = renderWithProviders(
      <DndContext>
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
    renderWithProviders(
      <DndContext>
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
    renderWithProviders(
      <DndContext>
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
    renderWithProviders(
      <DndContext>
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

describe("FolderLibrary notebook deletion", () => {
  it("asks to remove the notebook from its card menu", async () => {
    const user = userEvent.setup();
    const onRemoveNotebook = vi.fn();
    renderWithProviders(
      <DndContext>
        <FolderLibrary
          folders={[]}
          notebooks={[
            {
              id: "notebook-1",
              title: "Notebook",
              description: "",
              icon: "Notebook",
              coverUrl: null,
              coverVariants: null,
              folderId: null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ]}
          activeFolderId={null}
          sortKey="name"
          draftId={null}
          onCommitDraft={() => {}}
          onCancelDraft={() => {}}
          {...handlers}
          onRemoveNotebook={onRemoveNotebook}
        />
      </DndContext>,
    );
    fireEvent.contextMenu(screen.getByRole("button", { name: "Notebook" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete Notebook" }));
    expect(onRemoveNotebook).toHaveBeenCalledWith("notebook-1");
  });
});

describe("FolderLibrary draft focus", () => {
  const draftFolder = (id: string) => ({ ...folder, id, name: "Untitled folder" });
  const draftNotebook = (id: string) => ({
    id,
    title: "Untitled notebook",
    description: "",
    icon: "Notebook",
    coverUrl: null,
    coverVariants: null,
    folderId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  function renderLibrary(ui: ReactElement) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) };
  }

  it("focuses a draft folder and keeps it focused when its id becomes the server id", () => {
    const { client, rerender } = renderLibrary(
      <DndContext>
        <FolderLibrary
          folders={[draftFolder("tmp-folder")]}
          notebooks={[]}
          activeFolderId={null}
          sortKey="name"
          onCommitDraft={() => {}}
          onCancelDraft={() => {}}
          {...handlers}
          draftId="tmp-folder"
          draftClientId="tmp-folder"
        />
      </DndContext>,
    );
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: "Ideas" } });

    // The draft id becomes the server id before the cached row is swapped.
    rerender(
      <QueryClientProvider client={client}>
        <DndContext>
          <FolderLibrary
            folders={[draftFolder("tmp-folder")]}
            notebooks={[]}
            activeFolderId={null}
            sortKey="name"
            onCommitDraft={() => {}}
            onCancelDraft={() => {}}
            {...handlers}
            draftId="server-folder"
            draftClientId="tmp-folder"
          />
        </DndContext>
      </QueryClientProvider>,
    );
    expect(screen.getByRole("textbox")).toBe(input);
    expect(document.activeElement).toBe(input);

    rerender(
      <QueryClientProvider client={client}>
        <DndContext>
          <FolderLibrary
            folders={[draftFolder("server-folder")]}
            notebooks={[]}
            activeFolderId={null}
            sortKey="name"
            onCommitDraft={() => {}}
            onCancelDraft={() => {}}
            {...handlers}
            draftId="server-folder"
            draftClientId="tmp-folder"
          />
        </DndContext>
      </QueryClientProvider>,
    );

    const swappedInput = screen.getByRole("textbox") as HTMLInputElement;
    expect(swappedInput).toBe(input);
    expect(document.activeElement).toBe(swappedInput);
    expect(swappedInput.value).toBe("Ideas");
  });

  it("keeps a draft notebook focused when its id becomes the server id", () => {
    const { client, rerender } = renderLibrary(
      <DndContext>
        <FolderLibrary
          folders={[]}
          notebooks={[draftNotebook("tmp-notebook")]}
          activeFolderId={null}
          sortKey="name"
          onCommitDraft={() => {}}
          onCancelDraft={() => {}}
          {...handlers}
          draftId="tmp-notebook"
          draftClientId="tmp-notebook"
        />
      </DndContext>,
    );
    const input = document.querySelector("input.library-notebook-title-input") as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: "Ideas" } });

    // The draft id becomes the server id before the cached row is swapped.
    rerender(
      <QueryClientProvider client={client}>
        <DndContext>
          <FolderLibrary
            folders={[]}
            notebooks={[draftNotebook("tmp-notebook")]}
            activeFolderId={null}
            sortKey="name"
            onCommitDraft={() => {}}
            onCancelDraft={() => {}}
            {...handlers}
            draftId="server-notebook"
            draftClientId="tmp-notebook"
          />
        </DndContext>
      </QueryClientProvider>,
    );
    expect(document.querySelector("input.library-notebook-title-input")).toBe(input);
    expect(document.activeElement).toBe(input);

    rerender(
      <QueryClientProvider client={client}>
        <DndContext>
          <FolderLibrary
            folders={[]}
            notebooks={[draftNotebook("server-notebook")]}
            activeFolderId={null}
            sortKey="name"
            onCommitDraft={() => {}}
            onCancelDraft={() => {}}
            {...handlers}
            draftId="server-notebook"
            draftClientId="tmp-notebook"
          />
        </DndContext>
      </QueryClientProvider>,
    );

    const swappedInput = document.querySelector(
      "input.library-notebook-title-input",
    ) as HTMLInputElement;
    expect(swappedInput).toBe(input);
    expect(document.activeElement).toBe(swappedInput);
    expect(swappedInput.value).toBe("Ideas");
  });
});
