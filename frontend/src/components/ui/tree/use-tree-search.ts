import { useMemo, useState, useCallback } from "react";

export interface TreeSearchItem {
  id: string;
  name: string;
  folderId?: string | null;
}

export interface TreeSearchFolder {
  id: string;
  name: string;
  parentId?: string | null;
}

export interface UseTreeSearchOptions<TItem extends TreeSearchItem, TFolder extends TreeSearchFolder> {
  items: readonly TItem[] | undefined;
  folders: readonly TFolder[] | undefined;
}

export interface UseTreeSearchResult {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  toggleSearch: () => void;
  clearSearch: () => void;
  isSearching: boolean;
  matchCount: number;
  matchingItemIds: Set<string>;
  matchingFolderIds: Set<string>;
  expandedFolderIds: Set<string>;
  isItemVisible: (itemId: string, folderId?: string | null) => boolean;
  isFolderVisible: (folderId: string) => boolean;
}

export function useTreeSearch<TItem extends TreeSearchItem, TFolder extends TreeSearchFolder>({
  items,
  folders,
}: UseTreeSearchOptions<TItem, TFolder>): UseTreeSearchResult {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const isSearching = isSearchOpen && trimmedQuery.length > 0;

  const toggleSearch = useCallback(() => {
    setIsSearchOpen((prev) => {
      const next = !prev;
      if (!next) {
        setSearchQuery("");
      }
      return next;
    });
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  const { matchingItemIds, matchingFolderIds, expandedFolderIds, matchCount } = useMemo(() => {
    if (!isSearching) {
      return {
        matchingItemIds: new Set<string>(),
        matchingFolderIds: new Set<string>(),
        expandedFolderIds: new Set<string>(),
        matchCount: 0,
      };
    }

    const matchedItems = new Set<string>();
    const matchedFolders = new Set<string>();
    const expandedFolders = new Set<string>();

    const folderMap = new Map<string, TFolder>();
    for (const folder of folders ?? []) {
      folderMap.set(folder.id, folder);
      if (folder.name.toLowerCase().includes(trimmedQuery)) {
        matchedFolders.add(folder.id);
      }
    }

    // Match items
    for (const item of items ?? []) {
      if (item.name.toLowerCase().includes(trimmedQuery)) {
        matchedItems.add(item.id);

        // Climb up parent folders to expand and mark visible
        let currentFolderId = item.folderId;
        while (currentFolderId && folderMap.has(currentFolderId)) {
          expandedFolders.add(currentFolderId);
          matchedFolders.add(currentFolderId);
          currentFolderId = folderMap.get(currentFolderId)?.parentId ?? null;
        }
      }
    }

    // Also expand ancestors of matched folders
    for (const folderId of Array.from(matchedFolders)) {
      let parentId = folderMap.get(folderId)?.parentId;
      while (parentId && folderMap.has(parentId)) {
        expandedFolders.add(parentId);
        matchedFolders.add(parentId);
        parentId = folderMap.get(parentId)?.parentId ?? null;
      }
    }

    return {
      matchingItemIds: matchedItems,
      matchingFolderIds: matchedFolders,
      expandedFolderIds: expandedFolders,
      matchCount: matchedItems.size,
    };
  }, [items, folders, isSearching, trimmedQuery]);

  const isItemVisible = useCallback(
    (itemId: string, folderId?: string | null) => {
      if (!isSearching) return true;
      if (matchingItemIds.has(itemId)) return true;
      // If parent folder matches directly, show its items
      if (folderId && matchingFolderIds.has(folderId)) {
        return items?.some((it) => it.id === itemId) ?? false;
      }
      return false;
    },
    [isSearching, matchingItemIds, matchingFolderIds, items],
  );

  const isFolderVisible = useCallback(
    (folderId: string) => {
      if (!isSearching) return true;
      return matchingFolderIds.has(folderId);
    },
    [isSearching, matchingFolderIds],
  );

  return {
    searchQuery,
    setSearchQuery,
    isSearchOpen,
    setIsSearchOpen,
    toggleSearch,
    clearSearch,
    isSearching,
    matchCount,
    matchingItemIds,
    matchingFolderIds,
    expandedFolderIds,
    isItemVisible,
    isFolderVisible,
  };
}
