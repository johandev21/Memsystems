import { act, renderHook } from "@testing-library/react";
import type { RefObject } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessageDTO } from "@/shared/api/chat";

const mocks = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  setMessages: vi.fn(),
  invalidateQueries: vi.fn(),
  refetchQueries: vi.fn(),
  setQueryData: vi.fn(),
}));

vi.mock("@ai-sdk/react", () => ({
  useChat: () => ({
    messages: [],
    sendMessage: mocks.sendMessage,
    regenerate: vi.fn(),
    setMessages: mocks.setMessages,
    status: "ready",
    stop: vi.fn(),
  }),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => ({ data: undefined }),
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

vi.mock("@/features/ai", () => ({
  useConnectionStatus: () => ({ data: { ok: true } }),
}));

vi.mock("@/features/notebooks", () => ({
  useModelPersistence: () => ({ model: null, setModel: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { formatChatMessages, useChatPanel } from "./use-chat-panel";

function createMessage(overrides: Partial<ChatMessageDTO> & Pick<ChatMessageDTO, "id">): ChatMessageDTO {
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

  it("handles null or undefined content safely", () => {
    const history: ChatMessageDTO[] = [
      createMessage({ id: "msg-empty", role: "user", content: "" }),
      createMessage({ id: "msg-null", role: "assistant", content: (null as unknown as string) }),
    ];

    const result = formatChatMessages(history);

    expect(result).toEqual([
      {
        id: "msg-empty",
        role: "user",
        parts: [{ type: "text", text: "" }],
      },
      {
        id: "msg-null",
        role: "assistant",
        parts: [{ type: "text", text: "" }],
      },
    ]);
  });
});

describe("useChatPanel send-chat-prompt handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
