import type { FolderDTO } from "../../types";
import {
  getActiveFolderIds,
  getInitialExpandedIds,
  reconcileExpandedIds,
  computeExpandedForNotebook as computeSharedExpandedForNotebook,
  usePersistentExpandedFolders as useSharedPersistentExpandedFolders,
} from "@/components/ui/tree";

export { getActiveFolderIds, getInitialExpandedIds, reconcileExpandedIds };

const STORAGE_PREFIX = "study-materials-tree:expanded:";

export function computeExpandedForNotebook(
  notebookId: string,
  folders: readonly FolderDTO[],
): Set<string> {
  return computeSharedExpandedForNotebook(`${STORAGE_PREFIX}${notebookId}`, folders);
}

/**
 * Persists expanded folder IDs per notebook, prunes stale IDs,
 * and expands newly encountered top-level folders by default.
 */
export function usePersistentExpandedFolders(
  notebookId: string,
  folders: readonly FolderDTO[],
): [Set<string>, (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void] {
  return useSharedPersistentExpandedFolders(notebookId, folders, STORAGE_PREFIX);
}
