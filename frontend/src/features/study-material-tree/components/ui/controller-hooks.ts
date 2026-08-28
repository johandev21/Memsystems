import { useCallback, useEffect, useRef, useState } from "react";
import type { TreeCommand, TreeCommandExecutor, CommandResult } from "../model/commands";

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

export function useTreeFocusRegistry(onFocusItem?: (id: string) => void) {
  const [treeHasFocus, setTreeHasFocus] = useState(true);
  const treeSurfaceElement = useRef<HTMLDivElement | null>(null);
  const nodeElements = useRef(new Map<string, HTMLElement>());

  const registerTreeSurface = useCallback((element: HTMLDivElement | null) => {
    treeSurfaceElement.current = element;
  }, []);
  const registerNode = useCallback((id: string, element: HTMLElement | null) => {
    if (element) nodeElements.current.set(id, element);
    else nodeElements.current.delete(id);
  }, []);
  const focus = useCallback(
    (id: string) => {
      onFocusItem?.(id);
      requestAnimationFrame(() => nodeElements.current.get(id)?.focus());
    },
    [onFocusItem],
  );

  useEffect(() => {
    const isTreeRow = (target: EventTarget | null) =>
      target instanceof Element &&
      Boolean(treeSurfaceElement.current?.contains(target) && target.closest('[role="treeitem"]'));
    const handleFocusIn = (event: FocusEvent) => setTreeHasFocus(isTreeRow(event.target));
    const handlePointerDown = (event: PointerEvent) => setTreeHasFocus(isTreeRow(event.target));
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  return { treeHasFocus, treeSurfaceElement, registerTreeSurface, registerNode, focus };
}

export function usePendingTreeCommands(onCommand: TreeCommandExecutor | undefined) {
  const pendingByKey = useRef(new Map<string, boolean>());
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());

  const isPending = useCallback((key: string) => pendingByKey.current.has(key), []);

  const setPending = useCallback((key: string, pending: boolean) => {
    if (pending) pendingByKey.current.set(key, true);
    else pendingByKey.current.delete(key);
    setPendingKeys(new Set(pendingByKey.current.keys()));
  }, []);

  const runPendingCommand = useCallback(
    async (key: string, command: TreeCommand): Promise<CommandResult | null> => {
      if (!onCommand || pendingByKey.current.has(key)) return null;
      setPending(key, true);
      try {
        return await onCommand(command);
      } finally {
        setPending(key, false);
      }
    },
    [onCommand, setPending],
  );

  return { pendingKeys, isPending, setPending, runPendingCommand };
}
