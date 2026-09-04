import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SlidesView } from "./SlidesView";
import type { SlidesContentType } from "../shapes/slides";

const content: SlidesContentType = {
  slides: [
    { id: "s1", layout: "title", title: "Opening" },
    { id: "s2", layout: "title-bullets", title: "Ideas", bullets: ["First", "Second"] },
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
    expect(screen.getByText("Slide 1 / 2")).toBeDefined();
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
    render(<SlidesView materialId="m1" materialTitle="deck-slides" content={{ ...content }} />);
    fireEvent.click(screen.getByLabelText("Next slide"));
    expect(screen.getByText("Slide 2 / 2")).toBeDefined();
    fireEvent.click(screen.getByLabelText("Previous slide"));
    expect(screen.getByText("Slide 1 / 2")).toBeDefined();
  });

  it("exposes an editable pptx export action", () => {
    render(<SlidesView materialId="m1" materialTitle="deck-slides" content={{ ...content }} />);
    expect(screen.getByRole("button", { name: /Export \.pptx/ })).toBeDefined();
  });
});
