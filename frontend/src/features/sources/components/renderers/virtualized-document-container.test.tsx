import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VirtualizedDocumentContainer } from "./virtualized-document-container";

function createMockScrollContainer() {
  const el = document.createElement("div");
  Object.defineProperty(el, "clientHeight", { value: 600 });
  Object.defineProperty(el, "scrollHeight", { value: 2000 });
  Object.defineProperty(el, "offsetHeight", { value: 600 });
  Object.defineProperty(el, "offsetWidth", { value: 800 });
  el.getBoundingClientRect = () => ({
    width: 800,
    height: 600,
    top: 0,
    left: 0,
    bottom: 600,
    right: 800,
    x: 0,
    y: 0,
    toJSON: () => {},
  });
  return el;
}

describe("VirtualizedDocumentContainer", () => {
  it("renders virtual items with custom getItemKey", () => {
    const items = ["Item A", "Item B", "Item C"];
    const scrollElement = createMockScrollContainer();

    const { container } = render(
      <VirtualizedDocumentContainer
        items={items}
        scrollElement={scrollElement}
        getItemKey={(item, index) => `custom-${index}-${item}`}
        renderItem={(item) => <div>{item}</div>}
      />,
    );

    const renderedItems = container.querySelectorAll("[data-index]");
    expect(renderedItems.length).toBeGreaterThan(0);
  });

  it("returns null when items array is empty", () => {
    const scrollElement = createMockScrollContainer();

    const { container } = render(
      <VirtualizedDocumentContainer
        items={[]}
        scrollElement={scrollElement}
        renderItem={(item: string) => <div>{item}</div>}
      />,
    );

    expect(container.firstChild).toBeNull();
  });
});
