import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "react-i18next";
import type { TreeNode } from "../../model/tree";
import { useTreeControllerContext } from "../controller-state";

export type MobileTreeRowActionsProps = {
  node: TreeNode;
  visible: boolean;
  isPending: boolean;
  pendingRename: boolean;
  pendingDuplicate: boolean;
  pendingMove: boolean;
  pendingDelete: boolean;
};

export function MobileTreeRowActions({
  node,
  visible,
  isPending,
  pendingRename,
  pendingDuplicate,
  pendingMove,
  pendingDelete,
}: MobileTreeRowActionsProps) {
  const { t } = useTranslation("tree");
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
              aria-label={t("row.actionsFor", { name: node.name })}
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
                {t("actions.newFolder")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => controller.beginRename(node.id)}
              disabled={pendingRename}
            >
              {t("actions.rename")}
            </DropdownMenuItem>
            {node.type === "material" && (
              <DropdownMenuItem
                onClick={() => controller.duplicateMaterial(node.id)}
                disabled={pendingDuplicate}
              >
                {t("actions.duplicate")}
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => controller.moveToRoot(node.id)}
              disabled={node.parentId === null || pendingMove}
            >
              {t("actions.moveToRoot")}
            </DropdownMenuItem>
            {isFolder && (
              <>
                <DropdownMenuItem onClick={controller.expandAll}>
                  {t("actions.expandAll")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={controller.collapseAll}>
                  {t("actions.collapseAll")}
                </DropdownMenuItem>
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
              {t("actions.delete")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
