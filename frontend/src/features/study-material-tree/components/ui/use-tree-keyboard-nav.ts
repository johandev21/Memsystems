import type { TreeNode } from "../model/tree";
import { useTreeKeyboardNav as useSharedTreeKeyboardNav } from "@/components/ui/tree";

export interface UseTreeKeyboardNavOptions {
  activeDragItemId: string | null;
  visibleItems: TreeNode[];
  openFolderIds: Set<string>;
  setFolderOpen: (folderId: string, open: boolean) => void;
  focus: (id: string) => void;
  activate: (node: TreeNode) => void;
  beginRename: (id: string) => void;
}

export function useTreeKeyboardNav(options: UseTreeKeyboardNavOptions) {
  return useSharedTreeKeyboardNav<TreeNode>(options);
}
