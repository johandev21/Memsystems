import { useCallback, useEffect, useState } from "react";
import type { FolderDTO } from "@/features/study-material-tree";

const STORAGE_PREFIX = "study-materials-tree:expanded:";

function getStorageKey(notebookId: string): string {
  return `${STORAGE_PREFIX}${notebookId}`;
}

function loadPersisted(notebookId: string): Set<string> | null {
  if (typeof window === "undefined" || !notebookId) return null;
  try {
    const raw = localStorage.getItem(getStorageKey(notebookId));
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch {
    // ignore
  }
  return null;
}

function persist(notebookId: string, ids: Set<string>) {
  if (typeof window === "undefined" || !notebookId) return;
  try {
    localStorage.setItem(getStorageKey(notebookId), JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}

export function getActiveFolderIds(folders: readonly FolderDTO[]): Set<string> {
  const result = new Set<string>();
  for (const folder of folders) {
    if (!folder.deletedAt) result.add(folder.id);
  }
  return result;
}

export function getInitialExpandedIds(
  folders: readonly FolderDTO[],
  persisted: Set<string> | null,
): Set<string> {
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

export function reconcileExpandedIds(
  folders: readonly FolderDTO[],
  expandedIds: Set<string>,
  previousFolderIds: Set<string>,
): Set<string> {
  const activeIds = getActiveFolderIds(folders);
  const next = new Set<string>();
  for (const id of expandedIds) {
    if (activeIds.has(id)) next.add(id);
  }
  for (const folder of folders) {
    if (folder.parentId === null && !folder.deletedAt && !previousFolderIds.has(folder.id))
      next.add(folder.id);
  }
  return next;
}

export function computeExpandedForNotebook(
  notebookId: string,
  folders: readonly FolderDTO[],
): Set<string> {
  return getInitialExpandedIds(folders, loadPersisted(notebookId));
}

function areSetsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

function syncExpandedOnFoldersChange(
  folders: readonly FolderDTO[],
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
 * Persists expanded folder IDs per notebook, prunes stale IDs,
 * and expands newly encountered top-level folders by default.
 */
export function usePersistentExpandedFolders(
  notebookId: string,
  folders: readonly FolderDTO[],
): [Set<string>, (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void] {
  const [openIds, setOpenIds] = useState<Set<string>>(() =>
    computeExpandedForNotebook(notebookId, folders),
  );

  const [prevNotebookId, setPrevNotebookId] = useState(notebookId);
  const [prevFolderIds, setPrevFolderIds] = useState<Set<string>>(() =>
    getActiveFolderIds(folders),
  );

  // Adjust persisted expansion when the notebook changes (render-phase
  // adjustment, no effect). localStorage read here mirrors the initializer.
  if (prevNotebookId !== notebookId) {
    setPrevNotebookId(notebookId);
    setPrevFolderIds(getActiveFolderIds(folders));
    setOpenIds(computeExpandedForNotebook(notebookId, folders));
  } else {
    const update = syncExpandedOnFoldersChange(folders, openIds, prevFolderIds);
    if (update) {
      setPrevFolderIds(update.nextFolderIds);
      if (update.nextOpenIds !== openIds) {
        setOpenIds(update.nextOpenIds);
      }
    }
  }

  // Persist whenever openIds changes
  useEffect(() => {
    persist(notebookId, openIds);
  }, [notebookId, openIds]);

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
