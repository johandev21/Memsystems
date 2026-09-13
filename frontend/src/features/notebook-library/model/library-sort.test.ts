import { describe, expect, it } from "vitest";
import { sortLibraryItems, sortNotebooks, toLibraryItems, type LibraryItem } from "./library-sort";
import type { LibraryFolder, LibraryNotebook } from "./types";

function folder(
  id: string,
  name: string,
  dates: Partial<Pick<LibraryFolder, "createdAt" | "updatedAt">> = {},
): LibraryItem {
  return {
    kind: "folder",
    folder: {
      id,
      name,
      parentId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      ...dates,
    },
  };
}

function notebook(
  id: string,
  title: string,
  dates: Partial<LibraryNotebook> = {},
): LibraryItem {
  return {
    kind: "notebook",
    notebook: {
      id,
      title,
      description: "",
      icon: "",
      coverUrl: null,
      coverVariants: null,
      folderId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      ...dates,
    },
  };
}

function labels(items: LibraryItem[]) {
  return items.map((item) => (item.kind === "folder" ? item.folder.name : item.notebook.title));
}

describe("sortLibraryItems", () => {
  it("sorts names case-insensitively and naturally", () => {
    const items = [
      notebook("b", "b Notebook"),
      notebook("c", "Notebook 10"),
      notebook("a", "Notebook 2"),
    ];
    expect(labels(sortLibraryItems(items, "name"))).toEqual([
      "b Notebook",
      "Notebook 2",
      "Notebook 10",
    ]);
  });

  it("interleaves folders and notebooks by name", () => {
    const items = [
      folder("f1", "Classical Philosophy"),
      notebook("n1", "Aristotle"),
      folder("f2", "Modern Philosophy"),
      notebook("n2", "David Hume"),
    ];
    expect(labels(sortLibraryItems(items, "name"))).toEqual([
      "Aristotle",
      "Classical Philosophy",
      "David Hume",
      "Modern Philosophy",
    ]);
  });

  it("sorts by last modified with the newest first", () => {
    const items = [
      notebook("old", "Old", { updatedAt: "2026-02-01T00:00:00.000Z" }),
      folder("newest", "Newest", { updatedAt: "2026-09-01T00:00:00.000Z" }),
      notebook("middle", "Middle", { updatedAt: "2026-05-01T00:00:00.000Z" }),
    ];
    expect(labels(sortLibraryItems(items, "updatedAt"))).toEqual(["Newest", "Middle", "Old"]);
  });

  it("sorts by date created with the newest first", () => {
    const items = [
      folder("older", "Older", { createdAt: "2026-01-01T00:00:00.000Z" }),
      notebook("newer", "Newer", { createdAt: "2026-06-01T00:00:00.000Z" }),
    ];
    expect(labels(sortLibraryItems(items, "createdAt"))).toEqual(["Newer", "Older"]);
  });

  it("falls back to name, then folders before notebooks, on date ties", () => {
    const tied = "2026-03-01T00:00:00.000Z";
    const items = [
      notebook("n1", "Alpha", { updatedAt: tied }),
      folder("f1", "Alpha", { updatedAt: tied }),
      folder("f2", "Beta", { updatedAt: tied }),
    ];
    expect(
      sortLibraryItems(items, "updatedAt").map((item) => `${item.kind}:${labels([item])[0]}`),
    ).toEqual(["folder:Alpha", "notebook:Alpha", "folder:Beta"]);
  });

  it("does not mutate the input array", () => {
    const items = [notebook("b", "Beta"), folder("a", "Alpha")];
    sortLibraryItems(items, "name");
    expect(labels(items)).toEqual(["Beta", "Alpha"]);
  });

  it("returns an empty list unchanged", () => {
    expect(sortLibraryItems([], "name")).toEqual([]);
  });
});

describe("sortNotebooks", () => {
  it("sorts notebook models by the same rules", () => {
    const base = {
      description: "",
      icon: "",
      coverUrl: null,
      coverVariants: null,
      folderId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const items: LibraryNotebook[] = [
      { id: "n2", title: "Beta", ...base },
      { id: "n1", title: "Alpha", ...base },
    ];
    expect(sortNotebooks(items, "name").map((item) => item.title)).toEqual(["Alpha", "Beta"]);
  });
});

describe("toLibraryItems", () => {
  it("wraps folders and notebooks with their kind", () => {
    const items = toLibraryItems(
      [
        {
          id: "f",
          name: "Folder",
          parentId: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      [],
    );
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("folder");
  });
});
