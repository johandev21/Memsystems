import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type {
  MindMapNodeData,
  MindMapEdgeData,
  MindMapViewProps,
  MindMapFlowNode,
} from "./mind-map/mind-map-types";
import { MindMapNode, HighlightEdge } from "./mind-map/mind-map-node";
import { EmptyMindMap, MindMapControls } from "./mind-map/mind-map-controls";
import { useMindMapLayout } from "./mind-map/use-mind-map-layout";

export type { MindMapNodeData, MindMapEdgeData, MindMapViewProps };

const nodeTypes = { mindMap: MindMapNode };
const edgeTypes = { highlight: HighlightEdge };

function MindMapFlow(props: MindMapViewProps) {
  const {
    root,
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    selectLeaf,
    handleCenterSelected,
    zoomIn,
    zoomOut,
  } = useMindMapLayout(props);

  if (!root) {
    return <EmptyMindMap />;
  }

  return (
    <div className="relative h-[min(520px,calc(100dvh-160px))] sm:h-[min(680px,calc(100dvh-180px))] min-h-[420px] w-full overflow-hidden rounded-xl border border-surface-border bg-surface-1">
      <ReactFlow<MindMapFlowNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => selectLeaf(node.data.item)}
        onInit={(instance) => window.setTimeout(() => instance.fitView({ padding: 0.24 }), 100)}
        fitView
        minZoom={0.35}
        maxZoom={1.7}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="var(--surface-border)"
        />
      </ReactFlow>

      <MindMapControls
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onCenter={handleCenterSelected}
      />

      <div className="pointer-events-none absolute bottom-4 left-4 hidden items-center gap-2 rounded-full border border-surface-border-subtle bg-surface-2 px-3 py-2 text-xs text-text-faint sm:flex">
        <span className="size-1.5 rounded-full bg-surface-border-strong" /> Drag to pan · Scroll to
        zoom · Click a node to explore
      </div>
    </div>
  );
}

export function MindMapView(props: MindMapViewProps) {
  return (
    <ReactFlowProvider>
      <MindMapFlow {...props} />
    </ReactFlowProvider>
  );
}
