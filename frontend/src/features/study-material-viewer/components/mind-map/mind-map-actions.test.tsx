import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MindMapNode } from "./mind-map-node";
import { useMindMapLayout } from "./use-mind-map-layout";
import type { MindMapFlowNode } from "./mind-map-types";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  BezierEdge: () => null,
  Position: { Left: "left", Right: "right" },
  useNodesState: () => { const [nodes, setNodes] = useState([]); return [nodes, setNodes, vi.fn()]; },
  useEdgesState: () => { const [edges, setEdges] = useState([]); return [edges, setEdges, vi.fn()]; },
  useReactFlow: () => ({ fitView: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn(), setCenter: vi.fn() }),
}));

const content = {
  rootId: "root",
  nodes: [{ id: "root", label: "Root" }, { id: "branch", label: "Branch" }, { id: "leaf", label: "Leaf" }],
  edges: [{ id: "a", sourceId: "root", targetId: "branch" }, { id: "b", sourceId: "branch", targetId: "leaf" }],
};

describe("mind map node actions", () => {
  it("prepares an unsent prompt for root, branch, and leaf nodes", () => {
    const listener = vi.fn();
    window.addEventListener("send-chat-prompt", listener);
    const { result } = renderHook(() => useMindMapLayout({ materialId: "map", materialTitle: "Study map", content }));
    for (const label of ["Root", "Branch", "Leaf"]) {
      const item = label === "Root" ? result.current.root! : label === "Branch" ? result.current.root!.children[0] : result.current.root!.children[0].children[0];
      act(() => { result.current.nodes[0].data.onAskInChat(item); });
      const event = listener.mock.calls.at(-1)![0] as CustomEvent;
      expect(event.detail).toMatchObject({ concept: label, autoSend: false, focusChat: true });
      expect(event.detail.prompt).toContain(label);
      expect(event.detail.prompt).toContain("Study map");
    }
    window.removeEventListener("send-chat-prompt", listener);
  });

  it("opens the node action from its button and right click", async () => {
    const onAskInChat = vi.fn();
    const item = { id: "leaf", label: "Leaf", children: [] };
    const data: MindMapFlowNode["data"] = { item, depth: 1, selected: false, expanded: false, onToggle: vi.fn(), onAskInChat };
    render(<MindMapNode id="leaf" type="mindMap" data={data} selected={false} isConnectable={false} dragging={false} zIndex={0} positionAbsoluteX={0} positionAbsoluteY={0} selectable deletable draggable />);
    await userEvent.click(screen.getByRole("button", { name: "Actions for Leaf" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Ask in chat" }));
    expect(onAskInChat).toHaveBeenCalledWith(item);
    fireEvent.contextMenu(screen.getByText("Leaf"));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Ask in chat" }));
    expect(onAskInChat).toHaveBeenCalledTimes(2);
  });
});
