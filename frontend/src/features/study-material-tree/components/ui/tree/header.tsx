import { Button } from "@/components/ui/button";
import { CardHeader } from "@/components/ui/card";
import { cn } from "@/shared/utils/cn";
import { useDroppable } from "@dnd-kit/core";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getTreeDragData, ROOT_DROP_ID, useTreeControllerContext } from "../controller-state";

export interface TreeHeaderProps {
  isPanelExpanded?: boolean;
  onPanelToggle?: () => void;
}

export function TreeHeader({ isPanelExpanded, onPanelToggle }: TreeHeaderProps) {
  const { t } = useTranslation("tree");
  const controller = useTreeControllerContext();
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
      className="p-0 !rounded-t-2xl overflow-hidden"
    >
      <div
        ref={setNodeRef}
        data-slot="study-materials-tree-header-drop-target"
        data-size={controller.size}
        data-valid-drop-target={isOver && isValidRootTarget ? "true" : undefined}
        className={cn(
          "flex min-h-(--tree-header-min-height) items-center justify-between gap-2 bg-panel-header-bg px-2.5 !rounded-t-2xl",
          isOver && isValidRootTarget && "bg-accent",
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-sans text-sm font-semibold text-foreground">
            {t("header.title")}
          </span>
          {controller.activeDragItemId && (
            <span className="text-xs text-muted-foreground">
              {isOver && isValidRootTarget ? t("header.dropToRoot") : t("header.dragToFolder")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {onPanelToggle && (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={isPanelExpanded ? t("header.collapsePanel") : t("header.expandPanel")}
              onClick={onPanelToggle}
              className="ml-1"
            >
              {isPanelExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>
    </CardHeader>
  );
}
