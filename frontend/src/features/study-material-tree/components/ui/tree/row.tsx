import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/shared/utils/cn";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  BookOpen,
  Brain,
  Briefcase,
  FileQuestion,
  Folder,
  FolderOpen,
  GripVertical,
  ListChecks,
  Map as MapIcon,
  Network,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getCommandPendingKey } from "../../model/commands";
import type { TreeNode } from "../../model/tree";
import {
  DRAG_ID_PREFIX,
  FOLDER_DROP_ID_PREFIX,
  getTreeDragData,
  useTreeControllerContext,
} from "../controller-state";
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

function useTreeRowDragDrop({
  node,
  controller,
  isFolder,
  isRenaming,
  isOpen,
  isCoarse,
}: {
  node: TreeNode;
  controller: ReturnType<typeof useTreeControllerContext>;
  isFolder: boolean;
  isRenaming: boolean;
  isOpen: boolean;
  isCoarse: boolean;
}) {
  const pendingMoveForDrag = controller.pendingKeys.has(
    getCommandPendingKey({ type: "moveItem", id: node.id, targetFolderId: null }),
  );
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

  const rowDragProps = isCoarse ? {} : { ...attributes, ...listeners };
  const handleDragProps = isCoarse && !isRenaming ? { ...attributes, ...listeners } : {};

  return {
    isDragging,
    isOver,
    canAcceptDrop,
    pendingMoveForDrag,
    setNodeRefs,
    rowDragProps,
    handleDragProps,
    listeners,
  };
}

function useTreeRowPendingCommands(nodeId: string, pendingKeys: Set<string>) {
  const pendingRename = pendingKeys.has(
    getCommandPendingKey({ type: "renameItem", id: nodeId, name: "" }),
  );
  const pendingDuplicate = pendingKeys.has(
    getCommandPendingKey({ type: "duplicateMaterial", id: nodeId }),
  );
  const pendingMove = pendingKeys.has(
    getCommandPendingKey({ type: "moveItem", id: nodeId, targetFolderId: null }),
  );
  const pendingDelete = pendingKeys.has(getCommandPendingKey({ type: "deleteItem", id: nodeId }));
  const isPending = pendingRename || pendingDuplicate || pendingMove || pendingDelete;

  return {
    pendingRename,
    pendingDuplicate,
    pendingMove,
    pendingDelete,
    isPending,
  };
}

function getRowClassName({
  isSelected,
  treeHasFocus,
  isOver,
  canAcceptDrop,
  isDragging,
  isActiveItem,
  isRenaming,
  isCoarse,
}: {
  isSelected: boolean;
  treeHasFocus: boolean;
  isOver: boolean;
  canAcceptDrop: boolean;
  isDragging: boolean;
  isActiveItem: boolean;
  isRenaming: boolean;
  isCoarse: boolean;
}): string {
  const isDragActive = isDragging || isActiveItem;
  return cn(
    "group/tree-row relative flex h-[var(--tree-row-height)] w-full min-w-0 items-center gap-1.5 pr-1 text-left font-sans text-sm outline-none select-none",
    "text-muted-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:ring-1 focus-visible:ring-ring",
    "hover:bg-muted/70 hover:text-foreground",
    isSelected && treeHasFocus && "bg-accent/35 text-foreground ring-1 ring-inset ring-ring",
    isOver && canAcceptDrop && "bg-accent/60 text-accent-foreground",
    isDragActive && "opacity-35 cursor-grabbing",
    isRenaming && "cursor-text",
    !isRenaming && !isDragActive && (isCoarse ? "cursor-default" : "cursor-pointer"),
  );
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

  const dnd = useTreeRowDragDrop({
    node,
    controller,
    isFolder,
    isRenaming,
    isOpen,
    isCoarse,
  });

  const pending = useTreeRowPendingCommands(node.id, controller.pendingKeys);
  const Icon = getTreeIcon(node, isOpen);

  const row = (
    <div
      ref={dnd.setNodeRefs}
      {...dnd.rowDragProps}
      data-slot="study-materials-tree-row"
      data-size={controller.size}
      data-selected={isSelected ? "true" : undefined}
      data-focused={isFocused ? "true" : undefined}
      data-renaming={isRenaming ? "true" : undefined}
      data-dragging={dnd.isDragging || isActiveItem ? "true" : undefined}
      data-drop-target={dnd.isOver && dnd.canAcceptDrop ? "valid" : undefined}
      data-pending={pending.isPending ? "true" : undefined}
      aria-expanded={isFolder ? isOpen : undefined}
      aria-level={depth + 1}
      aria-selected={isSelected}
      aria-busy={pending.isPending ? true : undefined}
      role="treeitem"
      tabIndex={isFocused ? 0 : -1}
      style={{ paddingLeft: `calc(var(--tree-root-inset) + ${depth} * var(--tree-indent-step))` }}
      className={getRowClassName({
        isSelected,
        treeHasFocus: controller.treeHasFocus,
        isOver: dnd.isOver,
        canAcceptDrop: dnd.canAcceptDrop,
        isDragging: dnd.isDragging,
        isActiveItem,
        isRenaming,
        isCoarse,
      })}
      onPointerDown={(event) => {
        if (!isCoarse) {
          (
            dnd.listeners as unknown as { onPointerDown?: (e: React.PointerEvent) => void }
          )?.onPointerDown?.(event as unknown as React.PointerEvent);
        }
        if (event.button !== 0 || isRenaming) return;
        (event.currentTarget as HTMLElement).focus();
        controller.select(node);
      }}
      onClick={(event) => {
        if (isRenaming) return;
        const target = event.target as HTMLElement;
        if (
          target.closest('[data-slot="study-materials-tree-drag-handle"]') ||
          target.closest('[data-slot="study-materials-tree-row-actions"]')
        ) {
          return;
        }
        event.currentTarget.focus();
        controller.activate(node);
      }}
      onContextMenu={() => controller.select(node)}
      onFocus={() => controller.select(node)}
      onKeyDown={(event) => controller.handleKeyDown(event, node)}
    >
      <TreeRowDragHandle
        visible={!isRenaming}
        disabled={dnd.pendingMoveForDrag}
        isDragging={dnd.isDragging}
        isCoarse={isCoarse}
        dragProps={dnd.handleDragProps}
        onSelect={() => controller.select(node)}
      />
      <Icon className="size-[var(--tree-icon-size)] shrink-0" strokeWidth={1.7} />
      <TreeRowLabel node={node} isRenaming={isRenaming} />
      <MobileTreeRowActions
        node={node}
        visible={!isRenaming}
        isPending={pending.isPending}
        pendingRename={pending.pendingRename}
        pendingDuplicate={pending.pendingDuplicate}
        pendingMove={pending.pendingMove}
        pendingDelete={pending.pendingDelete}
      />
    </div>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger data-slot="study-materials-tree-row-trigger" render={row} />
      <RowMenu node={node} />
    </ContextMenu>
  );
}

type TreeRowDragHandleProps = {
  visible: boolean;
  disabled: boolean;
  isDragging: boolean;
  isCoarse: boolean;
  dragProps: Record<string, unknown>;
  onSelect: () => void;
};

function TreeRowDragHandle({
  visible,
  disabled,
  isDragging,
  isCoarse,
  dragProps,
  onSelect,
}: TreeRowDragHandleProps) {
  if (!visible) return null;
  const handlePointerDown = dragProps.onPointerDown as
    | ((event: React.PointerEvent) => void)
    | undefined;
  return (
    <button
      type="button"
      data-slot="study-materials-tree-drag-handle"
      aria-label="Drag to move"
      tabIndex={-1}
      disabled={disabled}
      className={cn(
        "shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none disabled:opacity-50",
        "hidden [@media(pointer:coarse)]:flex touch-manipulation select-none",
        isDragging && "opacity-50",
      )}
      {...dragProps}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (isCoarse) {
          (event.currentTarget.closest('[role="treeitem"]') as HTMLElement | null)?.focus();
          onSelect();
        }
        handlePointerDown?.(event);
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <GripVertical className="size-3.5" />
    </button>
  );
}

function TreeRowLabel({ node, isRenaming }: { node: TreeNode; isRenaming: boolean }) {
  const controller = useTreeControllerContext();
  if (isRenaming) {
    return (
      <InlineRename
        initialValue={node.name}
        onCancel={() => controller.cancelRename(node.id, node.name)}
        onCommit={(value) => controller.commitRename(node.id, value)}
      />
    );
  }
  return (
    <span className="min-w-0 flex-1 truncate leading-none" title={node.name}>
      {node.name}
    </span>
  );
}

type MobileTreeRowActionsProps = {
  node: TreeNode;
  visible: boolean;
  isPending: boolean;
  pendingRename: boolean;
  pendingDuplicate: boolean;
  pendingMove: boolean;
  pendingDelete: boolean;
};

function MobileTreeRowActions({
  node,
  visible,
  isPending,
  pendingRename,
  pendingDuplicate,
  pendingMove,
  pendingDelete,
}: MobileTreeRowActionsProps) {
  const controller = useTreeControllerContext();
  if (!visible) return null;
  const isFolder = node.type === "folder";
  return (
    <span
      data-slot="study-materials-tree-row-actions"
      className="ml-auto hidden shrink-0 items-center [@media(pointer:coarse)]:flex"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Actions for ${node.name}`}
              className="size-6 shrink-0 rounded-md hover:bg-accent hover:text-accent-foreground"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            />
          }
        />
        <DropdownMenuContent align="end" side="bottom" className="min-w-52">
          <DropdownMenuGroup>
            {isFolder && (
              <DropdownMenuItem
                onClick={() => controller.createFolder(node.id)}
                disabled={isPending}
              >
                New folder
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => controller.beginRename(node.id)}
              disabled={pendingRename}
            >
              Rename
            </DropdownMenuItem>
            {node.type === "material" && (
              <DropdownMenuItem
                onClick={() => controller.duplicateMaterial(node.id)}
                disabled={pendingDuplicate}
              >
                Duplicate
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => controller.moveToRoot(node.id)}
              disabled={node.parentId === null || pendingMove}
            >
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
            <DropdownMenuItem
              variant="destructive"
              onClick={() => controller.requestDelete(node)}
              disabled={pendingDelete}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}

function getTreeIcon(node: TreeNode, isOpen: boolean): LucideIcon {
  if (node.type === "folder") return isOpen ? FolderOpen : Folder;

  switch (node.materialKind) {
    case "simple_flashcard":
      return Brain;
    case "roadmap":
      return MapIcon;
    case "study_guide":
      return BookOpen;
    case "practice_problems":
      return ListChecks;
    case "case_study":
      return Briefcase;
    case "slides":
      return Presentation;
    case "mind_map":
      return Network;
    case "quiz":
    default:
      return FileQuestion;
  }
}
