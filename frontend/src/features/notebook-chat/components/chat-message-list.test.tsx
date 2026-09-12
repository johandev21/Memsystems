import type { UIMessage } from "@ai-sdk/react";
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n/i18n";
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { ChatMessageList, type ChatMessageListProps } from "./chat-message-list";

// The list suspends on `useTranslation("chat")` until that namespace is
// loaded, and error copy is read from the `ai` namespace; preloading keeps
// the first render from suspending and the classifier copy resolvable.
beforeAll(async () => {
  await i18n.loadNamespaces(["chat", "ai"]);
});

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

type RenderOptions = Partial<
  Pick<ChatMessageListProps, "showPendingIndicator" | "pendingLabel" | "anchorMessageId" | "error">
>;

function buildChatTree(messages: UIMessage[], options: RenderOptions = {}) {
  return (
    <MessageScrollerProvider defaultScrollPosition="start">
      <MessageScroller>
        <MessageScrollerViewport>
          <MessageScrollerContent>
            <ChatMessageList
              messages={messages}
              citedSourcesMap={new Map()}
              showPendingIndicator={options.showPendingIndicator ?? false}
              pendingLabel={options.pendingLabel}
              anchorMessageId={options.anchorMessageId}
              error={options.error}
              onCopy={vi.fn()}
              onRegenerate={vi.fn()}
            />
          </MessageScrollerContent>
        </MessageScrollerViewport>
      </MessageScroller>
    </MessageScrollerProvider>
  );
}

function renderChatMessageList(messages: UIMessage[], options: RenderOptions = {}) {
  return render(buildChatTree(messages, options));
}

describe("ChatMessageList scroll anchoring", () => {
  it("offers general recovery guidance for capability errors", async () => {
    renderChatMessageList([userMessage("msg-user-1", "Search this")], {
      error: new Error("tool_choice did not match any supported type"),
    });

    expect(await screen.findByText("Web search isn't supported")).toBeTruthy();
    expect(screen.getByText(/a model that supports web search/)).toBeTruthy();
    expect(screen.queryByText(/GPT-4o Mini/)).toBeNull();
  });

  it("anchors the identified session message and not earlier turns", () => {
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

    const { container } = renderChatMessageList(messages, { anchorMessageId: "msg-user-4" });

    for (const id of ["msg-user-1", "msg-asst-1", "msg-user-2", "msg-asst-2", "msg-user-3", "msg-asst-3"]) {
      expect(container.querySelector(`[data-message-id="${id}"]`)?.getAttribute("data-scroll-anchor")).toBe("false");
    }

    expect(
      container.querySelector('[data-message-id="msg-user-4"]')?.getAttribute("data-scroll-anchor"),
    ).toBe("true");
    expect(
      container.querySelector('[data-message-id="msg-asst-4"]')?.getAttribute("data-scroll-anchor"),
    ).toBe("false");
  });

  it("does not anchor hydrated history when no session message exists", () => {
    const history: UIMessage[] = [
      userMessage("msg-user-1", "Old question 1"),
      assistantMessage("msg-asst-1", "Old answer 1"),
      userMessage("msg-user-2", "Latest old question"),
      assistantMessage("msg-asst-2", "Latest old answer"),
    ];

    const { container } = renderChatMessageList(history, { anchorMessageId: null });

    for (const id of ["msg-user-1", "msg-user-2", "msg-asst-2"]) {
      expect(container.querySelector(`[data-message-id="${id}"]`)?.getAttribute("data-scroll-anchor")).toBe("false");
    }
  });

  it("anchors the sole session user message", () => {
    const messages: UIMessage[] = [userMessage("msg-user-1", "Hello")];

    const { container } = renderChatMessageList(messages, {
      showPendingIndicator: true,
      anchorMessageId: "msg-user-1",
    });

    expect(
      container.querySelector('[data-message-id="msg-user-1"]')?.getAttribute("data-scroll-anchor"),
    ).toBe("true");
    expect(
      container.querySelector('[data-message-id="thinking-indicator"]')?.getAttribute("data-scroll-anchor"),
    ).toBe("false");
  });

  it("does not anchor hydrated history that loads asynchronously", () => {
    const { container, rerender } = renderChatMessageList([]);

    const loadedHistory: UIMessage[] = [
      userMessage("msg-user-1", "Old question 1"),
      assistantMessage("msg-asst-1", "Old answer 1"),
      userMessage("msg-user-2", "Old question 2"),
      assistantMessage("msg-asst-2", "Old answer 2"),
      userMessage("msg-user-3", "Latest question 3"),
      assistantMessage("msg-asst-3", "Latest answer 3"),
    ];

    rerender(buildChatTree(loadedHistory, { anchorMessageId: null }));

    for (const id of ["msg-user-1", "msg-user-2", "msg-user-3"]) {
      expect(container.querySelector(`[data-message-id="${id}"]`)?.getAttribute("data-scroll-anchor")).toBe("false");
    }
  });

  it("moves the anchor to a message sent this session", () => {
    const initialMessages: UIMessage[] = [
      userMessage("msg-user-1", "First question"),
      assistantMessage("msg-asst-1", "First answer"),
    ];

    const { container, rerender } = renderChatMessageList(initialMessages, {
      anchorMessageId: null,
    });

    expect(
      container.querySelector('[data-message-id="msg-user-1"]')?.getAttribute("data-scroll-anchor"),
    ).toBe("false");

    const updatedMessages: UIMessage[] = [
      ...initialMessages,
      userMessage("msg-user-2", "Second question"),
    ];

    rerender(
      buildChatTree(updatedMessages, {
        showPendingIndicator: true,
        anchorMessageId: "msg-user-2",
      }),
    );

    expect(
      container.querySelector('[data-message-id="msg-user-1"]')?.getAttribute("data-scroll-anchor"),
    ).toBe("false");
    expect(
      container.querySelector('[data-message-id="msg-user-2"]')?.getAttribute("data-scroll-anchor"),
    ).toBe("true");
    expect(
      container.querySelector('[data-message-id="thinking-indicator"]')?.getAttribute("data-scroll-anchor"),
    ).toBe("false");
  });

  it("groups multiple consecutive assistant responses into a single versioned turn", () => {
    const messages: UIMessage[] = [
      userMessage("msg-user-1", "What is on the image?"),
      assistantMessage("msg-asst-1", "Initial response"),
      assistantMessage("msg-asst-2", "Regenerated response"),
    ];

    const { container } = renderChatMessageList(messages);

    const userItems = container.querySelectorAll('[data-message-id="msg-user-1"]');
    const asstItems = container.querySelectorAll('[data-message-id="msg-asst-1"]');

    expect(userItems.length).toBe(1);
    expect(asstItems.length).toBe(1);

    expect(container.textContent).toContain("2 of 2");
    expect(container.textContent).toContain("Regenerated response");
  });
});

describe("ChatMessageList pending indicator", () => {
  it("renders the provided pending label with status semantics", () => {
    const { container } = renderChatMessageList([userMessage("msg-user-1", "Hello")], {
      showPendingIndicator: true,
      pendingLabel: "Thinking…",
    });

    const thinkingItem = container.querySelector('[data-message-id="thinking-indicator"]');
    expect(thinkingItem?.textContent).toContain("Thinking…");
    expect(thinkingItem?.querySelector('[role="status"]')).toBeTruthy();
  });

  it("renders the non-reasoning waiting copy instead of fake thinking", () => {
    const { container } = renderChatMessageList([userMessage("msg-user-1", "Hello")], {
      showPendingIndicator: true,
      pendingLabel: "Waiting for response…",
    });

    expect(container.textContent).toContain("Waiting for response…");
    expect(container.textContent).not.toContain("Thinking…");
  });

  it("hides the pending indicator once assistant content arrives", () => {
    const { container } = renderChatMessageList(
      [userMessage("msg-user-1", "Hello"), assistantMessage("msg-asst-1", "Hi")],
      { showPendingIndicator: false },
    );

    expect(container.querySelector('[data-message-id="thinking-indicator"]')).toBeNull();
  });
});
