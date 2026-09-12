import type { Node } from "@xyflow/react";

export interface MindMapNodeData {
  id: string;
  label: string;
  color?: string | null;
  position?: { x: number; y: number } | null;
}

export interface MindMapEdgeData {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string | null;
  directed?: boolean | null;
}

export interface MindMapViewProps {
  materialId: string;
  materialTitle?: string;
  content: {
    rootId?: string | null;
    nodes: MindMapNodeData[];
    edges: MindMapEdgeData[];
  };
}

export type MapItem = {
  id: string;
  label: string;
  color?: string | null;
  children: MapItem[];
};

export type MindMapNodeDataInternal = {
  item: MapItem;
  depth: number;
  expanded: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
};

export type MindMapFlowNode = Node<MindMapNodeDataInternal, "mindMap">;
