import {
  Command,
  Copy,
  Delete,
  Folder,
  FolderOpen,
  FolderPlus,
  FolderInput,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import type { TreeNode } from "../../model/tree";
import { useTreeControllerContext } from "../controller";

type RowMenuProps = {
  node: TreeNode;
};

export function RowMenu({ node }: RowMenuProps) {
  const controller = useTreeControllerContext();
  const isFolder = node.type === "folder";

  return (
    <ContextMenuContent data-slot="study-materials-tree-row-menu" className="min-w-56">
      <ContextMenuGroup>
        {isFolder && (
          <ContextMenuItem
            data-slot="study-materials-tree-row-menu-item"
            onClick={() => controller.createFolder(node.id)}
          >
            <FolderPlus />
            New folder
            <ContextMenuShortcut className="flex items-center gap-1 tracking-normal font-sans text-xs text-muted-foreground group-focus/context-menu-item:text-accent-foreground">
              <Command className="size-4 shrink-0" aria-hidden="true" />
              <span className="font-sans font-medium">N</span>
              <span className="sr-only">Command N</span>
            </ContextMenuShortcut>
          </ContextMenuItem>
        )}
        <ContextMenuItem
          data-slot="study-materials-tree-row-menu-item"
          onClick={() => controller.beginRename(node.id)}
        >
          <Pencil />
          Rename
          <ContextMenuShortcut className="tracking-normal font-sans text-xs text-muted-foreground group-focus/context-menu-item:text-accent-foreground">
            <span className="font-sans font-medium">F2</span>
            <span className="sr-only">F2</span>
          </ContextMenuShortcut>
        </ContextMenuItem>
        {node.type === "material" && (
          <ContextMenuItem
            data-slot="study-materials-tree-row-menu-item"
            onClick={() => controller.duplicateMaterial(node.id)}
          >
            <Copy />
            Duplicate
          </ContextMenuItem>
        )}
      </ContextMenuGroup>
      <ContextMenuSeparator />
      <ContextMenuGroup>
        <ContextMenuItem
          data-slot="study-materials-tree-row-menu-item"
          disabled={node.parentId === null}
          onClick={() => controller.moveToRoot(node.id)}
        >
          <FolderInput />
          Move to Study Materials
        </ContextMenuItem>
        {isFolder && (
          <>
            <ContextMenuItem
              data-slot="study-materials-tree-row-menu-item"
              onClick={controller.expandAll}
            >
              <FolderOpen />
              Expand all
            </ContextMenuItem>
            <ContextMenuItem
              data-slot="study-materials-tree-row-menu-item"
              onClick={controller.collapseAll}
            >
              <Folder />
              Collapse all
            </ContextMenuItem>
          </>
        )}
      </ContextMenuGroup>
      <ContextMenuSeparator />
      <ContextMenuGroup>
        <ContextMenuItem
          data-slot="study-materials-tree-row-menu-item"
          variant="destructive"
          onClick={() => controller.requestDelete(node)}
        >
          <Trash2 />
          Delete
          <ContextMenuShortcut className="flex items-center tracking-normal text-destructive/75 group-focus/context-menu-item:text-destructive">
            <Delete className="size-5 shrink-0" aria-hidden="true" />
            <span className="sr-only">Backspace</span>
          </ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuGroup>
    </ContextMenuContent>
  );
}
