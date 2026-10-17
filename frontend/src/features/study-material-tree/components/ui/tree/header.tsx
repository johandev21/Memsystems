import { Button } from "@/components/ui/button";
import { CardHeader } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/shared/utils/cn";
import { useDroppable } from "@dnd-kit/core";
import { CheckSquare, Maximize2, Minimize2, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getTreeDragData, ROOT_DROP_ID, useTreeControllerContext } from "../controller-state";

export interface TreeHeaderProps {
  isPanelExpanded?: boolean;
  onPanelToggle?: () => void;
  isSearchOpen?: boolean;
  onToggleSearch?: () => void;
  isMultiselectMode?: boolean;
  onToggleMultiselect?: () => void;
}

export function TreeHeader({
  isPanelExpanded,
  onPanelToggle,
  isSearchOpen: controlledIsSearchOpen,
  onToggleSearch: controlledOnToggleSearch,
  isMultiselectMode: controlledIsMultiselectMode,
  onToggleMultiselect: controlledOnToggleMultiselect,
}: TreeHeaderProps) {
  const { t } = useTranslation("tree");
  const controller = useTreeControllerContext();
  const isSearchOpen = controlledIsSearchOpen ?? controller.isSearchOpen;
  const onToggleSearch = controlledOnToggleSearch ?? controller.onToggleSearch;
  const isMultiselectMode = controlledIsMultiselectMode ?? controller.isMultiselectMode;
  const onToggleMultiselect = controlledOnToggleMultiselect ?? controller.onToggleMultiselect;

  const { active, isOver, setNodeRef } = useDroppable({
    id: ROOT_DROP_ID,
    data: { type: "study-materials-root", folderId: null } as const,
  });
  const activeData = getTreeDragData(active?.data.current);
  const isValidRootTarget = Boolean(activeData && controller.canMove(activeData.itemId, null));

  return (
    <CardHeader
      data-slot="study-materials-tree-header"
      data-size={controller.size}
      className={cn(
        "p-0 overflow-hidden shrink-0",
        isPanelExpanded ? "!rounded-none" : "!rounded-t-2xl",
      )}
    >
      <div
        ref={setNodeRef}
        data-slot="study-materials-tree-header-drop-target"
        data-size={controller.size}
        data-valid-drop-target={isOver && isValidRootTarget ? "true" : undefined}
        className={cn(
          "flex items-center justify-between transition-colors",
          isPanelExpanded
            ? "min-h-11 p-1.5 bg-panel-header-bg !rounded-none"
            : "min-h-(--tree-header-min-height) gap-2 bg-panel-header-bg px-2.5 !rounded-t-2xl",
          isOver && isValidRootTarget && "bg-accent",
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className={cn(
              "truncate font-sans text-sm font-semibold text-foreground",
              isPanelExpanded && "pl-1.5",
            )}
          >
            {t("header.title")}
          </span>
          {controller.activeDragItemId && (
            <span className="text-xs text-muted-foreground">
              {isOver && isValidRootTarget ? t("header.dropToRoot") : t("header.dragToFolder")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {onToggleSearch && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "cursor-pointer active:scale-97 transition-transform touch-manipulation",
                      isPanelExpanded ? "h-7 w-7" : "size-6",
                      isSearchOpen && "bg-accent text-accent-foreground font-semibold",
                    )}
                    aria-label="Search study materials"
                    onClick={onToggleSearch}
                  >
                    <Search className={isPanelExpanded ? "size-4" : "size-3.5"} />
                  </Button>
                }
              />
              <TooltipContent>Search study materials</TooltipContent>
            </Tooltip>
          )}

          {onToggleMultiselect && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "cursor-pointer active:scale-97 transition-transform touch-manipulation",
                      isPanelExpanded ? "h-7 w-7" : "size-6",
                      isMultiselectMode && "bg-accent text-accent-foreground font-semibold",
                    )}
                    aria-label="Select multiple study materials"
                    onClick={onToggleMultiselect}
                  >
                    <CheckSquare className={isPanelExpanded ? "size-4" : "size-3.5"} />
                  </Button>
                }
              />
              <TooltipContent>Select multiple</TooltipContent>
            </Tooltip>
          )}

          {onPanelToggle && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={isPanelExpanded ? t("header.collapsePanel") : t("header.expandPanel")}
              title={isPanelExpanded ? t("header.collapsePanel") : t("header.expandPanel")}
              onClick={onPanelToggle}
              className={cn(
                "cursor-pointer active:scale-97 transition-transform touch-manipulation",
                isPanelExpanded ? "h-7 w-7" : "size-6 ml-0.5",
              )}
            >
              {isPanelExpanded ? (
                <Minimize2 className="size-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>
    </CardHeader>
  );
}
