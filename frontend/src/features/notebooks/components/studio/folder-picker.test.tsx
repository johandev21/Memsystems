import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n/i18n";
import type { FolderDTO } from "@/features/study-material-tree";
import { FolderPicker } from "./folder-picker";

const mockFolders: FolderDTO[] = [
  {
    id: "folder-1",
    name: "Chapter 1",
    notebookId: "nb-1",
    parentId: null,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "folder-2",
    name: "Subtopic A",
    notebookId: "nb-1",
    parentId: "folder-1",
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "folder-3",
    name: "Chapter 2",
    notebookId: "nb-1",
    parentId: null,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
];

function renderWithClient(ui: React.ReactElement, folders: FolderDTO[] = mockFolders) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  queryClient.setQueryData(["study-material-folders", "nb-1"], folders);

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("FolderPicker", () => {
  beforeEach(async () => {
    await i18n.loadNamespaces(["notebooks"]);
    await i18n.changeLanguage("en");
  });

  it("renders with root folder selected by default when value is null", () => {
    renderWithClient(<FolderPicker notebookId="nb-1" value={null} onChange={vi.fn()} />);

    expect(screen.getByRole("combobox").textContent).toContain("Notebook Root");
  });

  it("renders with the selected folder name when value is provided", () => {
    renderWithClient(<FolderPicker notebookId="nb-1" value="folder-1" onChange={vi.fn()} />);

    expect(screen.getByRole("combobox").textContent).toContain("Chapter 1");
  });

  it("opens popover, allows selecting a folder, and does not have folder creation input or button", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithClient(<FolderPicker notebookId="nb-1" value={null} onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));

    // Options are visible
    expect(screen.getByRole("button", { name: "Notebook Root" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Chapter 1" })).toBeTruthy();

    // Folder creation controls should NOT exist
    expect(screen.queryByPlaceholderText("New folder name...")).toBeNull();
    expect(screen.queryByRole("button", { name: /Create/i })).toBeNull();

    // Selecting a folder fires onChange
    await user.click(screen.getByRole("button", { name: "Chapter 1" }));
    expect(onChange).toHaveBeenCalledWith("folder-1");
  });

  it("filters folders when user types in search input and shows ancestor path", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithClient(<FolderPicker notebookId="nb-1" value={null} onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));

    const searchInput = screen.getByPlaceholderText("Search folders...");
    expect(searchInput).toBeTruthy();

    // Type query matching child folder
    await user.type(searchInput, "Subtopic");

    // "Chapter 2" should not be visible in search results
    expect(screen.queryByRole("button", { name: /Chapter 2/ })).toBeNull();

    // "Subtopic A" should be displayed along with ancestor path "Chapter 1"
    const resultButton = screen.getByRole("button", { name: /Subtopic A/ });
    expect(resultButton).toBeTruthy();
    expect(resultButton.textContent).toContain("Chapter 1");

    // Clicking search result selects it
    await user.click(resultButton);
    expect(onChange).toHaveBeenCalledWith("folder-2");
  });

  it("displays empty state when search finds no matches", async () => {
    const user = userEvent.setup();
    renderWithClient(<FolderPicker notebookId="nb-1" value={null} onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));
    const searchInput = screen.getByPlaceholderText("Search folders...");

    await user.type(searchInput, "Nonexistent query");
    expect(screen.getByText("No folders found")).toBeTruthy();
  });

  it("allows toggling expand/collapse on parent folders", async () => {
    const user = userEvent.setup();
    renderWithClient(<FolderPicker notebookId="nb-1" value={null} onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));

    // Find collapse button for Chapter 1
    const collapseButton = screen.queryByRole("button", { name: "Collapse folder" });
    if (collapseButton) {
      // If currently expanded, click to collapse
      await user.click(collapseButton);
      expect(screen.queryByRole("button", { name: "Subtopic A" })).toBeNull();

      // Click to expand again
      const expandButton = screen.getByRole("button", { name: "Expand folder" });
      await user.click(expandButton);
      expect(screen.getByRole("button", { name: "Subtopic A" })).toBeTruthy();
    } else {
      // If collapsed by default, click to expand
      const expandButton = screen.getByRole("button", { name: "Expand folder" });
      await user.click(expandButton);
      expect(screen.getByRole("button", { name: "Subtopic A" })).toBeTruthy();
    }
  });
});
