import type React from "react";
import { ChevronRight, ChevronsUpDown, Folder, FolderOpen, FolderPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { getTreeRowClassName } from "@/components/ui/tree";
import { cn } from "@/shared/utils/cn";
import type { SourceFolder } from "../types/source-folder.types";

export interface SourceFolderRowProps {
  folder: SourceFolder;
  depth: number;
  isOpen: boolean;
  onToggleOpen: () => void;
  onCreateChildFolder: () => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
}

export function SourceFolderRow({
  folder,
  depth,
  isOpen,
  onToggleOpen,
  onCreateChildFolder,
  onExpandAll,
  onCollapseAll,
}: SourceFolderRowProps) {
  const { t } = useTranslation(["tree", "sources"]);

  const row = (
    <div
      role="treeitem"
      aria-expanded={isOpen}
      aria-label={folder.name}
      tabIndex={0}
      style={
        {
          "--tree-row-pad": `calc(var(--tree-root-inset) + ${depth} * var(--tree-indent-step))`,
        } as React.CSSProperties
      }
      className={cn(getTreeRowClassName({}), "cursor-pointer select-none")}
      onClick={onToggleOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
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
      <span className="truncate text-xs font-medium text-foreground">{folder.name}</span>
    </div>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger data-slot="source-folder-row-trigger" render={row} />
      <ContextMenuContent className="min-w-48">
        <ContextMenuGroup>
          <ContextMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onCreateChildFolder();
            }}
          >
            <FolderPlus className="size-4 mr-2" />
            {t("tree:actions.newFolder", "New folder")}
          </ContextMenuItem>
        </ContextMenuGroup>
        {(onExpandAll || onCollapseAll) && <ContextMenuSeparator />}
        <ContextMenuGroup>
          {onExpandAll && (
            <ContextMenuItem
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
      </ContextMenuContent>
    </ContextMenu>
  );
}
