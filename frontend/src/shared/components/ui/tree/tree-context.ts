import { createContext, useContext } from "react";
import type { TreeController } from "./use-tree-controller";
import type { BaseTreeNode } from "./types";

export const TreeContext = createContext<TreeController<any> | null>(null);

export function useTreeControllerContext<
  TNode extends BaseTreeNode = BaseTreeNode,
>(): TreeController<TNode> {
  const ctx = useContext(TreeContext);
  if (!ctx) throw new Error("TreeController context not found");
  return ctx as TreeController<TNode>;
}
