import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { type FolderDTO, foldersQueryOptions } from "@/features/study-material-tree";

export interface FolderTreeNode {
  folder: FolderDTO;
  children: FolderTreeNode[];
}

export function buildTree(folders: FolderDTO[]): FolderTreeNode[] {
  const byId = new Map<string, FolderTreeNode>();
  const roots: FolderTreeNode[] = [];
  for (const f of folders) {
    byId.set(f.id, { folder: f, children: [] });
  }
  for (const f of folders) {
    const node = byId.get(f.id);
    if (!node) continue;
    const parent = f.parentId ? byId.get(f.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export function buildFolderPaths(folders: FolderDTO[]): Map<string, string> {
  const byId = new Map<string, FolderDTO>();
  for (const f of folders) {
    byId.set(f.id, f);
  }
  const pathMap = new Map<string, string>();
  for (const f of folders) {
    const parts: string[] = [];
    let curr: FolderDTO | undefined = f;
    while (curr?.parentId) {
      const parent = byId.get(curr.parentId);
      if (parent) {
        parts.unshift(parent.name);
        curr = parent;
      } else {
        break;
      }
    }
    if (parts.length > 0) {
      pathMap.set(f.id, parts.join(" / "));
    }
  }
  return pathMap;
}

export function getAncestorIds(folderId: string | null, folders: FolderDTO[]): Set<string> {
  const set = new Set<string>();
  if (!folderId) return set;
  const byId = new Map(folders.map((f) => [f.id, f]));
  let curr = byId.get(folderId);
  while (curr?.parentId) {
    set.add(curr.parentId);
    curr = byId.get(curr.parentId);
  }
  return set;
}

export function useStudyMaterialFolderPicker(notebookId: string, value: string | null) {
  const { t } = useTranslation("notebooks");
  const { data: folders = [] } = useQuery(foldersQueryOptions(notebookId));

  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => getAncestorIds(value, folders));

  const tree = useMemo(() => buildTree(folders), [folders]);
  const pathMap = useMemo(() => buildFolderPaths(folders), [folders]);

  const selectedName = useMemo(() => {
    if (value === null) return t("folders.notebookRoot");
    return folders.find((f) => f.id === value)?.name ?? t("folders.notebookRoot");
  }, [folders, value, t]);

  const activeExpandedIds = useMemo(() => {
    const ancestors = getAncestorIds(value, folders);
    if (ancestors.size === 0) return expandedIds;
    return new Set([...expandedIds, ...ancestors]);
  }, [expandedIds, value, folders]);

  const toggleExpand = (folderId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const isSearching = search.trim().length > 0;
  const normalizedQuery = search.trim().toLowerCase();

  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    return folders.filter((f) => f.name.toLowerCase().includes(normalizedQuery));
  }, [folders, isSearching, normalizedQuery]);

  const rootMatchesSearch =
    isSearching && t("folders.notebookRoot").toLowerCase().includes(normalizedQuery);

  return {
    folders,
    search,
    setSearch,
    clearSearch: () => setSearch(""),
    tree,
    pathMap,
    selectedName,
    activeExpandedIds,
    toggleExpand,
    isSearching,
    searchResults,
    rootMatchesSearch,
  };
}
