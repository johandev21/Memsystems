import type { TreeNode } from "../model/tree";

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
  if (!data || typeof data !== "object") return null;
  const candidate = data as Partial<TreeDragData>;
  return candidate.type === "study-material-tree-item" && typeof candidate.itemId === "string"
    ? { type: candidate.type, itemId: candidate.itemId }
    : null;
}

export function getTreeDropData(data: unknown): TreeDropData | null {
  if (!data || typeof data !== "object") return null;
  const candidate = data as Partial<TreeDropData>;
  if (candidate.type === "study-materials-root") return { type: candidate.type, folderId: null };
  if (candidate.type === "study-materials-folder" && typeof candidate.folderId === "string")
    return { type: candidate.type, folderId: candidate.folderId };
  return null;
}

export function findTreeNode(nodes: readonly TreeNode[], id: string | null): TreeNode | null {
  if (!id) return null;
  for (const node of nodes) {
    if (node.id === id) return node;
    const descendant = findTreeNode(node.children, id);
    if (descendant) return descendant;
  }
  return null;
}
