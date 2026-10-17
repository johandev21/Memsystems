import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import type { Source } from "../../api/sources";
import type { SourceFolder } from "../../types/source-folder.types";
import { MobileSourcesView, type MobileSourcesViewProps } from "./mobile-sources-view";

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

function makeSource(id: string, title: string, folderId: string | null = null): Source {
  return {
    id,
    title,
    folderId,
    notebookId: "nb-1",
    kind: "file",
    url: null,
    modality: "document",
    contentType: "application/pdf",
    fileSize: 1024,
    processingStatus: "ready",
    createdAt: "2026-10-09T10:00:00.000Z",
  };
}

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("MobileSourcesView", () => {
  const defaultProps: MobileSourcesViewProps = {
    notebookId: "nb-1",
    sources: [],
    folders: [],
    pendingUploads: [],
    isPending: false,
    isError: false,
    onRetryLoad: vi.fn(),
    onSelectSource: vi.fn(),
    onCancelPendingUpload: vi.fn(),
    canMove: () => true,
    onMove: vi.fn(),
    onCreateFolder: vi.fn(),
    onDeleteFolder: vi.fn(),
    onDeleteSource: vi.fn(),
    onRetrySource: vi.fn(),
    onCancelSource: vi.fn(),
    editingItemId: null,
    onBeginRename: vi.fn(),
    onRenameCommit: vi.fn(),
    onRenameCancel: vi.fn(),
  };

  it("renders empty state when there are no sources or folders", () => {
    renderWithClient(<MobileSourcesView {...defaultProps} />);

    expect(screen.getByText(/no sources yet/i)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /add source/i }).length).toBeGreaterThan(0);
  });

  it("renders loading skeletons when isPending is true", () => {
    const { container } = renderWithClient(<MobileSourcesView {...defaultProps} isPending={true} />);

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it("renders error state and retries on button tap", () => {
    const handleRetry = vi.fn();
    renderWithClient(
      <MobileSourcesView {...defaultProps} isError={true} onRetryLoad={handleRetry} />,
    );

    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(handleRetry).toHaveBeenCalledOnce();
  });

  it("renders folders and sources, and navigates into a folder and back", () => {
    const folders = [makeFolder("f-1", "Philosophy")];
    const sources = [
      makeSource("s-1", "Nicomachean Ethics", null),
      makeSource("s-2", "Metaphysics", "f-1"),
    ];
    const onSelectSource = vi.fn();

    renderWithClient(
      <MobileSourcesView
        {...defaultProps}
        folders={folders}
        sources={sources}
        onSelectSource={onSelectSource}
      />,
    );

    // Root items visible
    expect(screen.getByText("Philosophy")).toBeTruthy();
    expect(screen.getByText("Nicomachean Ethics")).toBeTruthy();
    expect(screen.queryByText("Metaphysics")).toBeNull();

    // Click on root source opens it
    fireEvent.click(screen.getByText("Nicomachean Ethics"));
    expect(onSelectSource).toHaveBeenCalledWith("s-1");

    // Drill down into Philosophy folder
    fireEvent.click(screen.getByText("Philosophy"));

    // Nested source is now visible, root source is hidden
    expect(screen.getByText("Metaphysics")).toBeTruthy();
    expect(screen.queryByText("Nicomachean Ethics")).toBeNull();

    // Back button returns to root
    const backBtn = screen.getByRole("button", { name: /back/i });
    expect(backBtn).toBeTruthy();
    fireEvent.click(backBtn);

    // Root items visible again
    expect(screen.getByText("Philosophy")).toBeTruthy();
    expect(screen.getByText("Nicomachean Ethics")).toBeTruthy();
  });

  it("does not render section header at root, but renders navigation header when inside a folder", () => {
    const folders = [makeFolder("f-1", "Philosophy")];
    renderWithClient(<MobileSourcesView {...defaultProps} folders={folders} />);

    // At root: no header bar is rendered
    expect(screen.queryByRole("banner")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Philosophy" })).toBeNull();

    // Navigate inside folder: navigation header appears with folder name
    fireEvent.click(screen.getByText("Philosophy"));
    expect(screen.getByRole("heading", { name: "Philosophy" })).toBeTruthy();
  });

  it("opens create drawer when tapping FAB and handles create folder", () => {
    const handleCreateFolder = vi.fn();
    const { container } = renderWithClient(
      <MobileSourcesView {...defaultProps} onCreateFolder={handleCreateFolder} />,
    );

    const fab = container.querySelector('[data-slot="mobile-add-source-fab"]') as HTMLElement;
    expect(fab).toBeTruthy();
    fireEvent.click(fab);

    // Create drawer options
    const newFolderOption = screen.getByRole("button", { name: /new folder/i });
    expect(newFolderOption).toBeTruthy();

    fireEvent.click(newFolderOption);

    const input = screen.getByPlaceholderText(/folder name/i);
    fireEvent.change(input, { target: { value: "Research" } });
    const createBtn = screen.getByRole("button", { name: /^create$/i });
    fireEvent.click(createBtn);

    expect(handleCreateFolder).toHaveBeenCalledWith(null, "Research");
  });
});
