import type { TreeNode } from "../../model/tree";
import { useTreeControllerContext } from "../controller";
import { Row } from "./row";

type BranchProps = {
  node: TreeNode;
  depth: number;
};

export function Branch({ node, depth }: BranchProps) {
  const controller = useTreeControllerContext();

  if (node.type === "material") {
    return <Row node={node} depth={depth} />;
  }

  const isOpen = controller.isFolderOpen(node.id);

  return (
    <div data-slot="study-materials-tree-branch" data-size={controller.size}>
      <Row node={node} depth={depth} />
      {isOpen && node.children.length > 0 && (
        <div
          className="relative"
          data-slot="study-materials-tree-branch-children"
          data-size={controller.size}
        >
          {node.children.map((child) => (
            <Branch key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
