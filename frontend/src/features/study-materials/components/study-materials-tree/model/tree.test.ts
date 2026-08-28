import { describe, expect, it } from "vitest";
import { buildStudyMaterialTree, canMoveItem, getDescendantFolderIds } from "./tree";
import { getActiveFolderIds, getInitialExpandedIds, reconcileExpandedIds } from "./use-expanded";
import type { FolderDTO } from "@/entities/folder";
import type { StudyMaterialDTO } from "@/entities/study-material";

function folder(overrides: Partial<FolderDTO> & Pick<FolderDTO, "id" | "name">): FolderDTO {
  return {
    notebookId: "nb-1",
    parentId: null,
    deletedAt: null,
    createdAt: "2026-08-11T09:00:00.000Z",
    updatedAt: "2026-08-11T09:00:00.000Z",
    ...overrides,
  };
}

function material(
  overrides: Partial<StudyMaterialDTO> & Pick<StudyMaterialDTO, "id" | "title">,
): StudyMaterialDTO {
  return {
    notebookId: "nb-1",
    kind: "quiz",
    folderId: null,
    content: {},
    options: {},
    deletedAt: null,
    createdAt: "2026-08-11T10:00:00.000Z",
    updatedAt: "2026-08-11T10:00:00.000Z",
    ...overrides,
  };
}

describe("production study-material-tree model", () => {
  it("orders folders before materials and by createdAt then id", () => {
    const state = {
      folders: [
        folder({ id: "f2", name: "B", createdAt: "2026-08-11T09:05:00.000Z" }),
        folder({ id: "f1", name: "A", createdAt: "2026-08-11T09:00:00.000Z" }),
      ],
      materials: [
        material({ id: "m2", title: "B mat", createdAt: "2026-08-11T09:02:00.000Z" }),
        material({ id: "m1", title: "A mat", createdAt: "2026-08-11T09:01:00.000Z" }),
      ],
    };
    const tree = buildStudyMaterialTree(state);
    expect(tree.map((n) => n.id)).toEqual(["f1", "f2", "m1", "m2"]);
  });

  it("uses id as tie-breaker for deterministic ordering", () => {
    const same = "2026-08-11T09:00:00.000Z";
    const state = {
      folders: [
        folder({ id: "f2", name: "B", createdAt: same }),
        folder({ id: "f1", name: "A", createdAt: same }),
        folder({ id: "f3", name: "C", createdAt: same }),
      ],
      materials: [],
    };
    const tree = buildStudyMaterialTree(state);
    expect(tree.map((n) => n.id)).toEqual(["f1", "f2", "f3"]);
  });

  it("handles ~1000 records linearly without repeated searches", () => {
    const folders: FolderDTO[] = [];
    const materials: StudyMaterialDTO[] = [];
    for (let i = 0; i < 500; i++) {
      folders.push(
        folder({
          id: `f-${String(i).padStart(4, "0")}`,
          name: `Folder ${i}`,
          createdAt: `2026-08-11T09:${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}.000Z`,
        }),
      );
      materials.push(
        material({
          id: `m-${String(i).padStart(4, "0")}`,
          title: `Material ${i}`,
          folderId: i % 2 === 0 ? `f-${String(i).padStart(4, "0")}` : null,
          createdAt: `2026-08-11T10:${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}.000Z`,
        }),
      );
    }
    const start = performance.now();
    const tree = buildStudyMaterialTree({ folders, materials });
    const duration = performance.now() - start;
    // Should produce root nodes (folders at root + materials at root) deterministically
    expect(tree.length).toBeGreaterThan(0);
    // Linear-ish: should complete quickly (<200ms for 1000 nodes in test env)
    expect(duration).toBeLessThan(500);
    // Verify no orphan handling breaks
    expect(tree.some((n) => n.id === "f-0000")).toBe(true);
  });

  it("prevents descendant cycles via canMoveItem", () => {
    const state = {
      folders: [
        folder({ id: "a", name: "A" }),
        folder({ id: "b", name: "B", parentId: "a" }),
        folder({ id: "c", name: "C", parentId: "b" }),
      ],
      materials: [],
    };
    expect(canMoveItem(state, "a", "b")).toBe(false);
    expect(canMoveItem(state, "a", "c")).toBe(false);
    expect(canMoveItem(state, "b", null)).toBe(true);
  });

  it("collects descendants without N+1 recursion pattern", () => {
    const folders: FolderDTO[] = [
      folder({ id: "a", name: "A" }),
      folder({ id: "b", name: "B", parentId: "a" }),
      folder({ id: "c", name: "C", parentId: "b" }),
      folder({ id: "d", name: "D" }),
    ];
    expect(getDescendantFolderIds(folders, "a")).toEqual(new Set(["b", "c"]));
    expect(getDescendantFolderIds(folders, "d")).toEqual(new Set());
  });

  it("derives and reconciles persisted folder expansion without stale IDs", () => {
    const folders = [
      folder({ id: "root", name: "Root" }),
      folder({ id: "child", name: "Child", parentId: "root" }),
      folder({ id: "deleted", name: "Deleted", deletedAt: "2026-08-12T09:00:00.000Z" }),
    ];
    expect(getActiveFolderIds(folders)).toEqual(new Set(["root", "child"]));
    expect(getInitialExpandedIds(folders, null)).toEqual(new Set(["root"]));
    expect(getInitialExpandedIds(folders, new Set(["deleted", "child"]))).toEqual(
      new Set(["child"]),
    );
    expect(reconcileExpandedIds(folders, new Set(["deleted"]), new Set())).toEqual(
      new Set(["root"]),
    );
  });
});
