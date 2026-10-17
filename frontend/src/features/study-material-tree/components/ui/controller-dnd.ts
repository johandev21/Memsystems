import {
  findTreeNode,
  getTreeDragData as getSharedTreeDragData,
  getTreeDropData as getSharedTreeDropData,
} from "@/components/ui/tree";

export const ROOT_DROP_ID = "study-materials-root";
export const DRAG_ID_PREFIX = "study-materials-drag:";
export const FOLDER_DROP_ID_PREFIX = "study-materials-folder:";

export type TreeDragData = {
  type: "study-material-tree-item";
  itemId: string;
};

export type TreeDropData =
  | { type: "study-materials-root"; folderId: null }
  | { type: "study-materials-folder"; folderId: string };

export function getTreeDragData(data: unknown): TreeDragData | null {
  const result = getSharedTreeDragData(data);
  if (result && result.type === "study-material-tree-item") {
    return result as TreeDragData;
  }
  return null;
}

export function getTreeDropData(data: unknown): TreeDropData | null {
  const result = getSharedTreeDropData(data);
  if (
    result &&
    (result.type === "study-materials-root" || result.type === "study-materials-folder")
  ) {
    return result as TreeDropData;
  }
  return null;
}

export { findTreeNode };
