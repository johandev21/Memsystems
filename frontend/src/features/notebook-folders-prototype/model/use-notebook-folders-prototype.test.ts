import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./sample-data", () => ({
  SAMPLE_FOLDERS: [
    {
      id: "folder-a",
      name: "Folder A",
      parentId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "folder-b",
      name: "Folder B",
      parentId: "folder-a",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  SAMPLE_NOTEBOOKS: [
    {
      id: "notebook-a",
      title: "Notebook A",
      description: "",
      icon: "Notebook",
      coverUrl: null,
      folderId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "notebook-nested",
      title: "Nested notebook",
      description: "",
      icon: "Notebook",
      coverUrl: null,
      folderId: "folder-a",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
}));

import { useNotebookFoldersPrototype } from "./use-notebook-folders-prototype";

describe("useNotebookFoldersPrototype drafts", () => {
  it("creates a draft notebook at the current level", () => {
    const { result } = renderHook(() => useNotebookFoldersPrototype());
    act(() => result.current.beginCreateNotebook());
    expect(result.current.draft?.kind).toBe("notebook");
    const created = result.current.notebooks.find(
      (notebook) => notebook.id === result.current.draft?.id,
    );
    expect(created).toMatchObject({ title: "Untitled notebook", coverUrl: null, folderId: null });
  });

  it("assigns a draft notebook to the open folder", () => {
    const { result } = renderHook(() => useNotebookFoldersPrototype());
    act(() => result.current.setActiveFolderId("folder-a"));
    act(() => result.current.beginCreateNotebook());
    const created = result.current.notebooks.find(
      (notebook) => notebook.id === result.current.draft?.id,
    );
    expect(created?.folderId).toBe("folder-a");
  });

  it("moves folders and promotes contents when removing them", () => {
    const { result } = renderHook(() => useNotebookFoldersPrototype());
    act(() => result.current.moveFolder("folder-b", null));
    expect(result.current.folders.find((folder) => folder.id === "folder-b")?.parentId).toBeNull();
    act(() => result.current.moveFolder("folder-b", "folder-a"));
    act(() => result.current.removeFolder("folder-a"));
    expect(result.current.folders.find((folder) => folder.id === "folder-b")?.parentId).toBeNull();
    expect(
      result.current.notebooks.find((notebook) => notebook.id === "notebook-nested")?.folderId,
    ).toBeNull();
    act(() => result.current.undo());
    expect(result.current.folders.find((folder) => folder.id === "folder-a")).toBeTruthy();
    expect(result.current.folders.find((folder) => folder.id === "folder-b")?.parentId).toBe(
      "folder-a",
    );
    expect(
      result.current.notebooks.find((notebook) => notebook.id === "notebook-nested")?.folderId,
    ).toBe("folder-a");
  });

  it("rejects folder cycles and missing destinations without adding undo history", () => {
    const { result } = renderHook(() => useNotebookFoldersPrototype());

    act(() => result.current.moveFolder("folder-a", "folder-b"));
    act(() => result.current.moveFolder("folder-a", "missing"));

    expect(result.current.folders.find((folder) => folder.id === "folder-a")?.parentId).toBeNull();
    expect(result.current.canUndo).toBe(false);
  });

  it("creates a folder inside the open folder", () => {
    const { result } = renderHook(() => useNotebookFoldersPrototype());
    act(() => result.current.setActiveFolderId("folder-a"));
    act(() => result.current.beginCreateFolder());
    expect(result.current.activeFolderId).toBe("folder-a");
    const created = result.current.folders.find((folder) => folder.id === result.current.draft?.id);
    expect(created?.name).toBe("Untitled folder");
    expect(created?.parentId).toBe("folder-a");
  });

  it("commits the draft name and undoes creation in one step", () => {
    const { result } = renderHook(() => useNotebookFoldersPrototype());
    act(() => result.current.beginCreateNotebook());
    const id = result.current.draft?.id ?? "";
    act(() => result.current.commitDraft("Ideas"));
    expect(result.current.draft).toBeNull();
    expect(result.current.notebooks.find((notebook) => notebook.id === id)?.title).toBe("Ideas");
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.undo());
    expect(result.current.notebooks.some((notebook) => notebook.id === id)).toBe(false);
  });

  it("falls back to the placeholder on an empty commit", () => {
    const { result } = renderHook(() => useNotebookFoldersPrototype());
    act(() => result.current.beginCreateFolder());
    const id = result.current.draft?.id ?? "";
    act(() => result.current.commitDraft("   "));
    expect(result.current.folders.find((folder) => folder.id === id)?.name).toBe("Untitled folder");
  });

  it("cancels a draft without touching history", () => {
    const { result } = renderHook(() => useNotebookFoldersPrototype());
    act(() => result.current.beginCreateFolder());
    const id = result.current.draft?.id ?? "";
    act(() => result.current.cancelDraft());
    expect(result.current.folders.some((folder) => folder.id === id)).toBe(false);
    expect(result.current.draft).toBeNull();
    expect(result.current.canUndo).toBe(false);
  });

  it("cancels an active draft when undoing", () => {
    const { result } = renderHook(() => useNotebookFoldersPrototype());
    act(() => result.current.beginCreateNotebook());
    const id = result.current.draft?.id ?? "";
    act(() => result.current.undo());
    expect(result.current.notebooks.some((notebook) => notebook.id === id)).toBe(false);
    expect(result.current.canUndo).toBe(false);
  });

  it("clamps committed folder names to 50 characters", () => {
    const { result } = renderHook(() => useNotebookFoldersPrototype());
    act(() => result.current.beginCreateFolder());
    const id = result.current.draft?.id ?? "";
    act(() => result.current.commitDraft("f".repeat(80)));
    expect(result.current.folders.find((folder) => folder.id === id)?.name).toBe("f".repeat(50));
  });

  it("clamps notebook titles to 50 characters", () => {
    const { result } = renderHook(() => useNotebookFoldersPrototype());
    act(() => result.current.updateNotebook("notebook-a", { title: "t".repeat(80) }));
    expect(result.current.notebooks.find((notebook) => notebook.id === "notebook-a")?.title).toBe(
      "t".repeat(50),
    );
  });
});
