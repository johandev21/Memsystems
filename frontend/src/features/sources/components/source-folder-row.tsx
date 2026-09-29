import type React from "react";
import {
  ChevronRight,
  ChevronsUpDown,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Pencil,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { InlineRename, getTreeRowClassName, useTreeRowDragDrop } from "@/components/ui/tree";
import { cn } from "@/shared/utils/cn";
import type { SourceFolder } from "../types/source-folder.types";

export interface SourceFolderRowProps {
  folder: SourceFolder;
  allFolders?: readonly SourceFolder[];
  depth: number;
  isOpen: boolean;
  onToggleOpen: () => void;
  onCreateChildFolder: () => void;
  onMove?: (itemId: string, targetFolderId: string | null) => void;
  canMove?: (draggedItemId: string, targetFolderId: string | null) => boolean;
  setFolderOpen?: (folderId: string, open: boolean) => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  isEditing?: boolean;
  onBeginRename?: (id: string) => void;
  onRenameCommit?: (id: string, nextName: string) => void;
  onRenameCancel?: () => void;
  onDelete?: (id: string) => void;
}

export function SourceFolderRow({
  folder,
  allFolders,
  depth,
  isOpen,
  onToggleOpen,
  onCreateChildFolder,
  onMove,
  canMove,
  setFolderOpen,
  onExpandAll,
  onCollapseAll,
  isEditing = false,
  onBeginRename,
  onRenameCommit,
  onRenameCancel,
  onDelete,
}: SourceFolderRowProps) {
  const { t } = useTranslation(["tree", "sources"]);

  const {
    isDragging,
    isOver,
    canAcceptDrop,
    setNodeRefs,
    rowDragProps,
  } = useTreeRowDragDrop({
    nodeId: folder.id,
    isFolder: true,
    isRenaming: isEditing,
    isOpen,
    canMove: (draggedItemId, targetFolderId) =>
      canMove ? canMove(draggedItemId, targetFolderId) : true,
    setFolderOpen: (folderId, open) => {
      setFolderOpen?.(folderId, open);
    },
    registerNode: () => {},
    dragIdPrefix: "tree-drag:",
    folderDropIdPrefix: "tree-folder:",
    dragType: "sources-tree-item",
    folderDropType: "sources-tree-folder",
    hoverOpenDelayMs: 550,
  });

  const validTargetFolders = (allFolders ?? []).filter((f) =>
    canMove ? canMove(folder.id, f.id) : f.id !== folder.id,
  );

  const row = (
    <div
      ref={setNodeRefs}
      {...rowDragProps}
      role="treeitem"
      aria-expanded={isOpen}
      aria-label={folder.name}
      data-slot="sources-tree-folder-row"
      data-dragging={isDragging ? "true" : undefined}
      data-drop-target={isOver && canAcceptDrop ? "valid" : undefined}
      tabIndex={0}
      style={
        {
          "--tree-row-pad": `calc(var(--tree-root-inset) + ${depth} * var(--tree-indent-step))`,
        } as React.CSSProperties
      }
      className={cn(
        getTreeRowClassName({}),
        "cursor-pointer select-none",
        isDragging && "opacity-50",
        isOver && canAcceptDrop && "bg-accent/80 ring-2 ring-primary/40",
      )}
      onClick={isEditing ? undefined : onToggleOpen}
      onKeyDown={(e) => {
        if (!isEditing && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onToggleOpen();
        }
      }}
    >
      <button
        type="button"
        className="flex size-4 shrink-0 items-center justify-center p-0 text-muted-foreground hover:text-foreground"
        aria-label={isOpen ? t("tree:actions.collapse", "Collapse") : t("tree:actions.expand", "Expand")}
        onClick={(e) => {
          e.stopPropagation();
          onToggleOpen();
        }}
      >
        <ChevronRight
          className={cn("size-3.5 shrink-0 transition-transform duration-150", isOpen && "rotate-90")}
        />
      </button>
      {isOpen ? (
        <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
      ) : (
        <Folder className="size-4 shrink-0 text-muted-foreground" />
      )}
      {isEditing ? (
        <InlineRename
          initialValue={folder.name}
          onCommit={(val) => onRenameCommit?.(folder.id, val)}
          onCancel={() => onRenameCancel?.()}
          ariaLabel={folder.name}
          size="sm"
        />
      ) : (
        <span className="truncate text-xs font-medium text-foreground">{folder.name}</span>
      )}
    </div>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger data-slot="source-folder-row-trigger" render={row} />
      <ContextMenuContent className="min-w-48">
        <ContextMenuGroup>
          <ContextMenuItem
            data-slot="source-folder-menu-rename"
            onClick={(e) => {
              e.stopPropagation();
              onBeginRename?.(folder.id);
            }}
          >
            <Pencil className="size-4 mr-2" />
            {t("tree:actions.rename", "Rename")}
          </ContextMenuItem>
          <ContextMenuItem
            data-slot="source-folder-menu-toggle"
            onClick={(e) => {
              e.stopPropagation();
              onToggleOpen();
            }}
          >
            {isOpen ? (
              <>
                <ChevronsUpDown className="size-4 mr-2" />
                {t("tree:actions.collapse", "Collapse")}
              </>
            ) : (
              <>
                <FolderOpen className="size-4 mr-2" />
                {t("tree:actions.expand", "Expand")}
              </>
            )}
          </ContextMenuItem>
          <ContextMenuItem
            data-slot="source-folder-menu-new-subfolder"
            onClick={(e) => {
              e.stopPropagation();
              onCreateChildFolder();
            }}
          >
            <FolderPlus className="size-4 mr-2" />
            {t("tree:actions.newSubfolder", "New subfolder")}
          </ContextMenuItem>
        </ContextMenuGroup>
        {(folder.parentId !== null || validTargetFolders.length > 0) && <ContextMenuSeparator />}
        <ContextMenuGroup>
          {folder.parentId !== null && (
            <ContextMenuItem
              data-slot="source-folder-menu-move-root"
              onClick={(e) => {
                e.stopPropagation();
                onMove?.(folder.id, null);
              }}
            >
              <FolderInput className="size-4 mr-2" />
              {t("tree:actions.moveToSourcesRoot", "Move to Sources root")}
            </ContextMenuItem>
          )}
          {validTargetFolders.length > 0 && (
            <ContextMenuSub>
              <ContextMenuSubTrigger data-slot="source-folder-menu-move-folder">
                <FolderInput className="size-4 mr-2" />
                {t("tree:actions.moveToFolder", "Move to folder")}
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="min-w-44">
                {validTargetFolders.map((f) => (
                  <ContextMenuItem
                    key={f.id}
                    data-slot={`move-folder-target-${f.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMove?.(folder.id, f.id);
                    }}
                  >
                    <Folder className="size-4 mr-2 text-muted-foreground" />
                    <span className="truncate">{f.name}</span>
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          )}
        </ContextMenuGroup>
        {(onExpandAll || onCollapseAll) && <ContextMenuSeparator />}
        <ContextMenuGroup>
          {onExpandAll && (
            <ContextMenuItem
              data-slot="source-folder-menu-expand-all"
              onClick={(e) => {
                e.stopPropagation();
                onExpandAll();
              }}
            >
              <FolderOpen className="size-4 mr-2" />
              {t("tree:actions.expandAll", "Expand all")}
            </ContextMenuItem>
          )}
          {onCollapseAll && (
            <ContextMenuItem
              data-slot="source-folder-menu-collapse-all"
              onClick={(e) => {
                e.stopPropagation();
                onCollapseAll();
              }}
            >
              <ChevronsUpDown className="size-4 mr-2" />
              {t("tree:actions.collapseAll", "Collapse all")}
            </ContextMenuItem>
          )}
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuItem
            data-slot="source-folder-menu-delete"
            variant="destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(folder.id);
            }}
          >
            <Trash2 className="size-4 mr-2" />
            {t("tree:actions.delete", "Delete")}
          </ContextMenuItem>
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
}
