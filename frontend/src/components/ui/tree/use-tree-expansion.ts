import { useCallback, useEffect, useState } from "react";

export function useControllableFolderExpansion(
  folderIds: readonly string[],
  expandedIds: Set<string> | undefined,
  onExpandedChange: ((ids: Set<string>) => void) | undefined,
) {
  const [internalIds, setInternalIds] = useState(() => new Set(folderIds));
  const isControlled = expandedIds !== undefined;
  const openFolderIds = isControlled ? expandedIds : internalIds;

  const setOpenFolderIds = useCallback(
    (updater: Set<string> | ((previous: Set<string>) => Set<string>)) => {
      const previous = openFolderIds ?? new Set<string>();
      const next = typeof updater === "function" ? updater(previous) : updater;
      if (isControlled) onExpandedChange?.(new Set(next));
      else setInternalIds(next);
    },
    [isControlled, onExpandedChange, openFolderIds],
  );

  return { openFolderIds: openFolderIds ?? new Set<string>(), setOpenFolderIds };
}

export function getActiveFolderIds<
  TFolder extends { id: string; deletedAt?: string | null },
>(folders: readonly TFolder[]): Set<string> {
  const result = new Set<string>();
  for (const folder of folders) {
    if (!folder.deletedAt) result.add(folder.id);
  }
  return result;
}

export function getInitialExpandedIds<
  TFolder extends { id: string; parentId: string | null; deletedAt?: string | null },
>(folders: readonly TFolder[], persisted: Set<string> | null): Set<string> {
  const activeIds = getActiveFolderIds(folders);
  if (persisted) return new Set([...persisted].filter((id) => activeIds.has(id)));
  const initial = new Set<string>();
  for (const folder of folders) {
    if (folder.parentId === null && !folder.deletedAt) {
      initial.add(folder.id);
    }
  }
  return initial;
}

export function reconcileExpandedIds<
  TFolder extends { id: string; parentId: string | null; deletedAt?: string | null },
>(
  folders: readonly TFolder[],
  expandedIds: Set<string>,
  previousFolderIds: Set<string>,
): Set<string> {
  const activeIds = getActiveFolderIds(folders);
  const next = new Set<string>();
  for (const id of expandedIds) {
    if (activeIds.has(id)) next.add(id);
  }
  for (const folder of folders) {
    if (folder.parentId === null && !folder.deletedAt && !previousFolderIds.has(folder.id)) {
      next.add(folder.id);
    }
  }
  return next;
}

function loadPersistedExpanded(storageKey: string): Set<string> | null {
  if (typeof window === "undefined" || !storageKey) return null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch {
    // ignore
  }
  return null;
}

function persistExpanded(storageKey: string, ids: Set<string>) {
  if (typeof window === "undefined" || !storageKey) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}

export function computeExpandedForNotebook<
  TFolder extends { id: string; parentId: string | null; deletedAt?: string | null },
>(
  storageKey: string,
  folders: readonly TFolder[],
): Set<string> {
  return getInitialExpandedIds(folders, loadPersistedExpanded(storageKey));
}

function areSetsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

function syncExpandedOnFoldersChange<
  TFolder extends { id: string; parentId: string | null; deletedAt?: string | null },
>(
  folders: readonly TFolder[],
  openIds: Set<string>,
  prevFolderIds: Set<string>,
): { nextFolderIds: Set<string>; nextOpenIds: Set<string> } | null {
  const currentFolderIds = getActiveFolderIds(folders);
  if (areSetsEqual(currentFolderIds, prevFolderIds)) return null;

  const reconciled = reconcileExpandedIds(folders, openIds, prevFolderIds);
  const nextOpenIds = areSetsEqual(reconciled, openIds) ? openIds : reconciled;
  return { nextFolderIds: currentFolderIds, nextOpenIds };
}

/**
 * Persists expanded folder IDs per key/notebook, prunes stale IDs,
 * and expands newly encountered top-level folders by default.
 */
export function usePersistentExpandedFolders<
  TFolder extends { id: string; parentId: string | null; deletedAt?: string | null },
>(
  notebookId: string,
  folders: readonly TFolder[],
  storagePrefix: string = "tree:expanded:",
): [Set<string>, (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void] {
  const storageKey = `${storagePrefix}${notebookId}`;

  const [openIds, setOpenIds] = useState<Set<string>>(() =>
    computeExpandedForNotebook(storageKey, folders),
  );

  const [prevNotebookId, setPrevNotebookId] = useState(notebookId);
  const [prevFolderIds, setPrevFolderIds] = useState<Set<string>>(() =>
    getActiveFolderIds(folders),
  );

  if (prevNotebookId !== notebookId) {
    setPrevNotebookId(notebookId);
    setPrevFolderIds(getActiveFolderIds(folders));
    setOpenIds(computeExpandedForNotebook(storageKey, folders));
  } else {
    const update = syncExpandedOnFoldersChange(folders, openIds, prevFolderIds);
    if (update) {
      setPrevFolderIds(update.nextFolderIds);
      if (update.nextOpenIds !== openIds) {
        setOpenIds(update.nextOpenIds);
      }
    }
  }

  useEffect(() => {
    persistExpanded(storageKey, openIds);
  }, [openIds, storageKey]);

  const setOpenIdsWrapper = useCallback(
    (next: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      setOpenIds((prev) => {
        const value =
          typeof next === "function" ? (next as (prev: Set<string>) => Set<string>)(prev) : next;
        return new Set(value);
      });
    },
    [],
  );

  return [openIds, setOpenIdsWrapper];
}
