import { useCallback, useEffect, useRef, useState } from "react";
import type { FolderDTO } from "@/entities/folder";

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

/**
 * Persists expanded folder IDs per notebook, prunes stale IDs,
 * and expands newly encountered top-level folders by default.
 */
export function usePersistentExpandedFolders(
  notebookId: string,
  folders: readonly FolderDTO[],
): [Set<string>, (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void] {
  const storageKey = getStorageKey(notebookId);

  const [openIds, setOpenIds] = useState<Set<string>>(() => {
    const persisted = loadPersisted(notebookId);
    if (persisted) {
      // Prune stale on init
      const existing = new Set(folders.filter((f) => !f.deletedAt).map((f) => f.id));
      const pruned = new Set([...persisted].filter((id) => existing.has(id)));
      // If persisted was non-empty but pruned became empty due to stale, keep pruned (user had no valid expansion)
      // Also expand new top-level if no persisted? Actually if persisted existed, we should not auto-expand new top-level yet — that will be handled in effect.
      return pruned;
    }
    // No persisted: expand top-level folders by default
    return new Set(folders.filter((f) => f.parentId === null && !f.deletedAt).map((f) => f.id));
  });

  const prevFolderIdsRef = useRef<Set<string>>(getActiveFolderIds(folders));
  const prevNotebookIdRef = useRef<string>(notebookId);

  // When notebookId changes, load persisted for new notebook
  useEffect(() => {
    if (prevNotebookIdRef.current !== notebookId) {
      prevNotebookIdRef.current = notebookId;
      const persisted = loadPersisted(notebookId);
      if (persisted) {
        const existing = new Set(folders.filter((f) => !f.deletedAt).map((f) => f.id));
        const pruned = new Set([...persisted].filter((id) => existing.has(id)));
        // Expand newly encountered top-level for new notebook if persisted empty? Actually if persisted null, expand top-level.
        if (pruned.size === 0 && !persisted.size) {
          // no persisted, expand top-level
          const topLevel = folders
            .filter((f) => f.parentId === null && !f.deletedAt)
            .map((f) => f.id);
          setOpenIds(new Set(topLevel));
        } else {
          setOpenIds(pruned);
        }
      } else {
        const topLevel = folders
          .filter((f) => f.parentId === null && !f.deletedAt)
          .map((f) => f.id);
        setOpenIds(new Set(topLevel));
      }
      prevFolderIdsRef.current = getActiveFolderIds(folders);
      return;
    }
  }, [notebookId, folders, storageKey]);

  // Handle folder list changes: prune stale and expand newly encountered top-level
  useEffect(() => {
    const currentIds = getActiveFolderIds(folders);
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
  }, [folders]);

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
