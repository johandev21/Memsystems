import { describe, expect, it } from "vitest";
import { buildSourcesTree } from "./sources-tree";
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
});
