export function flattenVisibleTree<
  TNode extends { id: string; type: string; children?: readonly any[] },
>(nodes: readonly TNode[], openFolderIds: ReadonlySet<string>): TNode[] {
  const visibleNodes: TNode[] = [];
  const visit = (items: readonly TNode[]) => {
    for (const item of items) {
      visibleNodes.push(item);
      if (item.type === "folder" && openFolderIds.has(item.id) && item.children) {
        visit(item.children as readonly TNode[]);
      }
    }
  };
  visit(nodes);
  return visibleNodes;
}

export function findTreeNode<TNode extends { id: string; children?: readonly any[] }>(
  nodes: readonly TNode[],
  id: string | null,
): TNode | null {
  if (!id) return null;
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const descendant = findTreeNode(node.children as readonly TNode[], id);
      if (descendant) return descendant;
    }
  }
  return null;
}

export function getDescendantFolderIds<
  TFolder extends { id: string; parentId: string | null; deletedAt?: string | null },
>(folders: readonly TFolder[], folderId: string): Set<string> {
  const descendants = new Set<string>();
  const childFolderIds = new Map<string, string[]>();

  for (const folder of folders) {
    if (!folder.deletedAt && folder.parentId) {
      const list = childFolderIds.get(folder.parentId) ?? [];
      list.push(folder.id);
      childFolderIds.set(folder.parentId, list);
    }
  }

  const visit = (id: string) => {
    for (const childId of childFolderIds.get(id) ?? []) {
      descendants.add(childId);
      visit(childId);
    }
  };

  visit(folderId);
  return descendants;
}

export function canMoveFolder<
  TFolder extends { id: string; parentId: string | null; deletedAt?: string | null },
>(
  folders: readonly TFolder[],
  folderId: string,
  targetFolderId: string | null,
): boolean {
  if (folderId === targetFolderId) return false;
  const folder = folders.find((f) => f.id === folderId && !f.deletedAt);
  if (!folder) return false;
  if (folder.parentId === targetFolderId) return false;
  if (!targetFolderId) return true;
  const descendants = getDescendantFolderIds(folders, folderId);
  return !descendants.has(targetFolderId);
}
