import { useCallback, useEffect, useRef, useState } from "react";
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
  return new Set(folders.filter((folder) => !folder.deletedAt).map((folder) => folder.id));
}

export function getInitialExpandedIds(
  folders: readonly FolderDTO[],
  persisted: Set<string> | null,
): Set<string> {
  const activeIds = getActiveFolderIds(folders);
  if (persisted) return new Set([...persisted].filter((id) => activeIds.has(id)));
  return new Set(
    folders
      .filter((folder) => folder.parentId === null && !folder.deletedAt)
      .map((folder) => folder.id),
  );
}

export function reconcileExpandedIds(
  folders: readonly FolderDTO[],
  expandedIds: Set<string>,
  previousFolderIds: Set<string>,
): Set<string> {
  const next = new Set([...expandedIds].filter((id) => getActiveFolderIds(folders).has(id)));
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
  const prevFolderIdsRef = useRef<Set<string> | null>(null);
  const folderIdsNotebookRef = useRef<string>(notebookId);

  // Adjust persisted expansion when the notebook changes (render-phase
  // adjustment, no effect). localStorage read here mirrors the initializer.
  if (prevNotebookId !== notebookId) {
    setPrevNotebookId(notebookId);
    setOpenIds(computeExpandedForNotebook(notebookId, folders));
  }

  // Handle folder list changes: prune stale and expand newly encountered top-level
  useEffect(() => {
    const currentIds = getActiveFolderIds(folders);
    if (prevFolderIdsRef.current === null || folderIdsNotebookRef.current !== notebookId) {
      folderIdsNotebookRef.current = notebookId;
      prevFolderIdsRef.current = currentIds;
      return;
    }

    const prevIds = prevFolderIdsRef.current;

    // Detect newly encountered top-level folders (IDs that weren't in prev set)
    const newTopLevelIds = folders
      .filter((f) => f.parentId === null && !f.deletedAt && !prevIds.has(f.id))
      .map((f) => f.id);

    // Prune stale
    const pruned = new Set([...openIds].filter((id) => currentIds.has(id)));

    // Expand newly encountered top-level
    for (const id of newTopLevelIds) pruned.add(id);

    // Only update if changed
    const changed =
      pruned.size !== openIds.size ||
      newTopLevelIds.length > 0 ||
      [...openIds].some((id) => !currentIds.has(id));

    if (changed) {
      setOpenIds(pruned);
    }

    prevFolderIdsRef.current = currentIds;
    // We intentionally do not include openIds in deps to avoid loop; we manage via state update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folders, notebookId]);

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
