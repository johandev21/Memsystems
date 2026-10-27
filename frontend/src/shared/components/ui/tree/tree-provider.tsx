import type { ReactNode } from "react";
import { TreeContext } from "./tree-context";
import type { TreeController } from "./use-tree-controller";
import type { BaseTreeNode } from "./types";

export function TreeControllerProvider<TNode extends BaseTreeNode = BaseTreeNode>({
  controller,
  children,
}: {
  controller: TreeController<TNode>;
  children: ReactNode;
}) {
  return <TreeContext.Provider value={controller}>{children}</TreeContext.Provider>;
}
