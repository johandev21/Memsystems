import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const { providerProps } = vi.hoisted(() => ({ providerProps: vi.fn() }));

vi.mock("@/components/ui/message-scroller", async () => {
  const React = await import("react");

  type DivProps = Record<string, unknown>;

  return {
    MessageScrollerProvider: (props: { children?: ReactNode }) => {
      providerProps(props);
      return React.createElement(React.Fragment, null, props.children);
    },
    MessageScroller: (props: DivProps) =>
      React.createElement("div", { ...props, "data-slot": "message-scroller" }),
    MessageScrollerViewport: (props: DivProps) =>
      React.createElement("div", { ...props, "data-slot": "message-scroller-viewport" }),
    MessageScrollerContent: (props: DivProps) =>
      React.createElement("div", { ...props, "data-slot": "message-scroller-content" }),
    MessageScrollerItem: (props: DivProps) =>
      React.createElement("div", {
        ...props,
        "data-slot": "message-scroller-item",
        "data-message-id": props.messageId as string | undefined,
        "data-scroll-anchor": String((props.scrollAnchor as boolean | undefined) ?? false),
      }),
    MessageScrollerButton: () => null,
  };
});

import {
  Conversation,
  ConversationContent,
  ConversationItem,
  ConversationScrollButton,
} from "./conversation";

describe("Conversation Component", () => {
  it("defaults to last-anchor scroll position and forwards container classes", () => {
    const { container } = render(
      <Conversation className="bg-primary">
        <ConversationContent className="text-center">
          <ConversationItem messageId="item-1" scrollAnchor>
            <div>Message 1</div>
          </ConversationItem>
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>,
    );

    expect(providerProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        autoScroll: false,
        defaultScrollPosition: "last-anchor",
        scrollPreviousItemPeek: 64,
      }),
    );

    const scrollerRoot = container.querySelector('[data-slot="message-scroller"]');
    const viewport = container.querySelector('[data-slot="message-scroller-viewport"]');
    const content = container.querySelector('[data-slot="message-scroller-content"]');
    const item = container.querySelector('[data-slot="message-scroller-item"]');

    expect(scrollerRoot).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(content).not.toBeNull();
    expect(item).not.toBeNull();

    expect(scrollerRoot?.classList.contains("bg-primary")).toBe(true);
    expect(content?.classList.contains("text-center")).toBe(true);
    expect(item?.getAttribute("data-scroll-anchor")).toBe("true");
    expect(item?.getAttribute("data-message-id")).toBe("item-1");
  });

  it("honors an explicit defaultScrollPosition override", () => {
    render(
      <Conversation defaultScrollPosition="start">
        <ConversationContent>content</ConversationContent>
      </Conversation>,
    );

    expect(providerProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ defaultScrollPosition: "start" }),
    );
  });
});
