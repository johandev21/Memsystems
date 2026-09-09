import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
