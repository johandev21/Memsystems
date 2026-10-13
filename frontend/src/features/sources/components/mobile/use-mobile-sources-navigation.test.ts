import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Source } from "../../api/sources";
import type { SourceFolder } from "../../types/source-folder.types";
import { useMobileSourcesNavigation } from "./use-mobile-sources-navigation";

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

describe("useMobileSourcesNavigation", () => {
  const folders = [
    makeFolder("f-1", "Folder A", null),
    makeFolder("f-2", "Subfolder A1", "f-1"),
  ];
  const sources = [
    makeSource("s-1", "Root Source", null),
    makeSource("s-2", "Nested Source", "f-1"),
    makeSource("s-3", "Deep Source", "f-2"),
  ];

  it("starts at root with root folders and sources", () => {
    const { result } = renderHook(() => useMobileSourcesNavigation(folders, sources));

    expect(result.current.activeFolderId).toBeNull();
    expect(result.current.activeFolderName).toBeUndefined();
    expect(result.current.items).toHaveLength(2); // f-1 and s-1
    expect(result.current.items.map((i) => i.id)).toEqual(["f-1", "s-1"]);
  });

  it("navigates forward into a folder", () => {
    const { result } = renderHook(() => useMobileSourcesNavigation(folders, sources));

    act(() => {
      result.current.openFolder("f-1");
    });

    expect(result.current.activeFolderId).toBe("f-1");
    expect(result.current.activeFolderName).toBe("Folder A");
    expect(result.current.direction).toBe("forward");
    expect(result.current.items.map((i) => i.id)).toEqual(["f-2", "s-2"]);
  });

  it("navigates back from subfolder to parent folder and then to root", () => {
    const { result } = renderHook(() => useMobileSourcesNavigation(folders, sources));

    act(() => {
      result.current.openFolder("f-1");
    });
    act(() => {
      result.current.openFolder("f-2");
    });

    expect(result.current.activeFolderId).toBe("f-2");
    expect(result.current.activeFolderName).toBe("Subfolder A1");
    expect(result.current.items.map((i) => i.id)).toEqual(["s-3"]);

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
      useMobileSourcesNavigation(currentFolders, sources),
    );

    act(() => {
      result.current.openFolder("f-1");
    });
    expect(result.current.activeFolderId).toBe("f-1");

    // Simulate folder deletion
    currentFolders = [];
    rerender();

    expect(result.current.activeFolderId).toBeNull();
    expect(result.current.items.map((i) => i.id)).toEqual(["s-1", "s-2", "s-3"]);
  });
});
