import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Conversation,
  ConversationContent,
  ConversationItem,
  ConversationScrollButton,
} from "./conversation";

describe("Conversation Component", () => {
  it("renders with default last-anchor scroll position and container classes", () => {
    const { container } = render(
      <Conversation className="custom-conversation">
        <ConversationContent className="custom-content">
          <ConversationItem messageId="item-1" scrollAnchor>
            <div>Message 1</div>
          </ConversationItem>
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>,
    );

    const scrollerRoot = container.querySelector('[data-slot="message-scroller"]');
    const viewport = container.querySelector('[data-slot="message-scroller-viewport"]');
    const content = container.querySelector('[data-slot="message-scroller-content"]');
    const item = container.querySelector('[data-slot="message-scroller-item"]');

    expect(scrollerRoot).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(content).not.toBeNull();
    expect(item).not.toBeNull();

    expect(scrollerRoot?.classList.contains("custom-conversation")).toBe(true);
    expect(item?.getAttribute("data-scroll-anchor")).toBe("true");
    expect(item?.getAttribute("data-message-id")).toBe("item-1");
  });
});
