import { useState, useCallback, useMemo } from "react";

export interface UseTreeMultiselectResult {
  isMultiselectMode: boolean;
  setIsMultiselectMode: (enabled: boolean) => void;
  toggleMultiselectMode: () => void;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  toggleItem: (id: string) => void;
  toggleFolder: (descendantIds: string[]) => void;
  isFolderSelected: (descendantIds: string[]) => boolean | "indeterminate";
  selectAll: (allItemIds: string[]) => void;
  clearSelection: () => void;
  selectedCount: number;
}

export function useTreeMultiselect(initialMode = false): UseTreeMultiselectResult {
  const [isMultiselectMode, setIsMultiselectMode] = useState(initialMode);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const toggleMultiselectMode = useCallback(() => {
    setIsMultiselectMode((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedIds(new Set());
      }
      return next;
    });
  }, []);

  const toggleItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleFolder = useCallback((descendantIds: string[]) => {
    if (descendantIds.length === 0) return;

    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = descendantIds.every((id) => prev.has(id));

      if (allSelected) {
        for (const id of descendantIds) {
          next.delete(id);
        }
      } else {
        for (const id of descendantIds) {
          next.add(id);
        }
      }
      return next;
    });
  }, []);

  const isFolderSelected = useCallback(
    (descendantIds: string[]): boolean | "indeterminate" => {
      if (descendantIds.length === 0) return false;
      let selectedCount = 0;
      for (const id of descendantIds) {
        if (selectedIds.has(id)) {
          selectedCount++;
        }
      }
      if (selectedCount === 0) return false;
      if (selectedCount === descendantIds.length) return true;
      return "indeterminate";
    },
    [selectedIds],
  );

  const selectAll = useCallback((allItemIds: string[]) => {
    setSelectedIds(new Set(allItemIds));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedCount = useMemo(() => selectedIds.size, [selectedIds]);

  return {
    isMultiselectMode,
    setIsMultiselectMode,
    toggleMultiselectMode,
    selectedIds,
    setSelectedIds,
    toggleItem,
    toggleFolder,
    isFolderSelected,
    selectAll,
    clearSelection,
    selectedCount,
  };
}
