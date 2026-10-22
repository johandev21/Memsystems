import { act, renderHook } from "@testing-library/react";
import type { UIMessage } from "@ai-sdk/react";
import type { RefObject } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import i18n from "@/shared/i18n/i18n";
import type { ChatMessageDTO } from "../api/chat";

// The hook suspends on `useTranslation("chat")` until that namespace is
// loaded; preloading keeps the first render from suspending.
beforeAll(async () => {
  await i18n.loadNamespaces("chat");
});

const mocks = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  stop: vi.fn(),
  setMessages: vi.fn(),
  clearError: vi.fn(),
  regenerate: vi.fn(),
  invalidateQueries: vi.fn(),
  refetchQueries: vi.fn(),
  setQueryData: vi.fn(),
  chatHistory: undefined as unknown,
  chatState: {
    messages: [] as unknown[],
    status: "ready",
  },
  useChatOptions: undefined as unknown,
  transportOptions: undefined as unknown,
  selectBranch: vi.fn(),
}));

vi.mock("../api/chat", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/chat")>();
  return { ...actual, selectChatBranch: mocks.selectBranch };
});

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    DefaultChatTransport: class {
      constructor(options: unknown) {
        mocks.transportOptions = options;
      }
    },
  };
});

vi.mock("@ai-sdk/react", () => ({
  useChat: (options: unknown) => {
    mocks.useChatOptions = options;
    return {
      messages: mocks.chatState.messages,
      sendMessage: mocks.sendMessage,
      regenerate: mocks.regenerate,
      setMessages: mocks.setMessages,
      clearError: mocks.clearError,
      status: mocks.chatState.status,
      stop: mocks.stop,
    };
  },
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (options: { queryKey?: readonly unknown[] }) => ({
      data: options.queryKey?.[0] === "chat" ? mocks.chatHistory : undefined,
      isPending: options.queryKey?.[0] === "chat" && mocks.chatHistory === undefined,
    }),
    useQueryClient: () => ({
      invalidateQueries: mocks.invalidateQueries,
      refetchQueries: mocks.refetchQueries,
      getQueryData: () => mocks.chatHistory,
      setQueryData: mocks.setQueryData,
    }),
    useMutation: (options: unknown) => ({
      isPending: false,
      mutate: vi.fn(),
      options,
    }),
  };
});

vi.mock("@/features/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/ai")>();
  return {
    ...actual,
    useConnectionStatus: () => ({ data: { ok: true } }),
    modelsQueryOptions: { queryKey: ["models"], queryFn: vi.fn() },
  };
});

vi.mock("@/features/notebooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/notebooks")>();
  return {
    ...actual,
    useModelPersistence: () => ({ model: null, setModel: vi.fn() }),
    notebookQueryOptions: vi.fn((id: string) => ({
      queryKey: ["notebooks", id],
      queryFn: vi.fn(),
    })),
  };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { formatChatMessages, useChatPanel } from "./use-chat-panel";

function createMessage(
  overrides: Partial<ChatMessageDTO> & Pick<ChatMessageDTO, "id">,
): ChatMessageDTO {
  return {
    id: overrides.id,
    role: overrides.role ?? "user",
    content: "content" in overrides ? (overrides.content as string) : "Hello",
    reasoning: overrides.reasoning ?? null,
    citedSourceIds: overrides.citedSourceIds ?? null,
    citedSources: overrides.citedSources ?? [],
    createdAt: overrides.createdAt ?? "2026-08-22T10:00:00.000Z",
    parentId: overrides.parentId,
    siblingIndex: overrides.siblingIndex,
    siblingCount: overrides.siblingCount,
    isOnSelectedPath: overrides.isOnSelectedPath,
    isSelected: overrides.isSelected,
  };
}

describe("formatChatMessages", () => {
  it("returns an empty array when history is undefined or empty", () => {
    expect(formatChatMessages(undefined)).toEqual([]);
    expect(formatChatMessages([])).toEqual([]);
  });

  it("formats valid user and assistant messages into UIMessage format", () => {
    const history: ChatMessageDTO[] = [
      createMessage({ id: "msg-1", role: "user", content: "What is quantum computing?" }),
      createMessage({ id: "msg-2", role: "assistant", content: "Quantum computing is..." }),
    ];

    const result = formatChatMessages(history);

    expect(result).toEqual([
      {
        id: "msg-1",
        role: "user",
        parts: [{ type: "text", text: "What is quantum computing?" }],
      },
      {
        id: "msg-2",
        role: "assistant",
        parts: [{ type: "text", text: "Quantum computing is..." }],
      },
    ]);
  });

  it("deduplicates messages with the same unique id", () => {
    const history: ChatMessageDTO[] = [
      createMessage({ id: "msg-1", role: "user", content: "Original user question" }),
      createMessage({ id: "msg-2", role: "assistant", content: "First answer" }),
      createMessage({ id: "msg-1", role: "user", content: "Duplicate user question" }),
      createMessage({ id: "msg-3", role: "user", content: "Follow-up question" }),
      createMessage({ id: "msg-2", role: "assistant", content: "Duplicate answer" }),
    ];

    const result = formatChatMessages(history);

    expect(result).toHaveLength(3);
    expect(result.map((m) => m.id)).toEqual(["msg-1", "msg-2", "msg-3"]);
    expect(result[0].parts[0]).toEqual({ type: "text", text: "Original user question" });
    expect(result[1].parts[0]).toEqual({ type: "text", text: "First answer" });
    expect(result[2].parts[0]).toEqual({ type: "text", text: "Follow-up question" });
  });

  it("skips messages without an id", () => {
    const history: ChatMessageDTO[] = [
      createMessage({ id: "", role: "user", content: "No id" }),
      createMessage({ id: "msg-valid", role: "user", content: "Valid message" }),
    ];

    const result = formatChatMessages(history);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("msg-valid");
  });

  it("restores reasoning parts when present in history", () => {
    const history: ChatMessageDTO[] = [
      createMessage({
        id: "msg-1",
        role: "assistant",
        content: "Final answer",
        reasoning: "Thinking step by step...",
      }),
    ];

    const result = formatChatMessages(history);

    expect(result).toHaveLength(1);
    expect(result[0].parts).toEqual([
      { type: "reasoning", text: "Thinking step by step..." },
      { type: "text", text: "Final answer" },
    ]);
  });

  it("preserves explicit multi-part messages including file attachments", () => {
    const history: ChatMessageDTO[] = [
      {
        id: "msg-img",
        role: "user",
        content: "Analyze this image",
        parts: [
          { type: "file", mediaType: "image/png", url: "data:image/png;base64,123" },
          { type: "text", text: "Analyze this image" },
        ],
        citedSourceIds: null,
        citedSources: [],
        createdAt: "2026-08-22T10:00:00.000Z",
      },
    ];

    const result = formatChatMessages(history);

    expect(result).toHaveLength(1);
    expect(result[0].parts).toEqual([
      { type: "file", mediaType: "image/png", url: "data:image/png;base64,123" },
      { type: "text", text: "Analyze this image" },
    ]);
  });

  it("preserves branch metadata on formatted messages", () => {
    const [result] = formatChatMessages([
      createMessage({
        id: "user-branch-2",
        parentId: "assistant-parent",
        siblingIndex: 1,
        siblingCount: 2,
        isOnSelectedPath: true,
        isSelected: true,
      }),
    ]);
    expect(result?.metadata).toMatchObject({
      parentId: "assistant-parent",
      siblingIndex: 1,
      siblingCount: 2,
      isOnSelectedPath: true,
      isSelected: true,
    });
  });
});

describe("useChatPanel send-chat-prompt handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chatHistory = undefined;
    mocks.chatState.messages = [];
    mocks.chatState.status = "ready";
    mocks.useChatOptions = undefined;
    mocks.transportOptions = undefined;
  });

  it("keeps a partial assistant message when streaming is stopped", async () => {
    const userMessage = createMessage({
      id: "user-1",
      role: "user",
      content: "Explain Plato's Republic",
    });
    const partialAssistantMessage = {
      id: "assistant-1",
      role: "assistant",
      parts: [{ type: "text", text: "Plato begins by asking what justice is..." }],
    };

    mocks.chatHistory = [userMessage];
    mocks.chatState.messages = [
      {
        id: userMessage.id,
        role: userMessage.role,
        parts: [{ type: "text", text: userMessage.content }],
      },
      partialAssistantMessage,
    ];
    mocks.chatState.status = "streaming";

    const { result, rerender } = renderHook(() => useChatPanel("notebook-1"));

    const onFinish = (
      mocks.useChatOptions as {
        onFinish: (event: {
          isAbort: boolean;
          isError: boolean;
          messages: typeof mocks.chatState.messages;
        }) => Promise<void>;
      }
    ).onFinish;

    act(() => {
      result.current.stop();
    });
    await act(() =>
      onFinish({
        isAbort: true,
        isError: false,
        messages: mocks.chatState.messages,
      }),
    );

    mocks.chatState.status = "ready";
    rerender();

    expect(mocks.setMessages).not.toHaveBeenCalledWith([
      {
        id: userMessage.id,
        role: userMessage.role,
        parts: [{ type: "text", text: userMessage.content }],
      },
    ]);
    expect(mocks.refetchQueries).toHaveBeenCalledWith({
      queryKey: ["chat", "notebook-1", "messages"],
    });
  });

  it("sends an auto prompt only from the visible responsive panel", () => {
    const visiblePanelRef = {
      current: { getClientRects: () => [{ width: 800 }] },
    } as unknown as RefObject<HTMLElement | null>;
    const hiddenPanelRef = {
      current: { getClientRects: () => [] },
    } as unknown as RefObject<HTMLElement | null>;

    renderHook(() => useChatPanel("notebook-1", visiblePanelRef));
    renderHook(() => useChatPanel("notebook-1", hiddenPanelRef));

    act(() => {
      window.dispatchEvent(
        new CustomEvent("send-chat-prompt", {
          detail: { prompt: "Explain this answer", autoSend: true },
        }),
      );
    });

    expect(mocks.sendMessage).toHaveBeenCalledTimes(1);
    expect(mocks.sendMessage).toHaveBeenCalledWith({ text: "Explain this answer" });
  });

  it("puts a study prompt in the visible composer without sending it", () => {
    const visiblePanelRef = {
      current: { getClientRects: () => [{ width: 800 }] },
    } as unknown as RefObject<HTMLElement | null>;

    const { result } = renderHook(() => useChatPanel("notebook-1", visiblePanelRef));

    act(() => {
      window.dispatchEvent(
        new CustomEvent("send-chat-prompt", {
          detail: { prompt: "Study this slide", autoSend: false, focusChat: true },
        }),
      );
    });

    expect(result.current.input).toBe("Study this slide");
    expect(mocks.sendMessage).not.toHaveBeenCalled();
  });

  it("sends the SDK last-user ID with edit intent and current selected sources", () => {
    const original = createMessage({ id: "user-original", role: "user", parentId: "assistant-parent" });
    const editedText = "Edited question";
    const { result } = renderHook(() => useChatPanel("notebook-1", undefined, ["source-7"]));

    act(() => result.current.handleEdit({
      id: original.id,
      role: "user",
      parts: [{ type: "text", text: original.content }],
      metadata: { parentId: original.parentId },
    }, editedText));

    const sdkMessage: UIMessage = {
      id: "sdk-created-user-id",
      role: "user",
      parts: [{ type: "text", text: editedText }],
    };
    const transport = mocks.transportOptions as {
      prepareSendMessagesRequest: (arg: { messages: UIMessage[] }) => { body: Record<string, unknown> };
    };
    const { body } = transport.prepareSendMessagesRequest({ messages: [sdkMessage] });

    expect((body.message as { id: string }).id).toBe("sdk-created-user-id");
    expect((body.messages as Array<{ id: string }>)[0].id).toBe("sdk-created-user-id");
    expect(body.editMessageId).toBe("user-original");
    expect(body.parentMessageId).toBe("assistant-parent");
    expect(body.sourceIds).toEqual(["source-7"]);
  });

  it("uses the newest SDK assistant endpoint when sending before history refetch lands", () => {
    const staleUser = createMessage({ id: "old-user", role: "user" });
    const staleAssistant = createMessage({ id: "old-assistant", role: "assistant" });
    mocks.chatHistory = {
      messages: [staleUser, staleAssistant],
      selectedMessageId: staleAssistant.id,
      selectedPathIds: [staleUser.id, staleAssistant.id],
    };
    mocks.chatState.messages = [
      { id: staleUser.id, role: "user", parts: [{ type: "text", text: "old prompt" }] },
      { id: "new-assistant", role: "assistant", parts: [{ type: "text", text: "just finished" }] },
    ];
    const { result } = renderHook(() => useChatPanel("notebook-1"));

    act(() => result.current.handleSubmit("continue immediately"));
    const transport = mocks.transportOptions as {
      prepareSendMessagesRequest: (arg: { messages: UIMessage[] }) => { body: Record<string, unknown> };
    };
    const { body } = transport.prepareSendMessagesRequest({ messages: [{
      id: "next-user",
      role: "user",
      parts: [{ type: "text", text: "continue immediately" }],
    }] });

    expect(body.parentMessageId).toBe("new-assistant");
    expect(body.parentMessageId).not.toBe(staleAssistant.id);
  });

  it("keeps a stopped or failed user turn as the continuation endpoint", () => {
    const previousAssistant = createMessage({ id: "previous-assistant", role: "assistant" });
    const failedUser = createMessage({ id: "failed-user", role: "user", parentId: previousAssistant.id });
    mocks.chatHistory = {
      messages: [previousAssistant, failedUser],
      selectedMessageId: failedUser.id,
      selectedPathIds: [previousAssistant.id, failedUser.id],
    };
    mocks.chatState.messages = [
      { id: previousAssistant.id, role: "assistant", parts: [{ type: "text", text: "answer" }] },
      { id: failedUser.id, role: "user", parts: [{ type: "text", text: "failed" }] },
    ];
    const { result } = renderHook(() => useChatPanel("notebook-1"));

    act(() => result.current.handleSubmit("continue after failure"));
    const transport = mocks.transportOptions as {
      prepareSendMessagesRequest: (arg: { messages: UIMessage[] }) => { body: Record<string, unknown> };
    };
    const { body } = transport.prepareSendMessagesRequest({ messages: [{
      id: "next-user", role: "user", parts: [{ type: "text", text: "continue after failure" }],
    }] });

    expect(body.parentMessageId).toBe("failed-user");
  });

  it("retries a failed fresh chat with the original root intent, not the optimistic user's ID", () => {
    const { result } = renderHook(() => useChatPanel("notebook-1"));
    act(() => result.current.handleSubmit("Who was Plato?"));
    const optimisticUser: UIMessage = {
      id: "optimistic-user",
      role: "user",
      parts: [{ type: "text", text: "Who was Plato?" }],
    };
    const transport = mocks.transportOptions as {
      prepareSendMessagesRequest: (arg: { messages: UIMessage[] }) => { body: Record<string, unknown> };
    };
    const initial = transport.prepareSendMessagesRequest({ messages: [optimisticUser] }).body;
    expect(initial.parentMessageId).toBeNull();

    mocks.chatState.messages = [optimisticUser];
    act(() => result.current.handleRegenerate());
    const retry = transport.prepareSendMessagesRequest({ messages: [optimisticUser] }).body;
    expect(retry.parentMessageId).toBeNull();
    expect((retry.message as { id: string }).id).toBe("optimistic-user");
    expect(retry.parentMessageId).not.toBe("optimistic-user");
  });

  it("retries a persisted failed user turn from its actual ancestor", () => {
    const user = createMessage({ id: "persisted-user", parentId: "assistant-parent" });
    mocks.chatHistory = {
      messages: [user],
      selectedMessageId: user.id,
      selectedPathIds: [user.id],
    };
    const optimisticUser: UIMessage = {
      id: user.id,
      role: "user",
      parts: [
        { type: "file", mediaType: "image/png", url: "data:image/png;base64,aGVsbG8=", filename: "notes.png" },
        { type: "text", text: "Who was Plato?" },
      ],
    };
    mocks.chatState.messages = [optimisticUser];
    const { result } = renderHook(() => useChatPanel("notebook-1"));
    act(() => result.current.handleRegenerate());

    const transport = mocks.transportOptions as {
      prepareSendMessagesRequest: (arg: { messages: UIMessage[] }) => { body: Record<string, unknown> };
    };
    const body = transport.prepareSendMessagesRequest({ messages: [optimisticUser] }).body;
    expect(body.parentMessageId).toBe("assistant-parent");
    expect(body.parentMessageId).not.toBe("persisted-user");
    expect((body.message as UIMessage).id).toBe("persisted-user");
    expect((body.message as UIMessage).parts).toEqual(optimisticUser.parts);
  });

  it("keeps an explicit root selection when sending immediately after clear", async () => {
    const { result } = renderHook(() => useChatPanel("notebook-1"));
    const mutation = result.current.clearHistoryMutation as unknown as {
      options: { onSuccess: () => void };
    };
    await act(async () => mutation.options.onSuccess());

    act(() => result.current.handleSubmit("start over"));
    const transport = mocks.transportOptions as {
      prepareSendMessagesRequest: (arg: { messages: UIMessage[] }) => { body: Record<string, unknown> };
    };
    const { body } = transport.prepareSendMessagesRequest({ messages: [{
      id: "fresh-user",
      role: "user",
      parts: [{ type: "text", text: "start over" }],
    }] });
    expect(body.parentMessageId).toBeNull();
  });
});

describe("useChatPanel initial anchor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chatHistory = undefined;
    mocks.chatState.messages = [];
    mocks.chatState.status = "ready";
    mocks.useChatOptions = undefined;
  });

  it("reports history pending and no anchor until the first result", () => {
    const { result } = renderHook(() => useChatPanel("notebook-1"));

    expect(result.current.isHistoryPending).toBe(true);
    expect(result.current.anchorMessageId).toBeNull();
  });

  it("does not anchor user messages hydrated from persisted history", () => {
    const history: ChatMessageDTO[] = [
      createMessage({ id: "user-1", role: "user", content: "Old question" }),
      createMessage({ id: "asst-1", role: "assistant", content: "Old answer" }),
    ];
    mocks.chatHistory = history;
    mocks.chatState.messages = history.map((message) => ({
      id: message.id,
      role: message.role,
      parts: [{ type: "text", text: message.content }],
    }));

    const { result } = renderHook(() => useChatPanel("notebook-1"));

    expect(result.current.isHistoryPending).toBe(false);
    expect(result.current.anchorMessageId).toBeNull();
  });

  it("anchors the latest user message sent during this session", () => {
    mocks.chatHistory = [createMessage({ id: "user-1", role: "user", content: "Old question" })];
    mocks.chatState.messages = [
      { id: "user-1", role: "user", parts: [{ type: "text", text: "Old question" }] },
      { id: "user-2", role: "user", parts: [{ type: "text", text: "New question" }] },
    ];

    const { result } = renderHook(() => useChatPanel("notebook-1"));

    expect(result.current.anchorMessageId).toBe("user-2");
  });

  it("clears the anchor when clearAnchor is called", () => {
    mocks.chatHistory = [createMessage({ id: "user-1", role: "user", content: "Old question" })];
    mocks.chatState.messages = [
      { id: "user-1", role: "user", parts: [{ type: "text", text: "Old question" }] },
      { id: "user-2", role: "user", parts: [{ type: "text", text: "New question" }] },
    ];

    const { result } = renderHook(() => useChatPanel("notebook-1"));

    expect(result.current.anchorMessageId).toBe("user-2");

    act(() => {
      result.current.clearAnchor();
    });

    expect(result.current.anchorMessageId).toBeNull();
  });

  it("re-anchors when a new user message arrives after clearing", () => {
    mocks.chatHistory = [createMessage({ id: "user-1", role: "user", content: "Old question" })];
    mocks.chatState.messages = [
      { id: "user-1", role: "user", parts: [{ type: "text", text: "Old question" }] },
      { id: "user-2", role: "user", parts: [{ type: "text", text: "New question" }] },
    ];

    const { result, rerender } = renderHook(() => useChatPanel("notebook-1"));

    expect(result.current.anchorMessageId).toBe("user-2");

    act(() => {
      result.current.clearAnchor();
    });

    expect(result.current.anchorMessageId).toBeNull();

    mocks.chatState.messages = [
      ...mocks.chatState.messages,
      { id: "user-3", role: "user", parts: [{ type: "text", text: "Third question" }] },
    ];

    rerender();

    expect(result.current.anchorMessageId).toBe("user-3");
  });

  it("preserves anchor on active user message even after chatHistory refetches with that message", () => {
    // Initial mount with user-1 in history
    mocks.chatHistory = [createMessage({ id: "user-1", role: "user", content: "Old question" })];
    mocks.chatState.messages = [
      { id: "user-1", role: "user", parts: [{ type: "text", text: "Old question" }] },
      { id: "user-2", role: "user", parts: [{ type: "text", text: "Active question" }] },
    ];

    const { result, rerender } = renderHook(() => useChatPanel("notebook-1"));
    expect(result.current.anchorMessageId).toBe("user-2");

    // LLM completes, and refetchQueries returns history that now includes user-2
    mocks.chatHistory = [
      createMessage({ id: "user-1", role: "user", content: "Old question" }),
      createMessage({ id: "user-2", role: "user", content: "Active question" }),
      createMessage({ id: "asst-2", role: "assistant", content: "Answer to active question" }),
    ];

    rerender();

    // The anchor MUST NOT be dropped abruptly upon history arrival!
    expect(result.current.anchorMessageId).toBe("user-2");
  });

  it("restores only the persisted selected path from the history envelope", () => {
    const history = [
      createMessage({ id: "user-root", role: "user" }),
      createMessage({ id: "assistant-root", role: "assistant" }),
      createMessage({ id: "user-selected", role: "user", parentId: "assistant-root" }),
      createMessage({ id: "user-sibling", role: "user", parentId: "assistant-root" }),
    ];
    mocks.chatHistory = {
      messages: history,
      selectedMessageId: "user-selected",
      selectedPathIds: ["user-root", "assistant-root", "user-selected"],
    };

    renderHook(() => useChatPanel("notebook-1"));
    const options = mocks.useChatOptions as { messages: UIMessage[] };
    expect(options.messages.map((message) => message.id)).toEqual([
      "user-root",
      "assistant-root",
      "user-selected",
    ]);
  });

  it("hydrates the newly selected branch when history reuses the same messages array", () => {
    const messages = [
      createMessage({ id: "user-root", role: "user" }),
      createMessage({ id: "assistant-a", role: "assistant", content: "Answer A" }),
      createMessage({ id: "user-a", role: "user", parentId: "assistant-a" }),
      createMessage({ id: "assistant-b", role: "assistant", content: "Answer B" }),
      createMessage({ id: "user-b", role: "user", parentId: "assistant-b" }),
    ];
    mocks.chatHistory = {
      messages,
      selectedMessageId: "assistant-a",
      selectedPathIds: ["user-root", "assistant-a", "user-a"],
    };
    const { rerender } = renderHook(() => useChatPanel("notebook-1"));
    mocks.setMessages.mockClear();

    // TanStack Query may retain the unchanged messages array while replacing
    // only the selected pointer/path in the history envelope. Exercise round
    // trips to prove both persisted assistant replies are restored each time.
    for (const [assistantId, userId] of [
      ["assistant-b", "user-b"],
      ["assistant-a", "user-a"],
      ["assistant-b", "user-b"],
    ]) {
      mocks.chatHistory = {
        messages,
        selectedMessageId: assistantId,
        selectedPathIds: ["user-root", assistantId, userId],
      };
      rerender();
      expect(mocks.setMessages).toHaveBeenLastCalledWith([
        expect.objectContaining({ id: "user-root" }),
        expect.objectContaining({
          id: assistantId,
          parts: [{ type: "text", text: assistantId === "assistant-a" ? "Answer A" : "Answer B" }],
        }),
        expect.objectContaining({ id: userId }),
      ]);
    }
  });
});

describe("useChatPanel clipboard feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chatHistory = undefined;
    mocks.chatState.messages = [];
    mocks.chatState.status = "ready";
  });

  it("reports success only after the clipboard write completes", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const { result } = renderHook(() => useChatPanel("notebook-1"));

    await act(async () => {
      expect(await result.current.handleCopy("**Markdown**")).toBe(true);
    });

    expect(writeText).toHaveBeenCalledWith("**Markdown**");
    expect(toast.success).toHaveBeenCalledWith("Copied to clipboard");
  });

  it("reports clipboard failures without a success result", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    const { result } = renderHook(() => useChatPanel("notebook-1"));

    await act(async () => {
      expect(await result.current.handleCopy("Question")).toBe(false);
    });

    expect(toast.error).toHaveBeenCalledWith("Couldn't copy to clipboard");
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("useChatPanel branch selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chatState.messages = [];
    mocks.chatState.status = "ready";
    mocks.regenerate.mockReset();
    mocks.chatHistory = {
      messages: [
        createMessage({ id: "user-root", role: "user" }),
        createMessage({ id: "assistant-old", role: "assistant" }),
        createMessage({ id: "user-old", role: "user", parentId: "assistant-old" }),
        createMessage({ id: "assistant-new", role: "assistant" }),
        createMessage({ id: "user-new", role: "user", parentId: "assistant-new" }),
      ],
      selectedMessageId: "assistant-old",
      selectedPathIds: ["user-root", "assistant-old", "user-old"],
    };
    mocks.selectBranch.mockResolvedValue(undefined);
    mocks.refetchQueries.mockResolvedValue(undefined);
  });

  it("blocks submit, edit, and regenerate until a delayed selection settles", async () => {
    let resolveSelection!: () => void;
    mocks.selectBranch.mockImplementation(() => new Promise<void>((resolve) => { resolveSelection = resolve; }));
    const { result } = renderHook(() => useChatPanel("notebook-1"));
    const oldUser = {
      id: "user-old",
      role: "user" as const,
      parts: [{ type: "text" as const, text: "Hello" }],
    };

    let selection!: Promise<void>;
    act(() => { selection = result.current.handleSelectBranch("assistant-new"); });
    expect(result.current.isBranchSelectionPending).toBe(true);
    act(() => {
      result.current.handleSubmit("too soon");
      result.current.handleEdit(oldUser, "edited too soon");
      result.current.handleRegenerate("assistant-old");
      window.dispatchEvent(new CustomEvent("send-chat-prompt", {
        detail: { prompt: "queued prompt", autoSend: true },
      }));
    });
    expect(mocks.sendMessage).not.toHaveBeenCalled();
    expect(mocks.regenerate).not.toHaveBeenCalled();

    await act(async () => {
      resolveSelection();
      await selection;
    });
    expect(result.current.isBranchSelectionPending).toBe(false);
  });

  it("prunes the edited message and every descendant before sending the edited branch", () => {
    const activeTranscript: UIMessage[] = [
      { id: "root", role: "user", parts: [{ type: "text", text: "root" }] },
      { id: "root-answer", role: "assistant", parts: [{ type: "text", text: "answer" }] },
      { id: "middle", role: "user", parts: [{ type: "text", text: "middle" }] },
      { id: "middle-answer", role: "assistant", parts: [{ type: "text", text: "answer" }] },
      { id: "leaf", role: "user", parts: [{ type: "text", text: "leaf" }] },
      { id: "leaf-answer", role: "assistant", parts: [{ type: "text", text: "answer" }] },
    ];
    mocks.chatState.messages = activeTranscript;
    const { result } = renderHook(() => useChatPanel("notebook-1"));
    mocks.setMessages.mockClear();

    act(() => result.current.handleEdit(activeTranscript[2], "edited middle"));

    expect(mocks.setMessages).toHaveBeenCalledWith(activeTranscript.slice(0, 2));
    expect(mocks.sendMessage).toHaveBeenCalledWith({
      role: "user",
      parts: [{ type: "text", text: "edited middle" }],
    });
  });

  it("prunes descendants again when editing the returned edited branch", () => {
    const root: UIMessage = { id: "root", role: "user", parts: [{ type: "text", text: "root" }] };
    const rootAnswer: UIMessage = { id: "root-answer", role: "assistant", parts: [{ type: "text", text: "answer" }] };
    const firstEdit: UIMessage = { id: "first-edit", role: "user", parts: [{ type: "text", text: "first edit" }] };
    const firstAnswer: UIMessage = { id: "first-answer", role: "assistant", parts: [{ type: "text", text: "answer" }] };
    const oldLeaf: UIMessage = { id: "old-leaf", role: "user", parts: [{ type: "text", text: "old leaf" }] };
    const activeTranscript = [root, rootAnswer, firstEdit, firstAnswer, oldLeaf];
    mocks.chatState.messages = activeTranscript;
    const { result } = renderHook(() => useChatPanel("notebook-1"));
    mocks.setMessages.mockClear();

    act(() => result.current.handleEdit(firstEdit, "second edit"));

    expect(mocks.setMessages).toHaveBeenCalledWith([root, rootAnswer]);
    expect(mocks.sendMessage).toHaveBeenCalledWith({
      role: "user",
      parts: [{ type: "text", text: "second edit" }],
    });
  });

  it("uses the newly selected message as the next request parent before query hydration rerenders", async () => {
    let resolveSelection!: () => void;
    mocks.selectBranch.mockImplementation(() => new Promise<void>((resolve) => { resolveSelection = resolve; }));
    const { result } = renderHook(() => useChatPanel("notebook-1"));
    let selection!: Promise<void>;
    act(() => { selection = result.current.handleSelectBranch("assistant-new"); });
    await act(async () => {
      resolveSelection();
      await selection;
    });

    act(() => result.current.handleSubmit("continue from new branch"));
    const transport = mocks.transportOptions as {
      prepareSendMessagesRequest: (arg: { messages: UIMessage[] }) => { body: Record<string, unknown> };
    };
    const { body } = transport.prepareSendMessagesRequest({ messages: [{
      id: "sdk-user",
      role: "user",
      parts: [{ type: "text", text: "continue from new branch" }],
    }] });
    expect(body.parentMessageId).toBe("assistant-new");
    expect(mocks.sendMessage).toHaveBeenCalledWith({ text: "continue from new branch" });
  });

  it("uses the server-resolved assistant endpoint when selecting a user branch", async () => {
    mocks.selectBranch.mockResolvedValue({ selectedMessageId: "assistant-new" });
    const { result } = renderHook(() => useChatPanel("notebook-1"));

    await act(async () => { await result.current.handleSelectBranch("user-new"); });
    act(() => result.current.handleSubmit("continue after restored answer"));

    const transport = mocks.transportOptions as {
      prepareSendMessagesRequest: (arg: { messages: UIMessage[] }) => { body: Record<string, unknown> };
    };
    const { body } = transport.prepareSendMessagesRequest({ messages: [{
      id: "sdk-user",
      role: "user",
      parts: [{ type: "text", text: "continue after restored answer" }],
    }] });
    expect(body.parentMessageId).toBe("assistant-new");
  });

  it("ignores stale history arriving before the selected branch history", async () => {
    mocks.selectBranch.mockResolvedValue({ selectedMessageId: "assistant-new" });
    const { result, rerender } = renderHook(() => useChatPanel("notebook-1"));
    await act(async () => { await result.current.handleSelectBranch("assistant-new"); });
    expect(mocks.setMessages).toHaveBeenCalledWith([
      expect.objectContaining({ id: "assistant-new" }),
    ]);
    mocks.setMessages.mockClear();
    const originalHistory = mocks.chatHistory as {
      messages: ChatMessageDTO[];
      selectedMessageId: string;
      selectedPathIds: string[];
    };
    mocks.chatHistory = {
      ...originalHistory,
      messages: [...originalHistory.messages],
      selectedMessageId: "assistant-old",
      selectedPathIds: ["user-root", "assistant-old", "user-old"],
    };
    rerender();
    expect(mocks.setMessages).not.toHaveBeenCalled();

    mocks.chatHistory = {
      ...originalHistory,
      messages: [...originalHistory.messages],
      selectedMessageId: "assistant-new",
      selectedPathIds: ["user-root", "assistant-new", "user-new"],
    };
    rerender();

    const hydrated = mocks.setMessages.mock.calls.at(-1)?.[0] as UIMessage[];
    expect(hydrated.map((message) => message.id)).toEqual([
      "user-root", "assistant-new", "user-new",
    ]);
  });

  it("tracks the latest endpoint across repeated nested A/B branch switches", async () => {
    mocks.selectBranch
      .mockResolvedValueOnce({ selectedMessageId: "assistant-new" })
      .mockResolvedValueOnce({ selectedMessageId: "assistant-old" })
      .mockResolvedValueOnce({ selectedMessageId: "assistant-new" })
      .mockResolvedValueOnce({ selectedMessageId: "assistant-old" });
    const { result } = renderHook(() => useChatPanel("notebook-1"));

    for (const branchId of ["assistant-new", "assistant-old", "assistant-new", "assistant-old"]) {
      await act(async () => { await result.current.handleSelectBranch(branchId); });
    }
    act(() => result.current.handleSubmit("continue after nested switches"));

    const transport = mocks.transportOptions as {
      prepareSendMessagesRequest: (arg: { messages: UIMessage[] }) => { body: Record<string, unknown> };
    };
    const { body } = transport.prepareSendMessagesRequest({ messages: [{
      id: "next-user", role: "user", parts: [{ type: "text", text: "continue" }],
    }] });
    expect(mocks.selectBranch).toHaveBeenCalledTimes(4);
    expect(body.parentMessageId).toBe("assistant-old");
  });

  it("hydrates an alternate branch after stopping a partial response", async () => {
    const partial: UIMessage[] = [
      { id: "root", role: "user", parts: [{ type: "text", text: "root" }] },
      { id: "partial-answer", role: "assistant", parts: [{ type: "text", text: "partial" }] },
    ];
    mocks.chatState.messages = partial;
    mocks.chatState.status = "streaming";
    const { result, rerender } = renderHook(() => useChatPanel("notebook-1"));
    const sdk = mocks.useChatOptions as {
      onFinish: (args: { isAbort: boolean; messages: UIMessage[] }) => Promise<void>;
    };
    await act(async () => sdk.onFinish({ isAbort: true, messages: partial }));
    mocks.chatState.status = "ready";
    rerender();

    await act(async () => { await result.current.handleSelectBranch("assistant-new"); });
    const alternateHistory = {
      messages: mocks.chatHistory && !Array.isArray(mocks.chatHistory)
        ? (mocks.chatHistory as { messages: ChatMessageDTO[] }).messages
        : [],
      selectedMessageId: "assistant-new",
      selectedPathIds: ["user-root", "assistant-new", "user-new"],
    };
    mocks.chatHistory = alternateHistory;
    rerender();

    const latestSetMessages = mocks.setMessages.mock.calls.at(-1)?.[0] as UIMessage[];
    expect(latestSetMessages.map((message) => message.id)).toEqual(alternateHistory.selectedPathIds);
  });

  it("regenerates the requested earlier assistant message through the SDK API", () => {
    const { result } = renderHook(() => useChatPanel("notebook-1"));
    act(() => result.current.handleRegenerate("assistant-old"));
    expect(mocks.regenerate).toHaveBeenCalledWith({ messageId: "assistant-old" });

    const transport = mocks.transportOptions as {
      prepareSendMessagesRequest: (arg: { messages: UIMessage[] }) => { body: Record<string, unknown> };
    };
    const { body } = transport.prepareSendMessagesRequest({ messages: [{
      id: "sdk-user", role: "user", parts: [{ type: "text", text: "question" }],
    }] });
    expect(body.regenerateMessageId).toBe("assistant-old");
    expect(body.editMessageId).toBeUndefined();
  });

  it("clears the pending guard after a rejected selection and leaves later mutations usable", async () => {
    mocks.selectBranch.mockRejectedValueOnce(new Error("selection failed"));
    const { result } = renderHook(() => useChatPanel("notebook-1"));
    await act(async () => { await result.current.handleSelectBranch("assistant-new"); });
    expect(result.current.isBranchSelectionPending).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("Couldn't switch to that conversation branch");

    act(() => result.current.handleSubmit("continue on current branch"));
    expect(mocks.sendMessage).toHaveBeenCalledWith({ text: "continue on current branch" });
    const transport = mocks.transportOptions as {
      prepareSendMessagesRequest: (arg: { messages: UIMessage[] }) => { body: Record<string, unknown> };
    };
    const { body } = transport.prepareSendMessagesRequest({ messages: [{
      id: "sdk-user", role: "user", parts: [{ type: "text", text: "retry" }],
    }] });
    expect(body.parentMessageId).toBe("assistant-old");
  });

  it("keeps requests on the selected branch when the selection refetch fails", async () => {
    mocks.refetchQueries.mockRejectedValueOnce(new Error("history unavailable"));
    const { result } = renderHook(() => useChatPanel("notebook-1"));

    await act(async () => { await result.current.handleSelectBranch("assistant-new"); });
    expect(result.current.isBranchSelectionPending).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("Couldn't switch to that conversation branch");

    act(() => result.current.handleSubmit("continue despite stale history"));
    const transport = mocks.transportOptions as {
      prepareSendMessagesRequest: (arg: { messages: UIMessage[] }) => { body: Record<string, unknown> };
    };
    const { body } = transport.prepareSendMessagesRequest({ messages: [{
      id: "sdk-user", role: "user", parts: [{ type: "text", text: "continue despite stale history" }],
    }] });
    expect(body.parentMessageId).toBe("assistant-new");
  });

  it("restores the switched row's viewport position when earlier versions have different geometry", async () => {
    const viewport = document.createElement("div");
    viewport.dataset.slot = "message-scroller-viewport";
    viewport.scrollTop = 350;
    const row = document.createElement("div");
    row.dataset.messageId = "assistant-new";
    document.body.append(viewport);
    viewport.append(row);
    let top = 110;
    mocks.refetchQueries.mockImplementation(() => {
      top = 245;
      return Promise.resolve();
    });
    vi.spyOn(row, "getBoundingClientRect").mockImplementation(() => ({
      top, bottom: top + 80, left: 0, right: 500, width: 500, height: 80, x: 0, y: top, toJSON: () => ({}),
    }));
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
    const { result } = renderHook(() => useChatPanel("notebook-1"));
    await act(async () => { await result.current.handleSelectBranch("assistant-new"); });
    // The clicked earlier version moved by 135px; a distant final endpoint would
    // have a different delta and must not drive this correction.
    await act(async () => { await Promise.resolve(); });
    expect(viewport.scrollTop).toBe(485);
    viewport.remove();
    vi.unstubAllGlobals();
  });
});
