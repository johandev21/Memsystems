import {
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  ChevronsUpDown,
  Copy,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Pencil,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TreeNode } from "../../model/tree";
import { useTreeControllerContext } from "../controller-state";

type RowMenuProps = {
  node: TreeNode;
};

export function RowMenu({ node }: RowMenuProps) {
  const { t } = useTranslation("tree");
  const controller = useTreeControllerContext();
  const isFolder = node.type === "folder";

  return (
    <ContextMenuContent data-slot="study-materials-tree-row-menu" className="min-w-48">
      <ContextMenuGroup>
        {isFolder && (
          <ContextMenuItem
            data-slot="study-materials-tree-row-menu-item"
            onClick={() => controller.createFolder(node.id)}
          >
            <FolderPlus />
            {t("actions.newFolder")}
          </ContextMenuItem>
        )}
        <ContextMenuItem
          data-slot="study-materials-tree-row-menu-item"
          onClick={() => controller.beginRename(node.id)}
        >
          <Pencil />
          {t("actions.rename")}
        </ContextMenuItem>
        {node.type === "material" && (
          <ContextMenuItem
            data-slot="study-materials-tree-row-menu-item"
            onClick={() => controller.duplicateMaterial(node.id)}
          >
            <Copy />
            {t("actions.duplicate")}
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
          {t("actions.moveToRoot")}
        </ContextMenuItem>
        {isFolder && (
          <>
            <ContextMenuItem
              data-slot="study-materials-tree-row-menu-item"
              onClick={controller.expandAll}
            >
              <FolderOpen />
              {t("actions.expandAll")}
            </ContextMenuItem>
            <ContextMenuItem
              data-slot="study-materials-tree-row-menu-item"
              onClick={controller.collapseAll}
            >
              <ChevronsUpDown />
              {t("actions.collapseAll")}
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
          {t("actions.delete")}
        </ContextMenuItem>
      </ContextMenuGroup>
    </ContextMenuContent>
  );
}
