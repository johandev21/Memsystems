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

function byCreatedAtThenId<T extends { createdAt: string; id: string }>(first: T, second: T) {
  const timeCompare = first.createdAt.localeCompare(second.createdAt);
  if (timeCompare !== 0) return timeCompare;
  return first.id.localeCompare(second.id);
}
