import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SlidesView } from "./SlidesView";
import type { SlidesContentType } from "../shapes/slides";

const content: SlidesContentType = {
  design: { preset: "dark" },
  slides: [
    { id: "s1", role: "title", title: "Opening" },
    {
      id: "s2",
      role: "comparison",
      title: "Ideas",
      bullets: ["First", "Second"],
      elements: [
        {
          type: "comparison",
          left: { heading: "A", points: ["First"] },
          right: { heading: "B", points: ["Second"] },
        },
      ],
    },
  ],
  previews: [
    { slideId: "s1", svg: `<svg xmlns="http://www.w3.org/2000/svg"><text>Opening</text></svg>` },
    { slideId: "s2", svg: `<svg xmlns="http://www.w3.org/2000/svg"><text>Ideas</text></svg>` },
  ],
};

describe("SlidesView", () => {
  it("renders image previews sequentially with a counter", () => {
    const { container } = render(
      <SlidesView materialId="m1" materialTitle="deck-slides" content={{ ...content }} />,
    );
    expect(container.textContent).toContain("Slide 1 / 2");
    expect(screen.getByAltText(/Preview of slide 1/)).toBeDefined();
    // Every preview image letterboxes the full 16:9 slide instead of cropping it
    const images = container.querySelectorAll("img");
    expect(images.length).toBe(3);
    for (const img of images) {
      expect(img.className).toContain("object-contain");
      expect(img.className).not.toContain("object-cover");
    }
  });

  it("advances previews with next/previous controls", () => {
    const { container } = render(
      <SlidesView materialId="m1" materialTitle="deck-slides" content={{ ...content }} />,
    );
    fireEvent.click(screen.getByLabelText("Next slide"));
    expect(container.textContent).toContain("Slide 2 / 2");
    fireEvent.click(screen.getByLabelText("Previous slide"));
    expect(container.textContent).toContain("Slide 1 / 2");
  });

  it("exposes an editable pptx export action", () => {
    render(<SlidesView materialId="m1" materialTitle="deck-slides" content={{ ...content }} />);
    expect(screen.getByRole("button", { name: /Export \.pptx/ })).toBeDefined();
  });

  it("shows the active deck design and slide role", () => {
    render(<SlidesView materialId="m1" materialTitle="deck-slides" content={{ ...content }} />);
    expect(screen.getByLabelText("Deck design: dark")).toBeDefined();
    expect(screen.getByText("title")).toBeDefined();
  });

  it("renders a recovery fallback when a preview is missing", () => {
    const withoutPreviews: SlidesContentType = {
      design: { preset: "light" },
      slides: [
        {
          id: "s1",
          role: "content",
          title: "Ideas",
          elements: [{ type: "bullet-list", items: ["First"] }],
        },
      ],
    };
    const { container } = render(
      <SlidesView materialId="m1" materialTitle="deck-slides" content={withoutPreviews} />,
    );
    expect(container.textContent).toContain("Preview unavailable for this slide.");
    expect(container.textContent).toContain("First");
  });
});
