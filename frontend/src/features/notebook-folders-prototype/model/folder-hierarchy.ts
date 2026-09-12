import type { Folder, Notebook } from "./types";

export function childFolders(folders: Folder[], parentId: string | null) {
  return folders.filter((folder) => (folder.parentId ?? null) === parentId);
}

export function folderAncestors(folders: Folder[], folderId: string | null) {
  const result: Folder[] = [];
  const seen = new Set<string>();
  let current = folders.find((folder) => folder.id === folderId);
  while (current && !seen.has(current.id)) {
    result.unshift(current);
    seen.add(current.id);
    current = folders.find((folder) => folder.id === current?.parentId);
  }
  return result;
}

export function descendantFolderIds(folders: Folder[], folderId: string) {
  const result = new Set<string>();
  const pending = [folderId];
  while (pending.length) {
    const parentId = pending.pop()!;
    for (const child of folders)
      if (child.parentId === parentId && !result.has(child.id)) {
        result.add(child.id);
        pending.push(child.id);
      }
  }
  return result;
}

export function canMoveFolder(folders: Folder[], folderId: string, parentId: string | null) {
  const folder = folders.find((candidate) => candidate.id === folderId);
  if (!folder || folder.parentId === parentId || folderId === parentId) return false;
  if (parentId === null) return true;

  const targetExists = folders.some((candidate) => candidate.id === parentId);
  return targetExists && !descendantFolderIds(folders, folderId).has(parentId);
}

export function descendantNotebooks(folders: Folder[], notebooks: Notebook[], folderId: string) {
  const ids = descendantFolderIds(folders, folderId);
  ids.add(folderId);
  return notebooks.filter((notebook) => notebook.folderId !== null && ids.has(notebook.folderId));
}

export function folderPath(folders: Folder[], folderId: string) {
  return folderAncestors(folders, folderId)
    .map((folder) => folder.name)
    .join(" / ");
}
