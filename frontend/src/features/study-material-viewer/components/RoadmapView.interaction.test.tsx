import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { RoadmapView } from "./RoadmapView";

it("keeps the real React Flow nodes interactive for the study and copy buttons", async () => {
  render(
    <RoadmapView
      materialId="roadmap"
      content={{
        phases: [
          {
            id: "phase",
            title: "Phase",
            order: 0,
            topics: [{ id: "topic", title: "Topic", order: 0 }],
          },
        ],
      }}
    />,
  );
  const phase = await screen.findByTestId("rf__node-phase-0");
  const topic = await screen.findByTestId("rf__node-topic-0-0");
  expect(phase.style.pointerEvents).toBe("all");
  expect(topic.style.pointerEvents).toBe("all");
});
