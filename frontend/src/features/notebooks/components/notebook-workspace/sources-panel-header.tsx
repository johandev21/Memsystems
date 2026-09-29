import { ChevronsUpDown, FolderOpen, FolderPlus, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AddSourceDialog } from "@/features/sources/components/add-source-dialog";
import { cn } from "@/shared/utils/cn";

import { useDroppable } from "@dnd-kit/core";
import { getTreeDragData } from "@/components/ui/tree";

export interface SourcesPanelHeaderProps {
  collapsed: boolean;
  notebookId: string;
  onToggleCollapse?: () => void;
  onCreateFolder?: () => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  canMove?: (draggedItemId: string, targetFolderId: string | null) => boolean;
}

export function SourcesPanelHeader({
  collapsed,
  notebookId,
  onToggleCollapse,
  onCreateFolder,
  onExpandAll,
  onCollapseAll,
  canMove,
}: SourcesPanelHeaderProps) {
  const { t } = useTranslation("notebooks");

  const handleCreateFolder = () => {
    if (onCreateFolder) {
      onCreateFolder();
    } else {
      window.dispatchEvent(new CustomEvent("sources:create-folder"));
    }
  };

  const handleExpandAll = () => {
    if (onExpandAll) {
      onExpandAll();
    } else {
      window.dispatchEvent(new CustomEvent("sources:expand-all"));
    }
  };

  const handleCollapseAll = () => {
    if (onCollapseAll) {
      onCollapseAll();
    } else {
      window.dispatchEvent(new CustomEvent("sources:collapse-all"));
    }
  };

  const { active, isOver, setNodeRef } = useDroppable({
    id: "sources-root",
    data: { type: "tree-root", folderId: null } as const,
  });
  const activeData = getTreeDragData(active?.data.current);
  const isValidRootTarget = Boolean(activeData && (canMove ? canMove(activeData.itemId, null) : true));

  return (
    <header
      ref={setNodeRef}
      data-slot="sources-panel-header"
      data-valid-drop-target={isOver && isValidRootTarget ? "true" : undefined}
      className={cn(
        "flex items-center justify-between p-1.5 bg-panel-header-bg min-h-11 transition-colors",
        isOver && isValidRootTarget && "bg-accent/80 ring-2 ring-primary/40",
      )}
    >
      <h2 className={`text-sm font-semibold pl-1.5 ${collapsed ? "hidden" : ""}`}>
        {t("panels.sources")}
      </h2>
      <div className="flex items-center gap-0.5">
        {!collapsed && (
          <>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "icon" }),
                      "h-7 w-7 cursor-pointer",
                    )}
                    aria-label={t("panels.newFolder")}
                    onClick={handleCreateFolder}
                  >
                    <FolderPlus className="size-4" />
                  </button>
                }
              />
              <TooltipContent>{t("panels.newFolder")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "icon" }),
                      "h-7 w-7 cursor-pointer",
                    )}
                    aria-label={t("panels.expandAll")}
                    onClick={handleExpandAll}
                  >
                    <FolderOpen className="size-4" />
                  </button>
                }
              />
              <TooltipContent>{t("panels.expandAll")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "icon" }),
                      "h-7 w-7 cursor-pointer",
                    )}
                    aria-label={t("panels.collapseAll")}
                    onClick={handleCollapseAll}
                  >
                    <ChevronsUpDown className="size-4" />
                  </button>
                }
              />
              <TooltipContent>{t("panels.collapseAll")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <AddSourceDialog notebookId={notebookId}>
                    <button
                      type="button"
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "icon" }),
                        "h-7 w-7 cursor-pointer",
                      )}
                      aria-label={t("panels.addSource")}
                    >
                      <Plus className="size-4" />
                    </button>
                  </AddSourceDialog>
                }
              />
              <TooltipContent>{t("panels.addSource")}</TooltipContent>
            </Tooltip>
          </>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={collapsed ? "mx-auto cursor-pointer" : "h-7 w-7 cursor-pointer"}
          aria-label={collapsed ? t("panels.expandSources") : t("panels.collapseSources")}
          onClick={onToggleCollapse}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
      </div>
    </header>
  );
}
