import { act, renderHook } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatPanel } from "./use-chat-panel";
import i18n from "@/shared/i18n/i18n";
import type { ChatHistoryDTO, ChatMessageDTO } from "../api/chat";

const mocks = vi.hoisted(() => ({
  history: undefined as ChatHistoryDTO | undefined,
  selectBranch: vi.fn(),
  refetchQueries: vi.fn(),
  requests: [] as Record<string, unknown>[],
}));

vi.mock("../api/chat", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/chat")>();
  return { ...actual, selectChatBranch: mocks.selectBranch };
});

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (options: { queryKey?: readonly unknown[] }) => ({
      data: options.queryKey?.[0] === "chat" ? mocks.history : undefined,
      isPending: false,
    }),
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
      refetchQueries: mocks.refetchQueries,
      getQueryData: () => mocks.history,
      setQueryData: vi.fn(),
    }),
    useMutation: () => ({ isPending: false, mutate: vi.fn() }),
  };
});

vi.mock("@/features/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/ai")>();
  return {
    ...actual,
    useConnectionStatus: () => ({ data: { ok: true } }),
    useModelsCatalog: () => ({ models: [], capabilitiesVerified: true }),
  };
});

vi.mock("@/features/notebooks/hooks/use-model-persistence", () => ({
  useModelPersistence: () => ({ model: null, setModel: vi.fn() }),
}));
vi.mock("@/features/notebooks/api", () => ({ notebookQueryOptions: (id: string) => ({ queryKey: ["notebooks", id] }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeAll(async () => { await i18n.loadNamespaces("chat"); });

function message(id: string, role: "user" | "assistant", parentId: string | null = null): ChatMessageDTO {
  return {
    id, role, content: id, parentId, citedSourceIds: null, citedSources: [],
    createdAt: "2026-10-22T10:00:00.000Z",
  };
}

const branchMessages = [
  message("root", "user"),
  message("answer-root", "assistant", "root"),
  message("user-a", "user", "answer-root"),
  message("answer-a", "assistant", "user-a"),
  message("user-b", "user", "answer-root"),
  message("answer-b", "assistant", "user-b"),
  message("nested-b", "user", "answer-b"),
  message("nested-answer-b", "assistant", "nested-b"),
  message("user-c", "user", "answer-b"),
];

function history(selectedPathIds: string[], selectedMessageId: string): ChatHistoryDTO {
  return { messages: branchMessages, selectedMessageId, selectedPathIds };
}

describe("useChatPanel synchronization with the real AI SDK chat store", () => {
  beforeEach(() => {
    mocks.history = history(["root", "answer-root", "user-a", "answer-a"], "answer-a");
    mocks.selectBranch.mockReset();
    mocks.selectBranch.mockImplementation(async (_notebookId: string, messageId: string) => ({ selectedMessageId: messageId }));
    mocks.refetchQueries.mockReset();
    mocks.refetchQueries.mockResolvedValue(undefined);
    mocks.requests = [];
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      mocks.requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(
            'data: {"type":"start","messageId":"generated-answer"}\n\n' +
            'data: {"type":"finish","finishReason":"stop"}\n\n',
          ));
          controller.close();
        },
      });
      return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
    }));
  });

  it("shows and sends each selected nested path immediately across repeated switches and stale history", async () => {
    const { result, rerender } = renderHook(() => useChatPanel("sdk-sync-notebook"));
    const expected = [
      ["root", "answer-root", "user-b", "answer-b"],
      ["root", "answer-root", "user-b", "answer-b", "nested-b", "nested-answer-b"],
      ["root", "answer-root", "user-a", "answer-a"],
      ["root", "answer-root", "user-b", "answer-b", "nested-b", "nested-answer-b"],
    ];

    for (const [index, targetId] of ["answer-b", "nested-answer-b", "answer-a", "nested-answer-b"].entries()) {
      await act(async () => { await result.current.handleSelectBranch(targetId); });
      expect(result.current.messages.map((entry) => entry.id)).toEqual(expected[index]);

      // A late response for the previous branch must not replace the selected transcript.
      mocks.history = history(
        ["root", "answer-root", "user-a", "answer-a"],
        "answer-a",
      );
      rerender();
      expect(result.current.messages.map((entry) => entry.id)).toEqual(expected[index]);

      mocks.history = history(expected[index], targetId);
      rerender();
      expect(result.current.messages.map((entry) => entry.id)).toEqual(expected[index]);
    }

    // A stale snapshot can arrive even after the matching branch snapshot. Keep
    // the latest explicit branch choice authoritative for this session.
    mocks.history = history(expected[3], "nested-answer-b");
    rerender();
    mocks.history = history(["root", "answer-root", "user-a", "answer-a"], "answer-a");
    rerender();
    expect(result.current.messages.map((entry) => entry.id)).toEqual(expected[3]);

    act(() => { result.current.handleSubmit("continue on selected branch"); });
    await vi.waitFor(() => expect(mocks.requests).toHaveLength(1));
    const request = mocks.requests.at(-1);
    if (!request || !Array.isArray(request.messages)) throw new Error("DefaultChatTransport did not send its prepared messages");
    const messageIds = request.messages.map((entry) => {
      if (typeof entry !== "object" || entry === null || !("id" in entry)) {
        throw new Error("DefaultChatTransport sent a malformed chat message");
      }
      return entry.id;
    });
    expect(messageIds).toEqual([
      "root", "answer-root", "user-b", "answer-b", "nested-b", "nested-answer-b", expect.any(String),
    ]);
    expect(request).toMatchObject({ parentMessageId: "nested-answer-b" });
  });

  it("updates the real SDK transcript while the history refetch is still pending", async () => {
    let resolveRefetch!: () => void;
    mocks.refetchQueries.mockImplementation(() => new Promise<void>((resolve) => {
      resolveRefetch = resolve;
    }));
    const { result } = renderHook(() => useChatPanel("sdk-sync-notebook"));
    let selection!: Promise<void>;

    act(() => { selection = result.current.handleSelectBranch("answer-b"); });
    await act(async () => { await Promise.resolve(); });

    expect(result.current.isBranchSelectionPending).toBe(true);
    expect(result.current.messages.map((entry) => entry.id)).toEqual([
      "root", "answer-root", "user-b", "answer-b",
    ]);

    await act(async () => {
      resolveRefetch();
      await selection;
    });
  });

  it.each(["stale history", "refetch error"] as const)(
    "rolls back to the visible transcript and unlocks navigation after a successful selection with %s",
    async (failure) => {
      mocks.selectBranch.mockResolvedValue({ selectedMessageId: "remote-nested-answer" });
      if (failure === "refetch error") {
        mocks.refetchQueries
          .mockRejectedValueOnce(new Error("history unavailable"))
          .mockResolvedValue(undefined);
      } else {
        mocks.refetchQueries.mockResolvedValue(undefined);
      }
      const { result } = renderHook(() => useChatPanel("sdk-sync-notebook"));
      const previousPath = ["root", "answer-root", "user-a", "answer-a"];

      await act(async () => { await result.current.handleSelectBranch("user-b"); });

      // Never unlock with the returned endpoint paired with the old SDK path.
      expect(result.current.isBranchSelectionPending).toBe(false);
      expect(result.current.messages.map((entry) => entry.id)).toEqual(previousPath);
      act(() => { result.current.handleSubmit("continue the visible branch"); });
      await vi.waitFor(() => expect(mocks.requests).toHaveLength(1));
      const rolledBackRequest = mocks.requests[0];
      expect(rolledBackRequest).toMatchObject({ parentMessageId: "answer-a" });
      if (!Array.isArray(rolledBackRequest?.messages)) throw new Error("Expected the rolled-back transcript");
      expect((rolledBackRequest.messages as Array<{ id: string }>).map(({ id }) => id)).toEqual([
        ...previousPath, expect.any(String),
      ]);

      // Once the request completes, a further explicit branch choice still works.
      await vi.waitFor(() => expect(result.current.status).toBe("ready"));
      mocks.selectBranch.mockResolvedValue({ selectedMessageId: "answer-b" });
      await act(async () => { await result.current.handleSelectBranch("answer-b"); });
      expect(result.current.isBranchSelectionPending).toBe(false);
      expect(result.current.messages.map((entry) => entry.id)).toEqual([
        "root", "answer-root", "user-b", "answer-b",
      ]);
    },
  );

  it("restores the remembered nested version after editing the leaf and an ancestor", async () => {
    const nestedMessages = [
      message("root", "user"),
      message("answer-root", "assistant", "root"),
      message("user-a", "user", "answer-root"),
      message("answer-a-old", "assistant", "user-a"),
      message("answer-a-latest", "assistant", "user-a"),
      message("user-b", "user", "answer-a-old"),
      message("answer-b", "assistant", "user-b"),
      message("user-c", "user", "answer-b"),
      message("answer-c", "assistant", "user-c"),
      message("user-a-edited", "user", "answer-root"),
      message("answer-a-edited", "assistant", "user-a-edited"),
    ];
    const originalPath = [
      "root", "answer-root", "user-a", "answer-a-old", "user-b", "answer-b", "user-c", "answer-c",
    ];
    mocks.history = { messages: nestedMessages, selectedMessageId: "answer-c", selectedPathIds: originalPath };
    mocks.selectBranch.mockImplementation(async (_notebookId: string, messageId: string) => ({
      selectedMessageId: messageId === "user-a" ? "answer-c" : messageId,
    }));
    const { result, rerender, unmount } = renderHook(() => useChatPanel("sdk-sync-notebook"));

    const leaf = result.current.messages.find((entry) => entry.id === "user-c");
    if (!leaf) throw new Error("Expected the selected leaf to be present");
    act(() => { result.current.handleEdit(leaf, "edited leaf question"); });
    await vi.waitFor(() => expect(mocks.requests).toHaveLength(1));
    expect(mocks.requests[0]).toMatchObject({ editMessageId: "user-c", parentMessageId: "answer-b" });

    const ancestor = result.current.messages.find((entry) => entry.id === "user-a");
    if (!ancestor) throw new Error("Expected the three-level ancestor to remain in the active transcript");
    act(() => { result.current.handleEdit(ancestor, "edited ancestor question"); });
    await vi.waitFor(() => expect(mocks.requests).toHaveLength(2));
    expect(mocks.requests[1]).toMatchObject({ editMessageId: "user-a", parentMessageId: "answer-root" });

    // Selecting the original user version resolves to its remembered nested
    // endpoint, even though another answer version is newer and the edited
    // ancestor branch now exists.
    await act(async () => { await result.current.handleSelectBranch("user-a"); });
    expect(result.current.messages.map((entry) => entry.id)).toEqual(originalPath);

    await act(async () => { await result.current.handleSelectBranch("answer-a-latest"); });
    expect(result.current.messages.map((entry) => entry.id)).toEqual([
      "root", "answer-root", "user-a", "answer-a-latest",
    ]);
    await act(async () => { await result.current.handleSelectBranch("user-a"); });
    expect(result.current.messages.map((entry) => entry.id)).toEqual(originalPath);

    // A response for the edited branch can arrive after the remembered branch
    // was restored. Keep the user’s latest explicit selection authoritative.
    mocks.history = { messages: nestedMessages, selectedMessageId: "answer-a-edited", selectedPathIds: [
      "root", "answer-root", "user-a-edited", "answer-a-edited",
    ] };
    rerender();
    expect(result.current.messages.map((entry) => entry.id)).toEqual(originalPath);

    // Refresh starts from the server-selected path, and the next SDK request
    // must use the exact transcript that was restored above.
    mocks.history = { messages: nestedMessages, selectedMessageId: "answer-c", selectedPathIds: originalPath };
    unmount();
    const refreshed = renderHook(() => useChatPanel("sdk-sync-notebook"));
    expect(refreshed.result.current.messages.map((entry) => entry.id)).toEqual(originalPath);
    act(() => { refreshed.result.current.handleSubmit("continue remembered branch"); });
    await vi.waitFor(() => expect(mocks.requests).toHaveLength(3));
    const rememberedRequest = mocks.requests[2];
    expect(rememberedRequest).toMatchObject({ parentMessageId: "answer-c" });
    if (!Array.isArray(rememberedRequest?.messages)) throw new Error("Expected the remembered branch transcript");
    expect((rememberedRequest.messages as Array<{ id: string }>).map(({ id }) => id)).toEqual([
      ...originalPath, expect.any(String),
    ]);
  });

  it("clears the previous SDK request error after switching to another branch", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("previous branch failed");
    }));
    const { result } = renderHook(() => useChatPanel("sdk-sync-notebook"));

    act(() => { result.current.handleSubmit("request that fails"); });
    await vi.waitFor(() => expect(result.current.error?.message).toBe("previous branch failed"));
    expect(result.current.status).toBe("error");

    await act(async () => { await result.current.handleSelectBranch("answer-b"); });

    expect(result.current.messages.map((entry) => entry.id)).toEqual([
      "root", "answer-root", "user-b", "answer-b",
    ]);
    expect(result.current.error).toBeUndefined();
  });

  it("continues from a durable user turn when a selected-branch response is stopped before text", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as Record<string, unknown>;
      mocks.requests.push(request);
      if (mocks.requests.length > 1) {
        const completed = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(
              'data: {"type":"start","messageId":"answer-d"}\n\n' +
              'data: {"type":"finish","finishReason":"stop"}\n\n',
            ));
            controller.close();
          },
        });
        return new Response(completed, { headers: { "Content-Type": "text/event-stream" } });
      }

      const pending = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"type":"start","messageId":"empty-answer"}\n\n'));
          init?.signal?.addEventListener("abort", () => controller.close(), { once: true });
        },
      });
      return new Response(pending, { headers: { "Content-Type": "text/event-stream" } });
    }));

    const { result, rerender } = renderHook(() => useChatPanel("sdk-sync-notebook"));
    await act(async () => { await result.current.handleSelectBranch("answer-b"); });
    act(() => { result.current.handleSubmit("C: new user turn"); });
    await vi.waitFor(() => expect(mocks.requests).toHaveLength(1));
    expect(mocks.requests[0]).toMatchObject({ parentMessageId: "answer-b" });
    expect(result.current.messages.map((entry) => entry.id)).toEqual([
      "root", "answer-root", "user-b", "answer-b", expect.any(String), "empty-answer",
    ]);

    await act(async () => { await result.current.stop(); });
    await vi.waitFor(() => expect(result.current.status).toBe("ready"));

    const firstMessage = mocks.requests[0]?.message;
    if (typeof firstMessage !== "object" || firstMessage === null || !("id" in firstMessage)) {
      throw new Error("The persisted user turn should be present in the prepared request");
    }
    const persistedUserId = firstMessage.id;
    mocks.history = {
      messages: [...branchMessages, message(String(persistedUserId), "user", "answer-b")],
      selectedMessageId: String(persistedUserId),
      selectedPathIds: ["root", "answer-root", "user-b", "answer-b", String(persistedUserId)],
    };
    rerender();
    expect(result.current.messages.map((entry) => entry.id)).toContain(String(persistedUserId));

    act(() => { result.current.handleSubmit("D: continue after the stopped turn"); });
    await vi.waitFor(() => expect(mocks.requests).toHaveLength(2));
    expect(mocks.requests[1]).toMatchObject({ parentMessageId: String(persistedUserId) });
  });
});
