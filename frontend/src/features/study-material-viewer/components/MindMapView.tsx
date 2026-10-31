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

export function MindMapView(props: MindMapViewProps) {
  return (
    <ReactFlowProvider>
      <MindMapFlow {...props} />
    </ReactFlowProvider>
  );
}

const nodeTypes = { mindMap: MindMapNode };
const edgeTypes = { highlight: HighlightEdge };
// Node controls use this class so pointer interactions don't start a graph drag.
const nodeControlClass = "touch-manipulation";

function MindMapFlow(props: MindMapViewProps) {
  const {
    root,
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    selectNode,
    handleCenterSelected,
    zoomIn,
    zoomOut,
    expandAll,
    collapseAll,
  } = useMindMapLayout(props);

  if (!root) {
    return <EmptyMindMap />;
  }

  return (
    <div className="relative h-[min(520px,calc(100dvh-160px))] sm:h-[min(680px,calc(100dvh-180px))] min-h-105 w-full overflow-hidden">
      <ReactFlow<MindMapFlowNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => selectNode(node.data.item)}
        onInit={(instance) => window.setTimeout(() => instance.fitView({ padding: 0.24 }), 100)}
        fitView
        minZoom={0.35}
        maxZoom={1.7}
        panOnDrag
        panOnScroll
        noDragClassName={nodeControlClass}
        zoomOnScroll={false}
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
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
      />
    </div>
  );
}
