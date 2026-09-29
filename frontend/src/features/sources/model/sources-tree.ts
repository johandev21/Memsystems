import type { Source } from "../types/source.types";
import type { SourceFolder } from "../types/source-folder.types";

export type SourcesTreeFolder = SourceFolder;
export type SourcesTreeSource = Source;

export type SourcesTreeState = {
  readonly folders: readonly SourcesTreeFolder[];
  readonly sources: readonly SourcesTreeSource[];
};

export type SourcesTreeNode = {
  readonly id: string;
  readonly type: "folder" | "source";
  readonly name: string;
  readonly parentId: string | null;
  readonly createdAt: string;
  readonly children: readonly SourcesTreeNode[];
  readonly source?: Source;
};

export function buildSourcesTree(state: SourcesTreeState): SourcesTreeNode[] {
  const folders = state.folders;
  const sources = state.sources;

  const foldersByParent = new Map<string | null, SourcesTreeFolder[]>();
  const sourcesByParent = new Map<string | null, SourcesTreeSource[]>();
  const folderIds = new Set(folders.map((f) => f.id));

  for (const folder of folders) {
    const parentId = folder.parentId && folderIds.has(folder.parentId) ? folder.parentId : null;
    const list = foldersByParent.get(parentId) ?? [];
    list.push(folder);
    foldersByParent.set(parentId, list);
  }

  for (const source of sources) {
    const parentId =
      source.folderId && folderIds.has(source.folderId) ? source.folderId : null;
    const list = sourcesByParent.get(parentId) ?? [];
    list.push(source);
    sourcesByParent.set(parentId, list);
  }

  const visit = (parentId: string | null): SourcesTreeNode[] => {
    const foldersForParent = (foldersByParent.get(parentId) ?? []).toSorted(byCreatedAtThenId);
    const sourcesForParent = (sourcesByParent.get(parentId) ?? []).toSorted(byCreatedAtThenId);

    return [
      ...foldersForParent.map((folder) => ({
        id: folder.id,
        type: "folder" as const,
        name: folder.name,
        parentId: folder.parentId,
        createdAt: folder.createdAt,
        children: visit(folder.id),
      })),
      ...sourcesForParent.map((source) => ({
        id: source.id,
        type: "source" as const,
        name: source.title,
        parentId: source.folderId ?? null,
        createdAt: source.createdAt,
        source,
        children: [] as SourcesTreeNode[],
      })),
    ];
  };

  return visit(null);
}

export type SourcesTreeFlatRow = {
  readonly node: SourcesTreeNode;
  readonly depth: number;
};

/**
 * Flattens the visible tree into (node, depth) rows in display order.
 * Traversal matches `flattenVisibleTree`, so indices line up with the
 * keyboard-navigation `visibleItems` built from the same inputs.
 */
export function flattenVisibleTreeWithDepth(
  nodes: readonly SourcesTreeNode[],
  openFolderIds: ReadonlySet<string>,
): SourcesTreeFlatRow[] {
  const rows: SourcesTreeFlatRow[] = [];
  const visit = (items: readonly SourcesTreeNode[], depth: number) => {
    for (const item of items) {
      rows.push({ node: item, depth });
      if (item.type === "folder" && openFolderIds.has(item.id)) {
        visit(item.children, depth + 1);
      }
    }
  };
  visit(nodes, 0);
  return rows;
}

function byCreatedAtThenId<T extends { createdAt: string; id: string }>(first: T, second: T) {
  const timeCompare = first.createdAt.localeCompare(second.createdAt);
  if (timeCompare !== 0) return timeCompare;
  return first.id.localeCompare(second.id);
}

export function getDescendantFolderIds(
  folders: readonly SourcesTreeFolder[],
  rootFolderId: string,
): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const folder of folders) {
    if (folder.parentId) {
      const list = childrenByParent.get(folder.parentId) ?? [];
      list.push(folder.id);
      childrenByParent.set(folder.parentId, list);
    }
  }

  const result = new Set<string>();
  const queue = [...(childrenByParent.get(rootFolderId) ?? [])];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (!result.has(current)) {
      result.add(current);
      const nextChildren = childrenByParent.get(current) ?? [];
      queue.push(...nextChildren);
    }
  }

  return result;
}

export function canMoveSourcesItem(
  state: SourcesTreeState,
  itemId: string,
  targetFolderId: string | null,
): boolean {
  const folder = state.folders.find((f) => f.id === itemId);
  if (folder) {
    if (folder.id === targetFolderId) return false;
    if ((folder.parentId ?? null) === targetFolderId) return false;
    if (targetFolderId === null) return true;
    const descendants = getDescendantFolderIds(state.folders, folder.id);
    if (descendants.has(targetFolderId)) return false;
    return state.folders.some((f) => f.id === targetFolderId);
  }

  const source = state.sources.find((s) => s.id === itemId);
  if (source) {
    if ((source.folderId ?? null) === targetFolderId) return false;
    if (targetFolderId === null) return true;
    return state.folders.some((f) => f.id === targetFolderId);
  }

  return false;
}

export function moveSourcesItem(
  state: SourcesTreeState,
  itemId: string,
  targetFolderId: string | null,
  now: string = new Date().toISOString(),
): SourcesTreeState {
  if (!canMoveSourcesItem(state, itemId, targetFolderId)) return state;

  return {
    folders: state.folders.map((folder) =>
      folder.id === itemId
        ? { ...folder, parentId: targetFolderId, updatedAt: now }
        : folder,
    ),
    sources: state.sources.map((source) =>
      source.id === itemId
        ? { ...source, folderId: targetFolderId }
        : source,
    ),
  };
}

export function renameSourcesItem(
  state: SourcesTreeState,
  itemId: string,
  nextName: string,
  now: string = new Date().toISOString(),
): SourcesTreeState {
  const trimmed = nextName.trim();
  if (!trimmed) return state;

  const folder = state.folders.find((f) => f.id === itemId);
  if (folder) {
    if (folder.name === trimmed) return state;
    return {
      ...state,
      folders: state.folders.map((f) =>
        f.id === itemId ? { ...f, name: trimmed, updatedAt: now } : f,
      ),
    };
  }

  const source = state.sources.find((s) => s.id === itemId);
  if (source) {
    if (source.title === trimmed) return state;
    return {
      ...state,
      sources: state.sources.map((s) =>
        s.id === itemId ? { ...s, title: trimmed } : s,
      ),
    };
  }

  return state;
}

export function deleteSourcesFolder(
  state: SourcesTreeState,
  folderId: string,
): SourcesTreeState {
  const target = state.folders.find((f) => f.id === folderId);
  if (!target) return state;

  const descendantFolderIds = getDescendantFolderIds(state.folders, folderId);
  const deletedFolderIds = new Set([folderId, ...descendantFolderIds]);

  return {
    folders: state.folders.filter((f) => !deletedFolderIds.has(f.id)),
    sources: state.sources.map((source) =>
      source.folderId && deletedFolderIds.has(source.folderId)
        ? { ...source, folderId: null }
        : source,
    ),
  };
}
