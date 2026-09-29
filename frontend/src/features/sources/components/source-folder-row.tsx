import type React from "react";
import {
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
  level?: number;
  tabIndex?: number;
  isFocused?: boolean;
  treeHasFocus?: boolean;
  registerNode?: (id: string, el: HTMLElement | null) => void;
  onFocus?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLElement>) => void;
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
  level,
  tabIndex = 0,
  isFocused = false,
  treeHasFocus = true,
  registerNode,
  onFocus,
  onKeyDown,
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
    registerNode: registerNode ?? (() => {}),
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
      aria-level={level ?? depth + 1}
      aria-selected={isFocused}
      aria-label={folder.name}
      data-slot="sources-tree-folder-row"
      data-size="sm"
      data-selected={isFocused ? "true" : undefined}
      data-focused={isFocused ? "true" : undefined}
      data-renaming={isEditing ? "true" : undefined}
      data-dragging={isDragging ? "true" : undefined}
      data-drop-target={isOver && canAcceptDrop ? "valid" : undefined}
      tabIndex={tabIndex}
      style={{ "--tree-row-pad": `calc(var(--tree-root-inset) + ${depth} * var(--tree-indent-step))` } as React.CSSProperties}
      className={getTreeRowClassName({
        isSelected: isFocused,
        treeHasFocus,
        isOver,
        canAcceptDrop,
        isDragging,
        isRenaming: isEditing,
      })}
      onFocus={(e) => {
        if (e.target === e.currentTarget) {
          onFocus?.();
        }
      }}
      onClick={
        isEditing
          ? undefined
          : (e) => {
              (e.currentTarget as HTMLElement).focus();
              onToggleOpen();
            }
      }
      onKeyDown={(e) => {
        if (isEditing) return;
        if (onKeyDown) {
          onKeyDown(e);
        } else if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggleOpen();
        }
      }}
    >
      {isOpen ? (
        <FolderOpen className="size-(--tree-icon-size) shrink-0" strokeWidth={1.7} />
      ) : (
        <Folder className="size-(--tree-icon-size) shrink-0" strokeWidth={1.7} />
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
        <span className="min-w-0 flex-1 truncate leading-none" title={folder.name}>
          {folder.name}
        </span>
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
