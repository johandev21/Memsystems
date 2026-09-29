import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useCallback, useEffect, useState } from "react";
import type { TreeDragData, TreeDropData } from "./types";

export const DEFAULT_DRAG_ID_PREFIX = "tree-drag:";
export const DEFAULT_FOLDER_DROP_ID_PREFIX = "tree-folder:";
export const DEFAULT_DRAG_TYPE = "tree-item";
export const DEFAULT_FOLDER_DROP_TYPE = "tree-folder";
export const DEFAULT_ROOT_DROP_TYPE = "tree-root";

export function useIsCoarsePointer(): boolean {
  const [isCoarse, setIsCoarse] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia("(pointer: coarse)");
    const handler = () => setIsCoarse(mql.matches);
    handler();
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return isCoarse;
}

export function getTreeDragData(data: unknown): TreeDragData | null {
  if (!data || typeof data !== "object") return null;
  const candidate = data as Partial<TreeDragData>;
  return typeof candidate.type === "string" && typeof candidate.itemId === "string"
    ? { type: candidate.type, itemId: candidate.itemId }
    : null;
}

export function getTreeDropData(data: unknown): TreeDropData | null {
  if (!data || typeof data !== "object") return null;
  const candidate = data as Partial<TreeDropData>;
  if (typeof candidate.type === "string") {
    if (candidate.folderId === null || typeof candidate.folderId === "string") {
      return { type: candidate.type, folderId: candidate.folderId };
    }
  }
  return null;
}

export interface UseTreeRowDragDropOptions {
  nodeId: string;
  isFolder: boolean;
  isRenaming: boolean;
  isOpen: boolean;
  isCoarse?: boolean;
  isPendingMove?: boolean;
  canMove: (draggedItemId: string, targetFolderId: string) => boolean;
  setFolderOpen: (folderId: string, open: boolean) => void;
  registerNode: (id: string, element: HTMLElement | null) => void;
  dragIdPrefix?: string;
  folderDropIdPrefix?: string;
  dragType?: string;
  folderDropType?: string;
  hoverOpenDelayMs?: number;
}

export function useTreeRowDragDrop({
  nodeId,
  isFolder,
  isRenaming,
  isOpen,
  isCoarse: customIsCoarse,
  isPendingMove = false,
  canMove,
  setFolderOpen,
  registerNode,
  dragIdPrefix = DEFAULT_DRAG_ID_PREFIX,
  folderDropIdPrefix = DEFAULT_FOLDER_DROP_ID_PREFIX,
  dragType = DEFAULT_DRAG_TYPE,
  folderDropType = DEFAULT_FOLDER_DROP_TYPE,
  hoverOpenDelayMs = 550,
}: UseTreeRowDragDropOptions) {
  const detectedIsCoarse = useIsCoarsePointer();
  const isCoarse = customIsCoarse !== undefined ? customIsCoarse : detectedIsCoarse;

  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef: setDraggableNodeRef,
  } = useDraggable({
    id: `${dragIdPrefix}${nodeId}`,
    data: { type: dragType, itemId: nodeId },
    disabled: isRenaming || isPendingMove,
  });

  const {
    active,
    isOver,
    setNodeRef: setDroppableNodeRef,
  } = useDroppable({
    id: `${folderDropIdPrefix}${nodeId}`,
    data: { type: folderDropType, folderId: nodeId },
    disabled: !isFolder,
  });

  const activeData = getTreeDragData(active?.data.current);
  const canAcceptDrop = Boolean(
    isFolder && activeData && canMove(activeData.itemId, nodeId),
  );

  useEffect(() => {
    if (!isFolder || !isOver || !canAcceptDrop || isOpen) return;
    const timer = window.setTimeout(() => setFolderOpen(nodeId, true), hoverOpenDelayMs);
    return () => window.clearTimeout(timer);
  }, [canAcceptDrop, hoverOpenDelayMs, isFolder, isOpen, isOver, nodeId, setFolderOpen]);

  const setNodeRefs = useCallback(
    (element: HTMLDivElement | null) => {
      setDraggableNodeRef(element);
      if (isFolder) setDroppableNodeRef(element);
      registerNode(nodeId, element);
    },
    [isFolder, nodeId, registerNode, setDraggableNodeRef, setDroppableNodeRef],
  );

  const rowDragProps = isCoarse ? {} : { ...attributes, ...listeners };
  const handleDragProps = isCoarse && !isRenaming ? { ...attributes, ...listeners } : {};

  return {
    isDragging,
    isOver,
    canAcceptDrop,
    isCoarse,
    setNodeRefs,
    rowDragProps,
    handleDragProps,
    listeners,
  };
}
