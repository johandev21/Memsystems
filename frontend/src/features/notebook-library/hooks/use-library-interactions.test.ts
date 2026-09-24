import type { DragEndEvent } from "@dnd-kit/core";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LibraryFolder, LibraryNotebook } from "../model/types";
import { useLibraryInteractions } from "./use-library-interactions";

const folders: LibraryFolder[] = [
  { id: "f1", name: "One", parentId: null, createdAt: "", updatedAt: "" },
  { id: "f2", name: "Two", parentId: "f1", createdAt: "", updatedAt: "" },
];

const notebooks: LibraryNotebook[] = [
  {
    id: "n1",
    title: "Filed notebook",
    description: "",
    icon: "notebook",
    coverUrl: null,
    coverVariants: null,
    folderId: "f1",
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "n2",
    title: "Root notebook",
    description: "",
    icon: "notebook",
    coverUrl: null,
    coverVariants: null,
    folderId: null,
    createdAt: "",
    updatedAt: "",
  },
];

function dragEnd(active: Record<string, unknown>, over: Record<string, unknown> | null) {
  return {
    active: { data: { current: active } },
    over: over ? { data: { current: over } } : null,
  } as unknown as DragEndEvent;
}

function renderInteractions() {
  const onMoveFolder = vi.fn();
  const onMoveNotebook = vi.fn();
  const { result } = renderHook(() =>
    useLibraryInteractions({ folders, notebooks, onMoveFolder, onMoveNotebook }),
  );
  return { result, onMoveFolder, onMoveNotebook };
}

describe("useLibraryInteractions", () => {
  it("moves a notebook into a folder", () => {
    const { result, onMoveNotebook } = renderInteractions();
    act(() =>
      result.current.handleDragEnd(
        dragEnd({ kind: "notebook", notebookId: "n2" }, { folderId: "f1" }),
      ),
    );
    expect(onMoveNotebook).toHaveBeenCalledWith("n2", "f1");
  });

  it("moves a notebook back to the library root", () => {
    const { result, onMoveNotebook } = renderInteractions();
    act(() =>
      result.current.handleDragEnd(
        dragEnd({ kind: "notebook", notebookId: "n1" }, { folderId: null }),
      ),
    );
    expect(onMoveNotebook).toHaveBeenCalledWith("n1", null);
  });

  it("ignores dropping a notebook onto its current folder", () => {
    const { result, onMoveNotebook } = renderInteractions();
    act(() =>
      result.current.handleDragEnd(
        dragEnd({ kind: "notebook", notebookId: "n1" }, { folderId: "f1" }),
      ),
    );
    expect(onMoveNotebook).not.toHaveBeenCalled();
  });

  it("moves a folder into another folder", () => {
    const { result, onMoveFolder } = renderInteractions();
    act(() =>
      result.current.handleDragEnd(dragEnd({ kind: "folder", folderId: "f2" }, { folderId: null })),
    );
    expect(onMoveFolder).toHaveBeenCalledWith("f2", null);
  });

  it("ignores dropping a folder onto itself or one of its descendants", () => {
    const { result, onMoveFolder } = renderInteractions();
    act(() =>
      result.current.handleDragEnd(dragEnd({ kind: "folder", folderId: "f1" }, { folderId: "f1" })),
    );
    act(() =>
      result.current.handleDragEnd(dragEnd({ kind: "folder", folderId: "f1" }, { folderId: "f2" })),
    );
    expect(onMoveFolder).not.toHaveBeenCalled();
  });

  it("ignores drops without a folder target", () => {
    const { result, onMoveFolder, onMoveNotebook } = renderInteractions();
    act(() =>
      result.current.handleDragEnd(
        dragEnd({ kind: "notebook", notebookId: "n1" }, { somethingElse: true }),
      ),
    );
    act(() => result.current.handleDragEnd(dragEnd({ kind: "folder", folderId: "f1" }, null)));
    expect(onMoveNotebook).not.toHaveBeenCalled();
    expect(onMoveFolder).not.toHaveBeenCalled();
  });
});
