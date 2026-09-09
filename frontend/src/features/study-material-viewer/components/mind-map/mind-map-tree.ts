import type { Edge } from "@xyflow/react";
import type { MapItem, MindMapFlowNode, MindMapViewProps } from "./mind-map-types";

export function createTree(content: MindMapViewProps["content"]): {
  root: MapItem | null;
  depths: Map<string, number>;
} {
  const nodesById = new Map(content.nodes.map((node) => [node.id, node]));
  const childrenById = new Map<string, string[]>();
  const childIds = new Set<string>();

  for (const edge of content.edges) {
    if (!nodesById.has(edge.sourceId) || !nodesById.has(edge.targetId)) continue;
    const children = childrenById.get(edge.sourceId) ?? [];
    children.push(edge.targetId);
    childrenById.set(edge.sourceId, children);
    childIds.add(edge.targetId);
  }

  const rootId = content.rootId || content.nodes.find((node) => !childIds.has(node.id))?.id;
  if (!rootId || !nodesById.has(rootId)) return { root: null, depths: new Map() };

  const visited = new Set<string>();
  const depths = new Map<string, number>();
  const build = (id: string, depth: number): MapItem | null => {
    if (visited.has(id)) return null;
    const node = nodesById.get(id);
    if (!node) return null;
    visited.add(id);
    depths.set(id, depth);

    return {
      id: node.id,
      label: node.label,
      color: node.color,
      children: (childrenById.get(id) ?? []).flatMap((childId) => {
        const child = build(childId, depth + 1);
        return child ? [child] : [];
      }),
    };
  };

  return { root: build(rootId, 0), depths };
}

export function buildGraph(
  root: MapItem,
  expandedIds: Set<string>,
  selectedId: string | null,
  onToggle: (id: string) => void,
  isMobileLayout = false,
): { nodes: MindMapFlowNode[]; edges: Edge[] } {
  const nodes: MindMapFlowNode[] = [];
  const edges: Edge[] = [];
  const rowsByDepth = new Map<number, number>();
  const xStep = isMobileLayout ? 220 : 330;
  const yStep = isMobileLayout ? 112 : 128;

  const visit = (item: MapItem, depth: number, parentId?: string) => {
    const row = rowsByDepth.get(depth) ?? 0;
    rowsByDepth.set(depth, row + 1);

    nodes.push({
      id: item.id,
      type: "mindMap",
      position: { x: depth * xStep, y: (row - 2) * yStep },
      data: {
        item,
        depth,
        expanded: expandedIds.has(item.id),
        selected: selectedId === item.id,
        onToggle,
      },
    });

    if (parentId) {
      const active = parentId === selectedId || item.id === selectedId;
      edges.push({
        id: `${parentId}-${item.id}`,
        source: parentId,
        target: item.id,
        type: active ? "highlight" : "default",
        style: {
          stroke: active ? "var(--surface-border-strong)" : "var(--surface-border)",
          strokeWidth: active ? 2.5 : 1.5,
        },
      });
    }

    if (expandedIds.has(item.id)) {
      item.children.forEach((child) => visit(child, depth + 1, item.id));
    }
  };

  visit(root, 0);
  return { nodes, edges };
}
