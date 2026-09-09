import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
} from "@xyflow/react";
import type { MapItem, MindMapFlowNode, MindMapViewProps } from "./mind-map-types";
import { buildGraph, createTree } from "./mind-map-tree";

export function useMindMapLayout({ content, materialTitle }: MindMapViewProps) {
  const { root, depths } = useMemo(() => createTree(content), [content]);
  const rootId = root?.id ?? null;
  const [expandedIds, setExpandedIds] = useState(() => new Set(rootId ? [rootId] : []));
  const [selectedId, setSelectedId] = useState<string | null>(rootId);
  const [viewportFocus, setViewportFocus] = useState<{
    id: string;
    childrenOnly: boolean;
  } | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<MindMapFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView, zoomIn, zoomOut, setCenter } = useReactFlow();

  useEffect(() => {
    setExpandedIds(new Set(rootId ? [rootId] : []));
    setSelectedId(rootId);
  }, [content, rootId]);

  const toggleNode = useCallback(
    (id: string) => {
      setSelectedId(id);
      const isCollapsing = expandedIds.has(id);
      setViewportFocus({ id, childrenOnly: !isCollapsing });
      setExpandedIds((current) => {
        const next = new Set(current);
        if (next.has(id)) {
          next.delete(id);
        } else {
          const depth = depths.get(id);
          if (depth !== undefined) {
            for (const [candidateId, candidateDepth] of depths) {
              if (candidateDepth === depth && candidateId !== id) next.delete(candidateId);
            }
          }
          next.add(id);
        }
        return next;
      });
    },
    [depths, expandedIds],
  );

  const selectLeaf = useCallback(
    (item: MapItem) => {
      setSelectedId(item.id);
      if (item.children.length > 0) {
        toggleNode(item.id);
        return;
      }

      const prompt = `I'm studying the mind-map concept "${item.label}"${materialTitle ? ` from the study material "${materialTitle}"` : ""}.\n\nPlease explain this concept in depth with practical examples, related ideas, and key insights I should remember.`;
      window.dispatchEvent(
        new CustomEvent("send-chat-prompt", {
          detail: {
            prompt,
            autoSend: false,
            focusChat: true,
            concept: item.label,
          },
        }),
      );
    },
    [materialTitle, toggleNode],
  );

  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobileViewport(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  const graph = useMemo(
    () =>
      root
        ? buildGraph(root, expandedIds, selectedId, toggleNode, isMobileViewport)
        : { nodes: [], edges: [] },
    [expandedIds, root, selectedId, toggleNode, isMobileViewport],
  );

  useEffect(() => setNodes(graph.nodes), [graph.nodes, setNodes]);
  useEffect(() => setEdges(graph.edges), [graph.edges, setEdges]);
  useEffect(() => {
    const timeout = window.setTimeout(() => fitView({ duration: 450, padding: 0.24 }), 150);
    return () => window.clearTimeout(timeout);
  }, [content, fitView]);

  useEffect(() => {
    if (!viewportFocus) return;

    const focusNodeIds = new Set<string>();
    if (!viewportFocus.childrenOnly) focusNodeIds.add(viewportFocus.id);
    graph.edges.forEach((edge) => {
      if (edge.source === viewportFocus.id) focusNodeIds.add(edge.target);
    });
    if (focusNodeIds.size === 0) focusNodeIds.add(viewportFocus.id);

    const focusNodes = graph.nodes.reduce<{ id: string }[]>((acc, node) => {
      if (focusNodeIds.has(node.id)) acc.push({ id: node.id });
      return acc;
    }, []);
    if (focusNodes.length === 0) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeout = window.setTimeout(() => {
      fitView({
        nodes: focusNodes,
        padding: 0.35,
        duration: reducedMotion ? 0 : 450,
      });
      setViewportFocus(null);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [fitView, graph.edges, graph.nodes, viewportFocus]);

  const handleCenterSelected = () => {
    const node = nodes.find((candidate) => candidate.id === selectedId);
    if (node) {
      setCenter(node.position.x + 100, node.position.y + 40, { zoom: 1.05, duration: 500 });
    } else {
      fitView({ duration: 500, padding: 0.24 });
    }
  };

  return {
    root,
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    selectLeaf,
    handleCenterSelected,
    zoomIn: () => zoomIn({ duration: 300 }),
    zoomOut: () => zoomOut({ duration: 300 }),
  };
}
