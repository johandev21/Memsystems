import type { UIMessage } from "@ai-sdk/react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { ChatMessageList } from "./chat-message-list";

function userMessage(id: string, text: string): UIMessage {
  return {
    id,
    role: "user",
    parts: [{ type: "text", text }],
  };
}

function assistantMessage(id: string, text: string): UIMessage {
  return {
    id,
    role: "assistant",
    parts: [{ type: "text", text }],
  };
}

function renderChatMessageList(messages: UIMessage[], isThinking = false) {
  return render(
    <MessageScrollerProvider defaultScrollPosition="last-anchor">
      <MessageScroller>
        <MessageScrollerViewport>
          <MessageScrollerContent>
            <ChatMessageList
              messages={messages}
              citedSourcesMap={new Map()}
              isThinking={isThinking}
              onCopy={vi.fn()}
              onRegenerate={vi.fn()}
            />
          </MessageScrollerContent>
        </MessageScrollerViewport>
      </MessageScroller>
    </MessageScrollerProvider>,
  );
}

describe("ChatMessageList scroll anchoring", () => {
  it("anchors only the latest user message in a 4-turn conversation, ensuring earlier turns are not anchors", () => {
    const messages: UIMessage[] = [
      userMessage("msg-user-1", "Turn 1 question"),
      assistantMessage("msg-asst-1", "Turn 1 answer"),
      userMessage("msg-user-2", "Turn 2 question"),
      assistantMessage("msg-asst-2", "Turn 2 answer"),
      userMessage("msg-user-3", "Turn 3 question"),
      assistantMessage("msg-asst-3", "Turn 3 answer"),
      userMessage("msg-user-4", "Turn 4 question"),
      assistantMessage("msg-asst-4", "Turn 4 answer"),
    ];

    const { container } = renderChatMessageList(messages);

    const user1 = container.querySelector('[data-message-id="msg-user-1"]');
    const asst1 = container.querySelector('[data-message-id="msg-asst-1"]');
    const user2 = container.querySelector('[data-message-id="msg-user-2"]');
    const asst2 = container.querySelector('[data-message-id="msg-asst-2"]');
    const user3 = container.querySelector('[data-message-id="msg-user-3"]');
    const asst3 = container.querySelector('[data-message-id="msg-asst-3"]');
    const user4 = container.querySelector('[data-message-id="msg-user-4"]');
    const asst4 = container.querySelector('[data-message-id="msg-asst-4"]');

    // All previous turns must NOT be anchors so the scroller does NOT scroll to them
    expect(user1?.getAttribute("data-scroll-anchor")).toBe("false");
    expect(asst1?.getAttribute("data-scroll-anchor")).toBe("false");
    expect(user2?.getAttribute("data-scroll-anchor")).toBe("false");
    expect(asst2?.getAttribute("data-scroll-anchor")).toBe("false");
    expect(user3?.getAttribute("data-scroll-anchor")).toBe("false");
    expect(asst3?.getAttribute("data-scroll-anchor")).toBe("false");

    // Only the true latest user anchor (Turn 4) must be an anchor
    expect(user4?.getAttribute("data-scroll-anchor")).toBe("true");
    expect(asst4?.getAttribute("data-scroll-anchor")).toBe("false");
  });

  it("anchors the sole user message in a single-turn conversation", () => {
    const messages: UIMessage[] = [userMessage("msg-user-1", "Hello")];

    const { container } = renderChatMessageList(messages, true);

    const user1Item = container.querySelector('[data-message-id="msg-user-1"]');
    const thinkingItem = container.querySelector('[data-message-id="thinking-indicator"]');

    expect(user1Item?.getAttribute("data-scroll-anchor")).toBe("true");
    expect(thinkingItem?.getAttribute("data-scroll-anchor")).toBe("false");
  });

  it("handles async history loading: transitions from empty to multi-turn and marks only the final user turn as anchor", () => {
    const { container, rerender } = renderChatMessageList([]);

    const loadedHistory: UIMessage[] = [
      userMessage("msg-user-1", "Old question 1"),
      assistantMessage("msg-asst-1", "Old answer 1"),
      userMessage("msg-user-2", "Old question 2"),
      assistantMessage("msg-asst-2", "Old answer 2"),
      userMessage("msg-user-3", "Latest question 3"),
      assistantMessage("msg-asst-3", "Latest answer 3"),
    ];

    rerender(
      <MessageScrollerProvider defaultScrollPosition="last-anchor">
        <MessageScroller>
          <MessageScrollerViewport>
            <MessageScrollerContent>
              <ChatMessageList
                messages={loadedHistory}
                citedSourcesMap={new Map()}
                isThinking={false}
                onCopy={vi.fn()}
                onRegenerate={vi.fn()}
              />
            </MessageScrollerContent>
          </MessageScrollerViewport>
        </MessageScroller>
      </MessageScrollerProvider>,
    );

    const user1 = container.querySelector('[data-message-id="msg-user-1"]');
    const user2 = container.querySelector('[data-message-id="msg-user-2"]');
    const user3 = container.querySelector('[data-message-id="msg-user-3"]');

    expect(user1?.getAttribute("data-scroll-anchor")).toBe("false");
    expect(user2?.getAttribute("data-scroll-anchor")).toBe("false");
    expect(user3?.getAttribute("data-scroll-anchor")).toBe("true");
  });

  it("updates anchor to the newly added user message when messages update", () => {
    const initialMessages: UIMessage[] = [
      userMessage("msg-user-1", "First question"),
      assistantMessage("msg-asst-1", "First answer"),
    ];

    const { container, rerender } = renderChatMessageList(initialMessages);

    let user1Item = container.querySelector('[data-message-id="msg-user-1"]');
    expect(user1Item?.getAttribute("data-scroll-anchor")).toBe("true");

    const updatedMessages: UIMessage[] = [
      ...initialMessages,
      userMessage("msg-user-2", "Second question"),
    ];

    rerender(
      <MessageScrollerProvider defaultScrollPosition="last-anchor">
        <MessageScroller>
          <MessageScrollerViewport>
            <MessageScrollerContent>
              <ChatMessageList
                messages={updatedMessages}
                citedSourcesMap={new Map()}
                isThinking={true}
                onCopy={vi.fn()}
                onRegenerate={vi.fn()}
              />
            </MessageScrollerContent>
          </MessageScrollerViewport>
        </MessageScroller>
      </MessageScrollerProvider>,
    );

    user1Item = container.querySelector('[data-message-id="msg-user-1"]');
    const user2Item = container.querySelector('[data-message-id="msg-user-2"]');
    const thinkingItem = container.querySelector('[data-message-id="thinking-indicator"]');

    // After adding turn 2, turn 1 must no longer anchor, and turn 2 must anchor
    expect(user1Item?.getAttribute("data-scroll-anchor")).toBe("false");
    expect(user2Item?.getAttribute("data-scroll-anchor")).toBe("true");
    expect(thinkingItem?.getAttribute("data-scroll-anchor")).toBe("false");
  });
});
