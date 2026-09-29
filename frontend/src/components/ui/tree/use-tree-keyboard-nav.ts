import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback } from "react";
import type { BaseTreeNode } from "./types";

export interface UseTreeKeyboardNavOptions<TNode extends BaseTreeNode = BaseTreeNode> {
  activeDragItemId: string | null;
  visibleItems: readonly TNode[];
  openFolderIds: ReadonlySet<string>;
  setFolderOpen: (folderId: string, open: boolean) => void;
  focus: (id: string) => void;
  activate: (node: TNode) => void;
  beginRename: (id: string) => void;
  requestDelete?: (node: TNode) => void;
}

export function useTreeKeyboardNav<TNode extends BaseTreeNode = BaseTreeNode>({
  activeDragItemId,
  visibleItems,
  openFolderIds,
  setFolderOpen,
  focus,
  activate,
  beginRename,
  requestDelete,
}: UseTreeKeyboardNavOptions<TNode>) {
  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>, node: TNode) => {
      if (activeDragItemId) return;
      const currentIndex = visibleItems.findIndex((item) => item.id === node.id);
      const moveFocus = (index: number) => {
        const nextItem = visibleItems[index];
        if (nextItem) focus(nextItem.id);
      };

      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveFocus(Math.min(currentIndex + 1, visibleItems.length - 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveFocus(Math.max(currentIndex - 1, 0));
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        moveFocus(0);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        moveFocus(visibleItems.length - 1);
        return;
      }
      if (event.key === "ArrowRight" && node.type === "folder") {
        event.preventDefault();
        if (!openFolderIds.has(node.id)) {
          setFolderOpen(node.id, true);
          return;
        }
        const firstChild = node.children?.[0];
        if (firstChild) focus(firstChild.id);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (node.type === "folder" && openFolderIds.has(node.id)) {
          setFolderOpen(node.id, false);
          return;
        }
        if (node.parentId) focus(node.parentId);
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate(node);
        return;
      }
      if (event.key === "F2") {
        event.preventDefault();
        beginRename(node.id);
        return;
      }
      if (event.key === "Delete") {
        if (requestDelete) {
          event.preventDefault();
          requestDelete(node);
        }
      }
    },
    [
      activeDragItemId,
      activate,
      beginRename,
      focus,
      openFolderIds,
      requestDelete,
      setFolderOpen,
      visibleItems,
    ],
  );

  return { handleKeyDown };
}
