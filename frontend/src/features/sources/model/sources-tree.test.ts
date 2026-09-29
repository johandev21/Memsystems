import { describe, expect, it } from "vitest";
import {
  buildSourcesTree,
  canMoveSourcesItem,
  deleteSourcesFolder,
  flattenVisibleTreeWithDepth,
  getDescendantFolderIds,
  moveSourcesItem,
  renameSourcesItem,
} from "./sources-tree";
import { flattenVisibleTree } from "@/components/ui/tree";
import type { Source } from "../types/source.types";
import type { SourceFolder } from "../types/source-folder.types";

function createFolder(overrides: Partial<SourceFolder> & { id: string; name: string }): SourceFolder {
  return {
    notebookId: "nb-1",
    parentId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createSource(overrides: Partial<Source> & { id: string; title: string }): Source {
  return {
    notebookId: "nb-1",
    kind: "text",
    url: null,
    contentType: null,
    fileSize: null,
    folderId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Sources Tree builder (pure unit)", () => {
  it("places folders before sources at root", () => {
    const folders = [createFolder({ id: "f1", name: "Folder A", createdAt: "2026-01-02T00:00:00.000Z" })];
    const sources = [createSource({ id: "s1", title: "Source A", createdAt: "2026-01-01T00:00:00.000Z" })];

    const tree = buildSourcesTree({ folders, sources });

    expect(tree.map((node) => node.id)).toEqual(["f1", "s1"]);
    expect(tree[0].type).toBe("folder");
    expect(tree[1].type).toBe("source");
  });

  it("sorts items by stable creation order (createdAt then id)", () => {
    const folders = [
      createFolder({ id: "f2", name: "Later", createdAt: "2026-01-02T00:00:00.000Z" }),
      createFolder({ id: "f1", name: "Earlier", createdAt: "2026-01-01T00:00:00.000Z" }),
      createFolder({ id: "f-b", name: "Tie B", createdAt: "2026-01-03T00:00:00.000Z" }),
      createFolder({ id: "f-a", name: "Tie A", createdAt: "2026-01-03T00:00:00.000Z" }),
    ];
    const sources = [
      createSource({ id: "s2", title: "Source 2", createdAt: "2026-01-05T00:00:00.000Z" }),
      createSource({ id: "s1", title: "Source 1", createdAt: "2026-01-04T00:00:00.000Z" }),
    ];

    const tree = buildSourcesTree({ folders, sources });

    expect(tree.map((node) => node.id)).toEqual(["f1", "f2", "f-a", "f-b", "s1", "s2"]);
  });

  it("reparents orphaned folders and sources to root", () => {
    const folders = [
      createFolder({ id: "f-orphan", name: "Orphan Folder", parentId: "non-existent-folder" }),
    ];
    const sources = [
      createSource({ id: "s-orphan", title: "Orphan Source", folderId: "non-existent-folder" }),
    ];

    const tree = buildSourcesTree({ folders, sources });

    expect(tree.map((node) => node.id)).toEqual(["f-orphan", "s-orphan"]);
  });

  it("nests child folders and child sources under their parent folder", () => {
    const folders = [
      createFolder({ id: "parent", name: "Parent Folder" }),
      createFolder({ id: "child", name: "Child Folder", parentId: "parent" }),
    ];
    const sources = [
      createSource({ id: "s-in-child", title: "Source in Child", folderId: "child" }),
      createSource({ id: "s-in-parent", title: "Source in Parent", folderId: "parent" }),
      createSource({ id: "s-root", title: "Source at Root", folderId: null }),
    ];

    const tree = buildSourcesTree({ folders, sources });

    expect(tree).toHaveLength(2); // parent folder and s-root
    expect(tree[0].id).toBe("parent");
    expect(tree[1].id).toBe("s-root");

    const parentNode = tree[0];
    expect(parentNode.children).toHaveLength(2); // child folder and s-in-parent
    expect(parentNode.children[0].id).toBe("child");
    expect(parentNode.children[1].id).toBe("s-in-parent");

    const childNode = parentNode.children[0];
    expect(childNode.children).toHaveLength(1);
    expect(childNode.children[0].id).toBe("s-in-child");
  });

  it("flattens visible tree respecting expanded folder IDs", () => {
    const folders = [
      createFolder({ id: "f1", name: "Folder 1" }),
      createFolder({ id: "f2", name: "Folder 2", parentId: "f1" }),
    ];
    const sources = [
      createSource({ id: "s-f2", title: "In F2", folderId: "f2" }),
      createSource({ id: "s-root", title: "Root", folderId: null }),
    ];

    const tree = buildSourcesTree({ folders, sources });

    // When f1 is collapsed
    const collapsedVisible = flattenVisibleTree(tree, new Set());
    expect(collapsedVisible.map((n) => n.id)).toEqual(["f1", "s-root"]);

    // When f1 is expanded but f2 is collapsed
    const f1OpenVisible = flattenVisibleTree(tree, new Set(["f1"]));
    expect(f1OpenVisible.map((n) => n.id)).toEqual(["f1", "f2", "s-root"]);

    // When both f1 and f2 are expanded
    const allOpenVisible = flattenVisibleTree(tree, new Set(["f1", "f2"]));
    expect(allOpenVisible.map((n) => n.id)).toEqual(["f1", "f2", "s-f2", "s-root"]);
  });

  it("flattens visible rows with depth matching display order", () => {
    const folders = [
      createFolder({ id: "f1", name: "Folder 1" }),
      createFolder({ id: "f2", name: "Folder 2", parentId: "f1" }),
    ];
    const sources = [
      createSource({ id: "s-f2", title: "In F2", folderId: "f2" }),
      createSource({ id: "s-root", title: "Root", folderId: null }),
    ];

    const tree = buildSourcesTree({ folders, sources });

    // Collapsed: children hidden, root depths
    const collapsed = flattenVisibleTreeWithDepth(tree, new Set());
    expect(collapsed.map((r) => [r.node.id, r.depth])).toEqual([
      ["f1", 0],
      ["s-root", 0],
    ]);

    // Expanded: matching order to flattenVisibleTree, with depth
    const expanded = flattenVisibleTreeWithDepth(tree, new Set(["f1", "f2"]));
    expect(expanded.map((r) => [r.node.id, r.depth])).toEqual([
      ["f1", 0],
      ["f2", 1],
      ["s-f2", 2],
      ["s-root", 0],
    ]);
    expect(expanded.map((r) => r.node.id)).toEqual(
      flattenVisibleTree(tree, new Set(["f1", "f2"])).map((n) => n.id),
    );
  });
});

describe("Sources Tree move operations (pure unit)", () => {
  const folders: SourceFolder[] = [
    createFolder({ id: "f-root1", name: "Root 1", parentId: null }),
    createFolder({ id: "f-root2", name: "Root 2", parentId: null }),
    createFolder({ id: "f-child1", name: "Child 1", parentId: "f-root1" }),
    createFolder({ id: "f-grandchild1", name: "Grandchild 1", parentId: "f-child1" }),
  ];

  const sources: Source[] = [
    createSource({ id: "s-root", title: "Source at root", folderId: null }),
    createSource({ id: "s-child", title: "Source in child", folderId: "f-child1" }),
  ];

  const state = { folders, sources };

  it("identifies descendant folder IDs accurately", () => {
    const rootDescendants = getDescendantFolderIds(folders, "f-root1");
    expect(rootDescendants).toEqual(new Set(["f-child1", "f-grandchild1"]));

    const childDescendants = getDescendantFolderIds(folders, "f-child1");
    expect(childDescendants).toEqual(new Set(["f-grandchild1"]));

    const leafDescendants = getDescendantFolderIds(folders, "f-grandchild1");
    expect(leafDescendants).toEqual(new Set());
  });

  describe("canMoveSourcesItem guards", () => {
    it("refuses moving a folder onto itself", () => {
      expect(canMoveSourcesItem(state, "f-root1", "f-root1")).toBe(false);
      expect(canMoveSourcesItem(state, "f-child1", "f-child1")).toBe(false);
    });

    it("refuses moving a folder onto its current parent", () => {
      expect(canMoveSourcesItem(state, "f-root1", null)).toBe(false); // already at root
      expect(canMoveSourcesItem(state, "f-child1", "f-root1")).toBe(false); // already in f-root1
    });

    it("refuses moving a folder into its descendant (direct or indirect)", () => {
      expect(canMoveSourcesItem(state, "f-root1", "f-child1")).toBe(false);
      expect(canMoveSourcesItem(state, "f-root1", "f-grandchild1")).toBe(false);
      expect(canMoveSourcesItem(state, "f-child1", "f-grandchild1")).toBe(false);
    });

    it("refuses moving a folder into a non-existent folder", () => {
      expect(canMoveSourcesItem(state, "f-root1", "f-does-not-exist")).toBe(false);
    });

    it("allows moving a folder to root or another valid folder branch", () => {
      expect(canMoveSourcesItem(state, "f-child1", null)).toBe(true);
      expect(canMoveSourcesItem(state, "f-child1", "f-root2")).toBe(true);
      expect(canMoveSourcesItem(state, "f-root1", "f-root2")).toBe(true);
    });

    it("refuses moving a source to its current location", () => {
      expect(canMoveSourcesItem(state, "s-root", null)).toBe(false);
      expect(canMoveSourcesItem(state, "s-child", "f-child1")).toBe(false);
    });

    it("refuses moving a source to a non-existent folder", () => {
      expect(canMoveSourcesItem(state, "s-root", "f-ghost")).toBe(false);
    });

    it("allows moving a source into a folder or back to root", () => {
      expect(canMoveSourcesItem(state, "s-root", "f-root1")).toBe(true);
      expect(canMoveSourcesItem(state, "s-root", "f-grandchild1")).toBe(true);
      expect(canMoveSourcesItem(state, "s-child", null)).toBe(true);
      expect(canMoveSourcesItem(state, "s-child", "f-root2")).toBe(true);
    });

    it("returns false for unknown item ID", () => {
      expect(canMoveSourcesItem(state, "unknown-id", "f-root1")).toBe(false);
    });
  });

  describe("moveSourcesItem immutability and state update", () => {
    it("moves source to a folder and updates folderId", () => {
      const next = moveSourcesItem(state, "s-root", "f-root2");
      expect(next.sources.find((s) => s.id === "s-root")?.folderId).toBe("f-root2");
      // Other sources unchanged
      expect(next.sources.find((s) => s.id === "s-child")?.folderId).toBe("f-child1");
      // Original state untouched
      expect(state.sources.find((s) => s.id === "s-root")?.folderId).toBeNull();
    });

    it("moves source from folder back to root", () => {
      const next = moveSourcesItem(state, "s-child", null);
      expect(next.sources.find((s) => s.id === "s-child")?.folderId).toBeNull();
    });

    it("moves folder to new parent and updates parentId and updatedAt", () => {
      const now = "2026-03-01T12:00:00.000Z";
      const next = moveSourcesItem(state, "f-child1", "f-root2", now);
      const movedFolder = next.folders.find((f) => f.id === "f-child1");
      expect(movedFolder?.parentId).toBe("f-root2");
      expect(movedFolder?.updatedAt).toBe(now);
    });

    it("no-ops and returns original state if move is forbidden", () => {
      const next = moveSourcesItem(state, "f-root1", "f-child1");
      expect(next).toBe(state);
    });
  });

  describe("renameSourcesItem (#106)", () => {
    it("renames a folder with a trimmed name", () => {
      const now = "2026-03-01T12:00:00.000Z";
      const next = renameSourcesItem(state, "f-root1", "  Renamed Root  ", now);
      expect(next.folders.find((f) => f.id === "f-root1")?.name).toBe("Renamed Root");
      expect(next.folders.find((f) => f.id === "f-root1")?.updatedAt).toBe(now);
      // Other folders unaffected
      expect(next.folders.find((f) => f.id === "f-root2")?.name).toBe("Root 2");
    });

    it("renames a source with a trimmed title", () => {
      const next = renameSourcesItem(state, "s-root", "  Renamed Source  ");
      expect(next.sources.find((s) => s.id === "s-root")?.title).toBe("Renamed Source");
      // Other sources unaffected
      expect(next.sources.find((s) => s.id === "s-child")?.title).toBe("Source in child");
    });

    it("no-ops if new name is empty or all whitespace", () => {
      expect(renameSourcesItem(state, "f-root1", "")).toBe(state);
      expect(renameSourcesItem(state, "f-root1", "   \t\n  ")).toBe(state);
      expect(renameSourcesItem(state, "s-root", "")).toBe(state);
      expect(renameSourcesItem(state, "s-root", "   ")).toBe(state);
    });

    it("no-ops if new name is identical to current name", () => {
      expect(renameSourcesItem(state, "f-root1", "Root 1")).toBe(state);
      expect(renameSourcesItem(state, "f-root1", "  Root 1  ")).toBe(state);
      expect(renameSourcesItem(state, "s-root", "Source at root")).toBe(state);
    });

    it("no-ops if item id does not exist", () => {
      expect(renameSourcesItem(state, "unknown-id", "New Name")).toBe(state);
    });
  });

  describe("deleteSourcesFolder (#106)", () => {
    it("deletes folder, cascades to descendants, and reparents all nested sources to root", () => {
      const complexFolders: SourceFolder[] = [
        createFolder({ id: "parent", name: "Parent" }),
        createFolder({ id: "child", name: "Child", parentId: "parent" }),
        createFolder({ id: "grandchild", name: "Grandchild", parentId: "child" }),
        createFolder({ id: "other", name: "Other Root" }),
      ];

      const complexSources: Source[] = [
        createSource({ id: "s-parent", title: "In Parent", folderId: "parent" }),
        createSource({ id: "s-child", title: "In Child", folderId: "child" }),
        createSource({ id: "s-grandchild", title: "In Grandchild", folderId: "grandchild" }),
        createSource({ id: "s-other", title: "In Other", folderId: "other" }),
        createSource({ id: "s-root", title: "At Root", folderId: null }),
      ];

      const treeState = { folders: complexFolders, sources: complexSources };
      const next = deleteSourcesFolder(treeState, "parent");

      // Parent, child, grandchild folders deleted; only 'other' remains
      expect(next.folders.map((f) => f.id)).toEqual(["other"]);

      // Sources in parent, child, grandchild are all reparented to null (root)
      expect(next.sources.find((s) => s.id === "s-parent")?.folderId).toBeNull();
      expect(next.sources.find((s) => s.id === "s-child")?.folderId).toBeNull();
      expect(next.sources.find((s) => s.id === "s-grandchild")?.folderId).toBeNull();

      // Other source and root source unchanged
      expect(next.sources.find((s) => s.id === "s-other")?.folderId).toBe("other");
      expect(next.sources.find((s) => s.id === "s-root")?.folderId).toBeNull();
    });

    it("no-ops if folder id does not exist", () => {
      expect(deleteSourcesFolder(state, "unknown-folder")).toBe(state);
    });
  });
});
