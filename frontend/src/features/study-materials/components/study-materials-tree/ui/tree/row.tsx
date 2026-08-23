import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  Brain,
  Ellipsis,
  FileQuestion,
  Folder,
  FolderOpen,
  GripVertical,
  Map as MapIcon,
  Network,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/shared/ui/button";
import { ContextMenu, ContextMenuTrigger } from "@/shared/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { cn } from "@/shared/lib/utils";
import type { TreeNode } from "../../model/tree";
import {
  DRAG_ID_PREFIX,
  FOLDER_DROP_ID_PREFIX,
  getTreeDragData,
  useTreeControllerContext,
} from "../controller";
import { getCommandPendingKey } from "../../model/commands";
import { InlineRename } from "./inline-rename";
import { RowMenu } from "./row-menu";

type RowProps = {
  node: TreeNode;
  depth: number;
};

function useIsCoarsePointer() {
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

export function Row({ node, depth }: RowProps) {
  const controller = useTreeControllerContext();
  const isFolder = node.type === "folder";
  const isActiveItem = controller.activeDragItemId === node.id;
  const isSelected = controller.isSelected(node.id);
  const isRenaming = controller.isRenaming(node.id);
  const isOpen = isFolder ? controller.isFolderOpen(node.id) : false;
  const isFocused = controller.isFocused(node.id);
  const isCoarse = useIsCoarsePointer();

  const pendingMoveForDrag = controller.pendingKeys.has(getCommandPendingKey({ type: "moveItem", id: node.id, targetFolderId: null }));
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef: setDraggableNodeRef,
  } = useDraggable({
    id: `${DRAG_ID_PREFIX}${node.id}`,
    data: { type: "study-material-tree-item", itemId: node.id } as const,
    disabled: isRenaming || pendingMoveForDrag,
  });
  const {
    active,
    isOver,
    setNodeRef: setDroppableNodeRef,
  } = useDroppable({
    id: `${FOLDER_DROP_ID_PREFIX}${node.id}`,
    data: { type: "study-materials-folder", folderId: node.id } as const,
    disabled: !isFolder,
  });
  const activeData = getTreeDragData(active?.data.current);
  const canAcceptDrop = Boolean(
    isFolder && activeData && controller.canMove(activeData.itemId, node.id),
  );

  useEffect(() => {
    if (!isFolder || !isOver || !canAcceptDrop || isOpen) return;
    const timer = window.setTimeout(() => controller.setFolderOpen(node.id, true), 550);
    return () => window.clearTimeout(timer);
  }, [canAcceptDrop, controller, isFolder, isOpen, isOver, node.id]);

  const setNodeRefs = useCallback(
    (element: HTMLDivElement | null) => {
      setDraggableNodeRef(element);
      if (isFolder) setDroppableNodeRef(element);
      controller.registerNode(node.id, element);
    },
    [controller, isFolder, node.id, setDraggableNodeRef, setDroppableNodeRef],
  );

  const Icon = getTreeIcon(node, isOpen);

  const pendingRename = controller.pendingKeys.has(getCommandPendingKey({ type: "renameItem", id: node.id, name: "" }));
  const pendingDuplicate = controller.pendingKeys.has(getCommandPendingKey({ type: "duplicateMaterial", id: node.id }));
  const pendingMove = controller.pendingKeys.has(getCommandPendingKey({ type: "moveItem", id: node.id, targetFolderId: null }));
  const pendingDelete = controller.pendingKeys.has(getCommandPendingKey({ type: "deleteItem", id: node.id }));
  const isPending = pendingRename || pendingDuplicate || pendingMove || pendingDelete;

  const rowDragProps = isCoarse ? {} : { ...attributes, ...listeners };
  const handleDragProps = isCoarse && !isRenaming ? { ...attributes, ...listeners } : {};

  const row = (
    <div
      ref={setNodeRefs}
      {...rowDragProps}
      data-slot="study-materials-tree-row"
      data-size={controller.size}
      data-selected={isSelected ? "true" : undefined}
      data-focused={isFocused ? "true" : undefined}
      data-renaming={isRenaming ? "true" : undefined}
      data-dragging={isDragging || isActiveItem ? "true" : undefined}
      data-drop-target={isOver && canAcceptDrop ? "valid" : undefined}
      data-pending={isPending ? "true" : undefined}
      aria-expanded={isFolder ? isOpen : undefined}
      aria-level={depth + 1}
      aria-selected={isSelected}
      aria-busy={isPending ? true : undefined}
      role="treeitem"
      tabIndex={isFocused ? 0 : -1}
      style={{ paddingLeft: `calc(var(--tree-root-inset) + ${depth} * var(--tree-indent-step))` }}
      className={cn(
        "group/tree-row relative flex h-[var(--tree-row-height)] w-full min-w-0 items-center gap-1.5 pr-1 text-left font-sans text-sm outline-none select-none",
        "text-muted-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:ring-1 focus-visible:ring-ring",
        "hover:bg-muted/70 hover:text-foreground",
        isSelected &&
          controller.treeHasFocus &&
          "bg-accent/35 text-foreground ring-1 ring-inset ring-ring",
        isOver && canAcceptDrop && "bg-accent/60 text-accent-foreground",
        (isDragging || isActiveItem) && "opacity-35",
        isRenaming && "cursor-text",
        !isRenaming && !isDragging && !isActiveItem && (isCoarse ? "cursor-default" : "cursor-pointer"),
        !isRenaming && (isDragging || isActiveItem) && "cursor-grabbing",
      )}
      onPointerDown={(event) => {
        if (isCoarse) {
          // On coarse pointer, drag starts only from handle; row pointer down only selects
        } else {
          (listeners as unknown as { onPointerDown?: (e: React.PointerEvent) => void })?.onPointerDown?.(
            event as unknown as React.PointerEvent,
          );
        }
        if (event.button !== 0) return;
        if (isRenaming) return;
        (event.currentTarget as HTMLElement).focus();
        controller.select(node);
      }}
      onClick={(event) => {
        if (isRenaming) return;
        // Prevent activation when clicking handle or trailing button
        const target = event.target as HTMLElement;
        if (target.closest('[data-slot="study-materials-tree-drag-handle"]') || target.closest('[data-slot="study-materials-tree-row-actions"]')) {
          return;
        }
        event.currentTarget.focus();
        controller.activate(node);
      }}
      onContextMenu={() => controller.select(node)}
      onFocus={() => controller.select(node)}
      onKeyDown={(event) => controller.handleKeyDown(event, node)}
    >
      {/* Drag handle - coarse pointer only (phones) */}
      {!isRenaming && (
        <button
          type="button"
          data-slot="study-materials-tree-drag-handle"
          aria-label="Drag to move"
          tabIndex={-1}
          disabled={pendingMoveForDrag}
          className={cn(
            "shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none disabled:opacity-50",
            "hidden [@media(pointer:coarse)]:flex",
            // On coarse, ensure touch manipulation doesn't scroll
            "touch-manipulation select-none",
            isDragging && "opacity-50",
          )}
          {...handleDragProps}
          onPointerDown={(e) => {
            e.stopPropagation();
            // Also trigger select on handle pointer down for coarse
            if (isCoarse) {
              (e.currentTarget.closest('[role="treeitem"]') as HTMLElement | null)?.focus();
              controller.select(node);
            }
            // Call dnd-kit's pointer down if handle has listeners
            (handleDragProps as unknown as { onPointerDown?: (e: React.PointerEvent) => void })?.onPointerDown?.(
              e as unknown as React.PointerEvent,
            );
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="size-3.5" />
        </button>
      )}
      <Icon className="size-[var(--tree-icon-size)] shrink-0" strokeWidth={1.7} />
      {isRenaming ? (
        <InlineRename
          initialValue={node.name}
          onCancel={() => controller.cancelRename(node.id, node.name)}
          onCommit={(value) => controller.commitRename(node.id, value)}
        />
      ) : (
        <span className="min-w-0 flex-1 truncate leading-none" title={node.name}>
          {node.name}
        </span>
      )}
      {/* Trailing actions - coarse pointer only (phones) */}
      {!isRenaming && (
        <span
          data-slot="study-materials-tree-row-actions"
          className="ml-auto hidden shrink-0 items-center [@media(pointer:coarse)]:flex"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Actions for ${node.name}`}
                  className={cn(
                    "size-6 shrink-0 rounded-md",
                    "hover:bg-accent hover:text-accent-foreground",
                  )}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Ellipsis className="size-3.5" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" side="bottom" className="min-w-52">
              <DropdownMenuGroup>
                {isFolder && (
                  <DropdownMenuItem onClick={() => controller.createFolder(node.id)} disabled={isPending}>
                    New folder
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => controller.beginRename(node.id)} disabled={pendingRename}>
                  Rename
                </DropdownMenuItem>
                {node.type === "material" && (
                  <DropdownMenuItem onClick={() => controller.duplicateMaterial(node.id)} disabled={pendingDuplicate}>
                    Duplicate
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => controller.moveToRoot(node.id)} disabled={node.parentId === null || pendingMove}>
                  Move to Study Materials
                </DropdownMenuItem>
                {isFolder && (
                  <>
                    <DropdownMenuItem onClick={controller.expandAll}>Expand all</DropdownMenuItem>
                    <DropdownMenuItem onClick={controller.collapseAll}>Collapse all</DropdownMenuItem>
                  </>
                )}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem variant="destructive" onClick={() => controller.requestDelete(node)} disabled={pendingDelete}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      )}
    </div>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger data-slot="study-materials-tree-row-trigger" render={row} />
      <RowMenu node={node} />
    </ContextMenu>
  );
}

function getTreeIcon(node: TreeNode, isOpen: boolean): LucideIcon {
  if (node.type === "folder") return isOpen ? FolderOpen : Folder;

  switch (node.materialKind) {
    case "simple_flashcard":
      return Brain;
    case "roadmap":
      return MapIcon;
    case "mind_map":
      return Network;
    case "quiz":
    default:
      return FileQuestion;
  }
}
