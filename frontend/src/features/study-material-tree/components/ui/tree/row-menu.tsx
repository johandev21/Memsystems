import { Copy, Folder, FolderOpen, FolderPlus, FolderInput, Pencil, Trash2 } from "lucide-react";
import {
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import type { TreeNode } from "../../model/tree";
import { useTreeControllerContext } from "../controller";

type RowMenuProps = {
  node: TreeNode;
};

export function RowMenu({ node }: RowMenuProps) {
  const controller = useTreeControllerContext();
  const isFolder = node.type === "folder";

  return (
    <ContextMenuContent data-slot="study-materials-tree-row-menu" className="min-w-52">
      <ContextMenuGroup>
        {isFolder && (
          <ContextMenuItem
            data-slot="study-materials-tree-row-menu-item"
            onClick={() => controller.createFolder(node.id)}
          >
            <FolderPlus />
            New folder
            <ContextMenuShortcut>
              <KbdGroup>
                <Kbd>⌘</Kbd>
                <Kbd>N</Kbd>
              </KbdGroup>
            </ContextMenuShortcut>
          </ContextMenuItem>
        )}
        <ContextMenuItem
          data-slot="study-materials-tree-row-menu-item"
          onClick={() => controller.beginRename(node.id)}
        >
          <Pencil />
          Rename
          <ContextMenuShortcut>
            <Kbd>F2</Kbd>
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
          <ContextMenuShortcut>
            <Kbd>⌫</Kbd>
          </ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuGroup>
    </ContextMenuContent>
  );
}
