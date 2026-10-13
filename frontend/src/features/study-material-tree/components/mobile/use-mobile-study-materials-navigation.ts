import { useMemo, useState } from "react";
import type { FolderDTO } from "../../types";
import type { StudyMaterialDTO } from "@/features/study-material-viewer";
import {
  buildStudyMaterialTree,
  type TreeNode,
} from "../model/tree";

export type NavigationDirection = "forward" | "back";

function findNode(
  nodes: readonly TreeNode[],
  id: string,
): TreeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const nested = findNode(node.children, id);
    if (nested) return nested;
  }
  return undefined;
}

/**
 * Drill-down navigation over the study materials tree: exposes only the children
 * of the folder currently being viewed. If the active folder is deleted or moved,
 * resolves safely to the root.
 */
export function useMobileStudyMaterialsNavigation(
  folders: readonly FolderDTO[] | undefined,
  materials: readonly StudyMaterialDTO[] | undefined,
) {
  const [requestedFolderId, setRequestedFolderId] = useState<string | null>(null);
  const [direction, setDirection] = useState<NavigationDirection>("forward");

  const tree = useMemo(
    () => buildStudyMaterialTree({ folders: folders ?? [], materials: materials ?? [] }),
    [folders, materials],
  );

  const activeFolderNode = requestedFolderId ? findNode(tree, requestedFolderId) : undefined;
  const activeFolderId = activeFolderNode?.id ?? null;
  const items = activeFolderNode ? activeFolderNode.children : tree;
  const parentId = activeFolderNode?.parentId ?? null;
  const parentFolder = parentId ? folders?.find((folder) => folder.id === parentId) : undefined;

  const openFolder = (id: string) => {
    setDirection("forward");
    setRequestedFolderId(id);
  };

  const goBack = () => {
    setDirection("back");
    setRequestedFolderId(parentFolder?.id ?? null);
  };

  const resetToRoot = () => {
    setDirection("back");
    setRequestedFolderId(null);
  };

  return {
    activeFolderId,
    activeFolderName: activeFolderNode?.name,
    items,
    direction,
    openFolder,
    goBack,
    resetToRoot,
  };
}
