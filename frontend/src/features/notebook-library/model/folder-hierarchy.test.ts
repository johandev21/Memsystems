import { describe, expect, it } from "vitest";
import {
  canMoveFolder,
  childFolders,
  descendantFolderIds,
  folderAncestors,
  folderPath,
} from "./folder-hierarchy";
import type { LibraryFolder } from "./types";

const folders: LibraryFolder[] = [
  { id: "a", name: "A", parentId: null, createdAt: "", updatedAt: "" },
  { id: "b", name: "B", parentId: "a", createdAt: "", updatedAt: "" },
  { id: "c", name: "C", parentId: "b", createdAt: "", updatedAt: "" },
];

describe("folder hierarchy", () => {
  it("returns immediate children and ancestor paths", () => {
    expect(childFolders(folders, "a").map((folder) => folder.id)).toEqual(["b"]);
    expect(folderAncestors(folders, "c").map((folder) => folder.id)).toEqual(["a", "b", "c"]);
    expect(folderPath(folders, "c")).toBe("A / B / C");
  });
  it("rejects cycles and missing targets", () => {
    expect(descendantFolderIds(folders, "a")).toEqual(new Set(["b", "c"]));
    expect(canMoveFolder(folders, "a", "c")).toBe(false);
    expect(canMoveFolder(folders, "a", "missing")).toBe(false);
    expect(canMoveFolder(folders, "b", "a")).toBe(false);
    expect(canMoveFolder(folders, "c", null)).toBe(true);
  });
});
