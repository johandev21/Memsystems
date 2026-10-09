import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LibraryItem } from "../model/library-sort";
import { useMobileLibraryActions } from "./use-mobile-library-actions";

describe("useMobileLibraryActions", () => {
  const folderItem: LibraryItem = {
    kind: "folder",
    folder: {
      id: "folder-1",
      name: "Philosophy",
      parentId: null,
      createdAt: "",
      updatedAt: "",
    },
  };

  const notebookItem: LibraryItem = {
    kind: "notebook",
    notebook: {
      id: "notebook-1",
      title: "Republic",
      description: "",
      icon: "notebook",
      coverUrl: null,
      coverVariants: null,
      folderId: "folder-1",
      createdAt: "",
      updatedAt: "",
    },
  };

  it("opens action drawer with selected item", () => {
    const onRenameFolder = vi.fn();
    const onRemoveFolder = vi.fn();
    const onRemoveNotebook = vi.fn();
    const onUpdateNotebook = vi.fn();

    const { result } = renderHook(() =>
      useMobileLibraryActions({
        onRenameFolder,
        onRemoveFolder,
        onRemoveNotebook,
        onUpdateNotebook,
      }),
    );

    expect(result.current.activeItem).toBeNull();

    act(() => {
      result.current.openActionDrawer(folderItem);
    });

    expect(result.current.activeItem).toEqual(folderItem);

    act(() => {
      result.current.closeActionDrawer();
    });

    expect(result.current.activeItem).toBeNull();
  });

  it("handles rename flow for folder", () => {
    const onRenameFolder = vi.fn();
    const onRemoveFolder = vi.fn();
    const onRemoveNotebook = vi.fn();
    const onUpdateNotebook = vi.fn();

    const { result } = renderHook(() =>
      useMobileLibraryActions({
        onRenameFolder,
        onRemoveFolder,
        onRemoveNotebook,
        onUpdateNotebook,
      }),
    );

    act(() => {
      result.current.openActionDrawer(folderItem);
    });
    act(() => {
      result.current.startRename();
    });

    expect(result.current.isRenameOpen).toBe(true);
    expect(result.current.renameValue).toBe("Philosophy");

    act(() => {
      result.current.setRenameValue("Modern Philosophy");
    });
    act(() => {
      result.current.confirmRename();
    });

    expect(onRenameFolder).toHaveBeenCalledWith("folder-1", "Modern Philosophy");
    expect(result.current.isRenameOpen).toBe(false);
    expect(result.current.activeItem).toBeNull();
  });

  it("handles rename flow for notebook", () => {
    const onRenameFolder = vi.fn();
    const onRemoveFolder = vi.fn();
    const onRemoveNotebook = vi.fn();
    const onUpdateNotebook = vi.fn();

    const { result } = renderHook(() =>
      useMobileLibraryActions({
        onRenameFolder,
        onRemoveFolder,
        onRemoveNotebook,
        onUpdateNotebook,
      }),
    );

    act(() => {
      result.current.openActionDrawer(notebookItem);
    });
    act(() => {
      result.current.startRename();
    });

    expect(result.current.renameValue).toBe("Republic");

    act(() => {
      result.current.setRenameValue("Symposium");
    });
    act(() => {
      result.current.confirmRename();
    });

    expect(onUpdateNotebook).toHaveBeenCalledWith("notebook-1", { title: "Symposium" });
  });

  it("handles delete flow", () => {
    const onRenameFolder = vi.fn();
    const onRemoveFolder = vi.fn();
    const onRemoveNotebook = vi.fn();
    const onUpdateNotebook = vi.fn();

    const { result } = renderHook(() =>
      useMobileLibraryActions({
        onRenameFolder,
        onRemoveFolder,
        onRemoveNotebook,
        onUpdateNotebook,
      }),
    );

    act(() => {
      result.current.openActionDrawer(folderItem);
    });
    act(() => {
      result.current.deleteItem();
    });

    expect(onRemoveFolder).toHaveBeenCalledWith("folder-1");
    expect(result.current.activeItem).toBeNull();

    act(() => {
      result.current.openActionDrawer(notebookItem);
    });
    act(() => {
      result.current.deleteItem();
    });

    expect(onRemoveNotebook).toHaveBeenCalledWith("notebook-1");
  });

  it("handles move notebook flow", () => {
    const onRenameFolder = vi.fn();
    const onRemoveFolder = vi.fn();
    const onRemoveNotebook = vi.fn();
    const onUpdateNotebook = vi.fn();

    const { result } = renderHook(() =>
      useMobileLibraryActions({
        onRenameFolder,
        onRemoveFolder,
        onRemoveNotebook,
        onUpdateNotebook,
      }),
    );

    act(() => {
      result.current.openActionDrawer(notebookItem);
    });
    act(() => {
      result.current.moveNotebook("folder-2");
    });

    expect(onUpdateNotebook).toHaveBeenCalledWith("notebook-1", { folderId: "folder-2" });
    expect(result.current.activeItem).toBeNull();
  });
});
