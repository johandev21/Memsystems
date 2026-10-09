import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n/i18n";
import notebooksEn from "@/shared/i18n/locales/en/notebooks.json";
import type { LibraryNotebook } from "../model/types";
import { MobileLibraryView, type MobileLibraryViewProps } from "./mobile-library-view";

beforeAll(() => {
  i18n.addResourceBundle("en", "notebooks", notebooksEn, true, true);
});

function renderWithProviders(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const mockFolder = {
  id: "folder-1",
  name: "Philosophy",
  parentId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const mockSubfolder = {
  id: "folder-2",
  name: "Ancient Philosophy",
  parentId: "folder-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const mockNotebook: LibraryNotebook = {
  id: "notebook-1",
  title: "Republic",
  description: "Plato's Republic",
  icon: "notebook",
  coverUrl: null,
  coverVariants: null,
  folderId: "folder-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const defaultProps: MobileLibraryViewProps = {
  folders: [mockFolder, mockSubfolder],
  notebooks: [mockNotebook],
  items: [
    { kind: "folder", folder: mockSubfolder },
    { kind: "notebook", notebook: mockNotebook },
  ],
  activeFolderId: "folder-1",
  sortKey: "name",
  sortOptions: [
    { value: "name", label: "Name", description: "Alphabetical" },
    { value: "updatedAt", label: "Updated", description: "Recent first" },
  ],
  onSortChange: vi.fn(),
  onOpenFolder: vi.fn(),
  onOpenNotebook: vi.fn(),
  onRenameFolder: vi.fn(),
  onRemoveFolder: vi.fn(),
  onRemoveNotebook: vi.fn(),
  onUpdateNotebook: vi.fn(),
  onCreateFolder: vi.fn(),
  onCreateNotebook: vi.fn(),
  emptyState: { title: "Empty", description: "No items" },
};

describe("MobileLibraryView", () => {
  it("renders active folder title and back button to parent", () => {
    const onOpenFolder = vi.fn();
    renderWithProviders(<MobileLibraryView {...defaultProps} onOpenFolder={onOpenFolder} />);

    // Active folder title in header
    expect(screen.getByRole("heading", { name: "Philosophy" })).toBeDefined();

    // Back button targeting library root
    const backBtn = screen.getByRole("button", { name: "Back" });
    fireEvent.click(backBtn);
    expect(onOpenFolder).toHaveBeenCalledWith(null);
  });

  it("navigates into subfolder on single tap", () => {
    const onOpenFolder = vi.fn();
    renderWithProviders(<MobileLibraryView {...defaultProps} onOpenFolder={onOpenFolder} />);

    const folderTile = screen.getByRole("button", { name: /^Ancient Philosophy/ });
    fireEvent.click(folderTile);
    expect(onOpenFolder).toHaveBeenCalledWith("folder-2");
  });

  it("navigates to notebook on single tap", () => {
    const onOpenNotebook = vi.fn();
    renderWithProviders(<MobileLibraryView {...defaultProps} onOpenNotebook={onOpenNotebook} />);

    const notebookTile = screen.getByRole("button", { name: /^Republic/ });
    fireEvent.click(notebookTile);
    expect(onOpenNotebook).toHaveBeenCalledWith("notebook-1");
  });

  it("opens action drawer and triggers rename flow with >=16px font size", async () => {
    const user = userEvent.setup();
    const onUpdateNotebook = vi.fn();
    renderWithProviders(<MobileLibraryView {...defaultProps} onUpdateNotebook={onUpdateNotebook} />);

    // Open action drawer for notebook
    const actionBtn = screen.getByRole("button", { name: "Actions for Republic" });
    await user.click(actionBtn);

    // Click rename option in drawer
    const renameBtn = screen.getByRole("button", { name: "Rename" });
    await user.click(renameBtn);

    // Rename input should appear
    const input = screen.getByDisplayValue("Republic");
    expect(input.className).toContain("text-base");

    await user.clear(input);
    await user.type(input, "Symposium");

    const saveBtn = screen.getByRole("button", { name: "Save" });
    await user.click(saveBtn);

    expect(onUpdateNotebook).toHaveBeenCalledWith("notebook-1", { title: "Symposium" });
  });

  it("opens folder picker sheet and moves notebook to selected folder", async () => {
    const user = userEvent.setup();
    const onUpdateNotebook = vi.fn();
    renderWithProviders(<MobileLibraryView {...defaultProps} onUpdateNotebook={onUpdateNotebook} />);

    // Open action drawer
    const actionBtn = screen.getByRole("button", { name: "Actions for Republic" });
    await user.click(actionBtn);

    // Click Move to folder
    const moveBtn = screen.getByRole("button", { name: "Move to folder" });
    await user.click(moveBtn);

    // Folder picker drawer should show available folders
    const targetFolderBtn = screen.getByRole("button", { name: /Ancient Philosophy/i });
    await user.click(targetFolderBtn);

    expect(onUpdateNotebook).toHaveBeenCalledWith("notebook-1", { folderId: "folder-2" });
  });

  it("triggers creation sheet from floating action button", async () => {
    const user = userEvent.setup();
    const onCreateNotebook = vi.fn();
    renderWithProviders(<MobileLibraryView {...defaultProps} onCreateNotebook={onCreateNotebook} />);

    const fab = screen.getByRole("button", { name: "Create" });
    await user.click(fab);

    const createNotebookBtn = screen.getByRole("button", { name: /Notebook Start a blank notebook/i });
    await user.click(createNotebookBtn);

    expect(onCreateNotebook).toHaveBeenCalled();
  });
});
