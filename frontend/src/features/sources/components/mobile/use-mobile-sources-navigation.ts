import { useMemo, useState } from "react";
import {
  buildSourcesTree,
  type SourcesTreeNode,
} from "../../model/sources-tree";
import type { SourceFolder } from "../../types/source-folder.types";
import type { Source } from "../../api/sources";

export type NavigationDirection = "forward" | "back";

function findNode(
  nodes: readonly SourcesTreeNode[],
  id: string,
): SourcesTreeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const nested = findNode(node.children, id);
    if (nested) return nested;
  }
  return undefined;
}

/**
 * Drill-down navigation over the sources tree: exposes only the children of
 * the folder currently being viewed. A folder that is deleted or moved while
 * open resolves to the root instead of leaving the user on a dead screen.
 */
export function useMobileSourcesNavigation(
  folders: readonly SourceFolder[] | undefined,
  sources: readonly Source[] | undefined,
) {
  const [requestedFolderId, setRequestedFolderId] = useState<string | null>(null);
  const [direction, setDirection] = useState<NavigationDirection>("forward");

  const tree = useMemo(
    () => buildSourcesTree({ folders: folders ?? [], sources: sources ?? [] }),
    [folders, sources],
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

  return {
    activeFolderId,
    activeFolderName: activeFolderNode?.name,
    items,
    direction,
    openFolder,
    goBack,
  };
}
