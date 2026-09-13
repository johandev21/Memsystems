import type { LibraryFolder, LibraryNotebook } from "./types";

export type LibrarySortKey = "name" | "updatedAt" | "createdAt";

export type LibraryItem =
  | { kind: "folder"; folder: LibraryFolder }
  | { kind: "notebook"; notebook: LibraryNotebook };

function makeCollator(locale?: string) {
  return new Intl.Collator(locale, { sensitivity: "base", numeric: true });
}

function itemName(item: LibraryItem) {
  return item.kind === "folder" ? item.folder.name : item.notebook.title;
}

function itemId(item: LibraryItem) {
  return item.kind === "folder" ? item.folder.id : item.notebook.id;
}

function itemDate(item: LibraryItem, key: "updatedAt" | "createdAt") {
  return item.kind === "folder" ? item.folder[key] : item.notebook[key];
}

function compareNames(a: LibraryItem, b: LibraryItem, collator: Intl.Collator) {
  const byName = collator.compare(itemName(a), itemName(b));
  if (byName !== 0) return byName;
  const byKind = (a.kind === "folder" ? 0 : 1) - (b.kind === "folder" ? 0 : 1);
  return byKind !== 0 ? byKind : itemId(a).localeCompare(itemId(b));
}

function compareLibraryItems(
  a: LibraryItem,
  b: LibraryItem,
  sortKey: LibrarySortKey,
  collator: Intl.Collator,
): number {
  if (sortKey === "name") return compareNames(a, b, collator);
  const byDate = itemDate(b, sortKey).localeCompare(itemDate(a, sortKey));
  return byDate !== 0 ? byDate : compareNames(a, b, collator);
}

export function sortLibraryItems(
  items: LibraryItem[],
  sortKey: LibrarySortKey,
  locale?: string,
): LibraryItem[] {
  const collator = makeCollator(locale);
  return [...items].sort((a, b) => compareLibraryItems(a, b, sortKey, collator));
}

export function sortNotebooks(
  notebooks: LibraryNotebook[],
  sortKey: LibrarySortKey,
  locale?: string,
): LibraryNotebook[] {
  return sortLibraryItems(
    notebooks.map((notebook) => ({ kind: "notebook", notebook }) satisfies LibraryItem),
    sortKey,
    locale,
  ).map((item) => (item as Extract<LibraryItem, { kind: "notebook" }>).notebook);
}

export function toLibraryItems(
  folders: LibraryFolder[],
  notebooks: LibraryNotebook[],
): LibraryItem[] {
  return [
    ...folders.map((folder) => ({ kind: "folder", folder }) satisfies LibraryItem),
    ...notebooks.map((notebook) => ({ kind: "notebook", notebook }) satisfies LibraryItem),
  ];
}
