import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { FolderDTO } from "../../types";
import type { StudyMaterialDTO } from "@/features/study-material-viewer";
import { useMobileStudyMaterialsNavigation } from "./use-mobile-study-materials-navigation";

function makeFolder(id: string, name: string, parentId: string | null = null): FolderDTO {
  return {
    id,
    name,
    parentId,
    notebookId: "nb-1",
    deletedAt: null,
    createdAt: "2026-10-09T10:00:00.000Z",
    updatedAt: "2026-10-09T10:00:00.000Z",
  };
}

function makeMaterial(id: string, title: string, folderId: string | null = null): StudyMaterialDTO {
  return {
    id,
    title,
    folderId,
    notebookId: "nb-1",
    kind: "quiz",
    content: {},
    options: {},
    deletedAt: null,
    createdAt: "2026-10-09T10:00:00.000Z",
    updatedAt: "2026-10-09T10:00:00.000Z",
  };
}

describe("useMobileStudyMaterialsNavigation", () => {
  const folders = [
    makeFolder("f-1", "Folder A", null),
    makeFolder("f-2", "Subfolder A1", "f-1"),
  ];
  const materials = [
    makeMaterial("m-1", "Root Material", null),
    makeMaterial("m-2", "Nested Material", "f-1"),
    makeMaterial("m-3", "Deep Material", "f-2"),
  ];

  it("starts at root with root folders and materials", () => {
    const { result } = renderHook(() => useMobileStudyMaterialsNavigation(folders, materials));

    expect(result.current.activeFolderId).toBeNull();
    expect(result.current.activeFolderName).toBeUndefined();
    expect(result.current.items).toHaveLength(2); // f-1 and m-1
    expect(result.current.items.map((i) => i.id)).toEqual(["f-1", "m-1"]);
  });

  it("navigates forward into a folder", () => {
    const { result } = renderHook(() => useMobileStudyMaterialsNavigation(folders, materials));

    act(() => {
      result.current.openFolder("f-1");
    });

    expect(result.current.activeFolderId).toBe("f-1");
    expect(result.current.activeFolderName).toBe("Folder A");
    expect(result.current.direction).toBe("forward");
    expect(result.current.items.map((i) => i.id)).toEqual(["f-2", "m-2"]);
  });

  it("navigates back from subfolder to parent folder and then to root", () => {
    const { result } = renderHook(() => useMobileStudyMaterialsNavigation(folders, materials));

    act(() => {
      result.current.openFolder("f-1");
    });
    act(() => {
      result.current.openFolder("f-2");
    });

    expect(result.current.activeFolderId).toBe("f-2");
    expect(result.current.activeFolderName).toBe("Subfolder A1");
    expect(result.current.items.map((i) => i.id)).toEqual(["m-3"]);

    act(() => {
      result.current.goBack();
    });

    expect(result.current.activeFolderId).toBe("f-1");
    expect(result.current.activeFolderName).toBe("Folder A");
    expect(result.current.direction).toBe("back");

    act(() => {
      result.current.goBack();
    });

    expect(result.current.activeFolderId).toBeNull();
    expect(result.current.direction).toBe("back");
  });

  it("falls back to root if the active folder is removed from tree", () => {
    let currentFolders = folders;
    const { result, rerender } = renderHook(() =>
      useMobileStudyMaterialsNavigation(currentFolders, materials),
    );

    act(() => {
      result.current.openFolder("f-1");
    });
    expect(result.current.activeFolderId).toBe("f-1");

    // Simulate folder deletion
    currentFolders = [];
    rerender();

    expect(result.current.activeFolderId).toBeNull();
    expect(result.current.items.map((i) => i.id)).toEqual(["m-1", "m-2", "m-3"]);
  });
});
