import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { useChat } from "@ai-sdk/react";
import { createContext, useContext, useState } from "react";
import { describe, expect, it } from "vitest";
import type { UIMessage } from "@ai-sdk/react";
import { transcriptBeforeEdit } from "./use-chat-panel";

describe("AI SDK branch transcript", () => {
  it("keeps two responsive consumers on one active SDK session", async () => {
    const requests: UIMessage[][] = [];
    let streamController: ReadableStreamDefaultController | null = null;
    const transport = {
      sendMessages: async ({ messages }: { messages: UIMessage[] }) => {
        requests.push(messages);
        return new ReadableStream({
          start(controller) {
            streamController = controller;
            controller.enqueue({ type: "start", messageId: "active-answer" });
            controller.enqueue({ type: "text-start", id: "text" });
            controller.enqueue({ type: "text-delta", id: "text", delta: "partial" });
            // Leave the stream open to model a request crossing a viewport change.
          },
        });
      },
      reconnectToStream: async () => null,
    };
    const SessionContext = createContext<ReturnType<typeof useChat> | null>(null);
    function SessionProvider({ children }: { children: React.ReactNode }) {
      const session = useChat({
        id: "responsive-session",
        transport: transport as never,
      });
      return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
    }
    function Consumer({ name, active }: { name: string; active: boolean }) {
      const session = useContext(SessionContext);
      if (!session) throw new Error("session provider missing");
      return (
        <section data-active={active}>
          <output data-testid={`${name}-transcript`}>
            {session.messages.map((message) => message.id).join(",")}
          </output>
          <button onClick={() => void session.sendMessage({ text: "shared prompt" })}>
            send {name}
          </button>
        </section>
      );
    }
    function ResponsiveHarness() {
      const [mobileActive, setMobileActive] = useState(false);
      return (
        <SessionProvider>
          <Consumer name="desktop" active={!mobileActive} />
          <Consumer name="mobile" active={mobileActive} />
          <button onClick={() => setMobileActive((active) => !active)}>switch viewport</button>
        </SessionProvider>
      );
    }

    render(<ResponsiveHarness />);
    await act(async () => {
      screen.getByRole("button", { name: "send desktop" }).click();
      await Promise.resolve();
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toHaveLength(1);
    const transcriptDuringStream = screen.getByTestId("desktop-transcript").textContent;
    expect(screen.getByTestId("mobile-transcript").textContent).toBe(transcriptDuringStream);

    await act(async () => {
      screen.getByRole("button", { name: "switch viewport" }).click();
    });
    expect(screen.getByTestId("mobile-transcript").textContent).toBe(transcriptDuringStream);
    expect(screen.getByTestId("desktop-transcript").textContent).toBe(transcriptDuringStream);
    expect(requests).toHaveLength(1);
    await act(async () => {
      streamController?.close();
      await Promise.resolve();
    });
  });

  it("retries the selected user node with its original SDK ID and parts", async () => {
    const requests: UIMessage[][] = [];
    const transport = {
      sendMessages: async ({ messages }: { messages: UIMessage[] }) => {
        requests.push(messages);
        return new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "start", messageId: "retry-answer" });
            controller.enqueue({ type: "finish", finishReason: "stop" });
            controller.close();
          },
        });
      },
      reconnectToStream: async () => null,
    };
    const selectedUser: UIMessage = {
      id: "stable-user-id",
      role: "user",
      parts: [
        { type: "file", mediaType: "image/png", url: "data:image/png;base64,aGVsbG8=", filename: "notes.png" },
        { type: "text", text: "Explain this page" },
      ],
    };
    const { result } = renderHook(() => useChat({
      id: "sdk-retry-transcript",
      messages: [selectedUser],
      transport: transport as never,
    }));

    await act(async () => { await result.current.regenerate(); });

    expect(requests[0][0]).toEqual(selectedUser);
  });

  it("keeps a stopped stream recoverable and regenerates against the selected nested branch", async () => {
    const requests: UIMessage[][] = [];
    const selectedPath: UIMessage[] = [
      { id: "root", role: "user", parts: [{ type: "text", text: "root" }] },
      { id: "root-answer", role: "assistant", parts: [{ type: "text", text: "root answer" }] },
      { id: "user-b", role: "user", parts: [{ type: "text", text: "branch B question" }] },
      { id: "answer-b", role: "assistant", parts: [{ type: "text", text: "branch B answer" }] },
      { id: "nested-b", role: "user", parts: [{ type: "text", text: "nested follow-up" }] },
    ];
    const transport = {
      sendMessages: async ({ messages, abortSignal }: { messages: UIMessage[]; abortSignal: AbortSignal }) => {
        requests.push(messages);
        return new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "start", messageId: requests.length === 1 ? "partial-answer" : "regenerated-answer" });
            if (requests.length === 1) {
              controller.enqueue({ type: "text-start", id: "text" });
              controller.enqueue({ type: "text-delta", id: "text", delta: "partial response" });
              abortSignal.addEventListener("abort", () => {
                controller.error(new DOMException("Aborted", "AbortError"));
              }, { once: true });
              return;
            }
            controller.enqueue({ type: "finish", finishReason: "stop" });
            controller.close();
          },
        });
      },
      reconnectToStream: async () => null,
    };
    const { result } = renderHook(() => useChat({
      id: "sdk-stop-regenerate",
      messages: [selectedPath[0]],
      transport: transport as never,
    }));

    let firstSend!: Promise<void>;
    act(() => { firstSend = result.current.sendMessage({ text: "temporary question" }); });
    await waitFor(() => expect(requests).toHaveLength(1));
    await waitFor(() => expect(result.current.messages.at(-1)?.parts).toContainEqual(
      expect.objectContaining({ type: "text", text: "partial response" }),
    ));

    await act(async () => { await result.current.stop(); });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    await act(async () => { await firstSend; });
    expect(result.current.messages.at(-1)?.parts).toContainEqual(
      expect.objectContaining({ type: "text", text: "partial response" }),
    );

    act(() => result.current.setMessages(selectedPath));
    await act(async () => { await result.current.regenerate(); });

    expect(requests[1].map((message) => message.id)).toEqual([
      "root", "root-answer", "user-b", "answer-b", "nested-b",
    ]);
    expect(requests[1].some((message) => message.id === "answer-a")).toBe(false);
  });

  it("sends an edited middle turn with no abandoned descendants", async () => {
    const requests: UIMessage[][] = [];
    const transport = {
      sendMessages: async ({ messages }: { messages: UIMessage[] }) => {
        requests.push(messages);
        return new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "start", messageId: `assistant-${requests.length}` });
            controller.enqueue({ type: "text-start", id: "text" });
            controller.enqueue({ type: "text-delta", id: "text", delta: "reply" });
            controller.enqueue({ type: "text-end", id: "text" });
            controller.enqueue({ type: "finish", finishReason: "stop" });
            controller.close();
          },
        });
      },
      reconnectToStream: async () => null,
    };
    const initial: UIMessage[] = [
      { id: "root", role: "user", parts: [{ type: "text", text: "root" }] },
      { id: "root-answer", role: "assistant", parts: [{ type: "text", text: "answer" }] },
      { id: "middle", role: "user", parts: [{ type: "text", text: "middle" }] },
      { id: "middle-answer", role: "assistant", parts: [{ type: "text", text: "answer" }] },
      { id: "leaf", role: "user", parts: [{ type: "text", text: "leaf" }] },
      { id: "leaf-answer", role: "assistant", parts: [{ type: "text", text: "answer" }] },
    ];
    const { result } = renderHook(() => useChat({
      id: "sdk-branch-transcript",
      messages: initial,
      transport: transport as never,
    }));

    await act(async () => {
      await result.current.sendMessage({ text: "continue old branch" });
    });
    await act(async () => {
      result.current.setMessages(transcriptBeforeEdit(result.current.messages, "middle"));
      await result.current.sendMessage({ text: "edited middle" });
    });

    expect(requests[1].map((message) => message.id)).toEqual([
      "root", "root-answer", expect.any(String),
    ]);
    expect(requests[1].some((message) => message.id === "leaf")).toBe(false);
    expect(requests[1].some((message) => message.id === "middle-answer")).toBe(false);
  });
});
