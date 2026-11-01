import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { arrangeRoadmap, RoadmapView } from "./RoadmapView";
import type { ComponentType, ReactNode } from "react";

const flowMocks = vi.hoisted(() => ({ fitView: vi.fn() }));

vi.mock("@xyflow/react", () => ({
  ReactFlowProvider: ({ children }: { children: ReactNode }) => children,
  ReactFlow: ({
    nodes,
    nodeTypes,
    children,
    onNodesChange,
  }: {
    nodes: Array<{ id: string; data: unknown }>;
    onNodesChange: (changes: Array<{ id: string; type: string; selected: boolean }>) => void;
    nodeTypes: { roadmap: ComponentType<{ data: unknown }> };
    children: ReactNode;
  }) => (
    <div>
      {nodes.map((node) => (
        <div
          key={node.id}
          onClick={() =>
            onNodesChange(
              nodes.map((item) => ({ id: item.id, type: "select", selected: item.id === node.id })),
            )
          }
        >
          <nodeTypes.roadmap data={node.data} />
        </div>
      ))}
      {children}
    </div>
  ),
  Background: () => null,
  BackgroundVariant: { Dots: "dots" },
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  applyNodeChanges: (
    changes: Array<{ id: string; selected: boolean }>,
    nodes: Array<{ id: string }>,
  ) =>
    nodes.map((node) => ({
      ...node,
      selected: changes.find((change) => change.id === node.id)?.selected ?? false,
    })),
  useNodesInitialized: () => false,
  useReactFlow: () => ({ fitView: flowMocks.fitView, zoomIn: vi.fn(), zoomOut: vi.fn() }),
}));

describe("RoadmapView", () => {
  it("preserves phase study prompts and topic copy actions on the canvas", async () => {
    const listener = vi.fn();
    window.addEventListener("send-chat-prompt", listener);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(
      <RoadmapView
        materialId="roadmap"
        content={{
          title: "Philosophy",
          phases: [
            {
              id: "phase",
              title: "Essence",
              description: "Foundations",
              order: 0,
              topics: [
                { id: "topic", title: "Substance", description: "A kind of being", order: 0 },
              ],
            },
          ],
        }}
      />,
    );
    expect(screen.getByText("A kind of being").className).not.toContain("line-clamp");
    fireEvent.click(screen.getByRole("button", { name: "Study in chat" }));
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toMatchObject({ autoSend: false, focusChat: true });
    expect(event.detail.prompt).toContain("Substance");
    expect(event.detail.prompt).toContain("Philosophy");
    fireEvent.click(screen.getByRole("button", { name: "Copy Substance" }));
    expect(writeText).toHaveBeenCalledWith("Substance\n\nA kind of being");
    window.removeEventListener("send-chat-prompt", listener);
  });
  it("fits the complete roadmap when the fit control is clicked", () => {
    render(
      <RoadmapView
        materialId="roadmap"
        content={{
          phases: [
            { id: "a", title: "First", order: 0, topics: [] },
            { id: "b", title: "Second", order: 1, topics: [] },
          ],
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Fit roadmap" }));
    expect(flowMocks.fitView).toHaveBeenCalledWith(
      expect.not.objectContaining({ nodes: expect.anything() }),
    );
  });
  it("centers the selected topic at a readable zoom", () => {
    flowMocks.fitView.mockClear();
    render(
      <RoadmapView
        materialId="roadmap"
        content={{
          phases: [
            {
              id: "a",
              title: "First",
              order: 0,
              topics: [{ id: "b", title: "Selected topic", order: 0 }],
            },
          ],
        }}
      />,
    );
    fireEvent.click(screen.getByText("Selected topic"));
    fireEvent.click(screen.getByRole("button", { name: "Center selected node" }));
    expect(flowMocks.fitView).toHaveBeenLastCalledWith(
      expect.objectContaining({ nodes: [{ id: "topic-0-0" }], maxZoom: 1.4 }),
    );
  });
  it("places the next phase after the tallest topic in every row", () => {
    const phase = { id: "p", title: "Phase", topics: [] };
    const topic = { id: "t", title: "Topic" };
    const nodes: Parameters<typeof arrangeRoadmap>[0] = [
      {
        id: "phase-0",
        type: "roadmap",
        position: { x: 0, y: 0 },
        measured: { width: 400, height: 300 },
        data: { kind: "phase", phase, phaseIndex: 0, onStudyPhase: vi.fn() },
      },
      {
        id: "topic-0-0",
        type: "roadmap",
        position: { x: 0, y: 0 },
        measured: { width: 300, height: 120 },
        data: { kind: "topic", topic },
      },
      {
        id: "topic-0-1",
        type: "roadmap",
        position: { x: 0, y: 0 },
        measured: { width: 300, height: 220 },
        data: { kind: "topic", topic },
      },
      {
        id: "phase-1",
        type: "roadmap",
        position: { x: 0, y: 0 },
        measured: { width: 400, height: 100 },
        data: { kind: "phase", phase, phaseIndex: 1, onStudyPhase: vi.fn() },
      },
    ];
    const arranged = arrangeRoadmap(nodes);
    expect(arranged[1].position.y).toBeGreaterThanOrEqual(300);
    expect(arranged[3].position.y).toBeGreaterThan(arranged[2].position.y + 220);
  });
});
