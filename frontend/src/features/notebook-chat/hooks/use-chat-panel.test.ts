import { act, renderHook } from "@testing-library/react";
import type { RefObject } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessageDTO } from "../api/chat";

const mocks = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  stop: vi.fn(),
  setMessages: vi.fn(),
  invalidateQueries: vi.fn(),
  refetchQueries: vi.fn(),
  setQueryData: vi.fn(),
  chatHistory: undefined as unknown,
  chatState: {
    messages: [] as unknown[],
    status: "ready",
  },
  useChatOptions: undefined as unknown,
}));

vi.mock("@ai-sdk/react", () => ({
  useChat: (options: unknown) => {
    mocks.useChatOptions = options;
    return {
      messages: mocks.chatState.messages,
      sendMessage: mocks.sendMessage,
      regenerate: vi.fn(),
      setMessages: mocks.setMessages,
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
    }),
    useQueryClient: () => ({
      invalidateQueries: mocks.invalidateQueries,
      refetchQueries: mocks.refetchQueries,
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
    notebookQueryOptions: vi.fn((id: string) => ({ queryKey: ["notebooks", id], queryFn: vi.fn() })),
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
});

describe("useChatPanel send-chat-prompt handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chatHistory = undefined;
    mocks.chatState.messages = [];
    mocks.chatState.status = "ready";
    mocks.useChatOptions = undefined;
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
});
