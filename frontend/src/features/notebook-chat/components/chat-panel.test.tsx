import type { UIMessage } from "@ai-sdk/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n/i18n";
import { ChatPanel } from "./chat-panel";
import type { useChatPanel } from "../hooks/use-chat-panel";

type ChatPanelHookReturn = ReturnType<typeof useChatPanel>;

let updateHookState: ((updater: (prev: ChatPanelHookReturn) => ChatPanelHookReturn) => void) | null = null;
let currentHookState: ChatPanelHookReturn;

vi.mock("../hooks/use-chat-panel", () => ({
  useChatPanel: () => {
    const [state, setState] = useState<ChatPanelHookReturn>(currentHookState);
    updateHookState = setState;
    return state;
  },
}));

function createDefaultHookState(): ChatPanelHookReturn {
  return {
    notebook: {
      id: "nb-1",
      title: "Test Notebook",
      description: "Notebook description",
      icon: null,
      bannerUrl: null,
      bannerVariants: null,
      bannerFocalPoint: null,
      groundingMode: "grounded",
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      userId: "user-1",
      sourcesCount: 0,
      studyMaterialsCount: 0,
    } as unknown as ChatPanelHookReturn["notebook"],
    connection: { ok: true, degraded: false } as ChatPanelHookReturn["connection"],
    modelOptions: [
      {
        id: "openai/gpt-5.6-sol",
        label: "GPT-5.6 Sol",
        capabilities: { reasoning: false },
      },
    ] as unknown as ChatPanelHookReturn["modelOptions"],
    capabilitiesVerified: true,
    selectedModel: "openai/gpt-5.6-sol",
    handleModelChange: vi.fn(),
    messages: [] as UIMessage[],
    citedSourcesMap: new Map(),
    status: "ready" as const,
    isLoading: false,
    isHistoryPending: false,
    error: undefined,
    messageCount: 0,
    anchorMessageId: null,
    clearAnchor: vi.fn(),
    input: "",
    setInput: vi.fn(),
    isClearDialogOpen: false,
    setIsClearDialogOpen: vi.fn(),
    clearHistoryMutation: {
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ChatPanelHookReturn["clearHistoryMutation"],
    handleSubmit: vi.fn(),
    handleCopy: vi.fn(),
    handleRegenerate: vi.fn(),
    composerTextareaRef: { current: null },
    stop: vi.fn(),
    chatAnnouncement: null,
  };
}

function renderChatPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let result: ReturnType<typeof render> = null!;
  act(() => {
    result = render(
      <QueryClientProvider client={queryClient}>
        <ChatPanel notebookId="nb-1" />
      </QueryClientProvider>,
    );
  });
  return result;
}

describe("ChatPanel accessibility (Ticket #130)", () => {
  beforeEach(async () => {
    vi.useRealTimers();
    await i18n.changeLanguage("en");
    await i18n.loadNamespaces(["chat"]);
    currentHookState = createDefaultHookState();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Transcript container (role=log)", () => {
    it("renders the transcript container with role='log' and an accessible name", () => {
      renderChatPanel();

      const transcript = screen.getByRole("log", { name: "Chat transcript" });
      expect(transcript).toBeTruthy();
      expect(transcript.getAttribute("tabindex")).toBe("0");
    });

    it("renders localized accessible name in Spanish", async () => {
      await i18n.changeLanguage("es");
      await i18n.loadNamespaces(["chat"]);
      renderChatPanel();

      const transcript = screen.getByRole("log", { name: "Transcripción del chat" });
      expect(transcript).toBeTruthy();
    });

    it("allows keyboard focus on the transcript container", () => {
      renderChatPanel();

      const transcript = screen.getByRole("log", { name: "Chat transcript" });
      transcript.focus();
      expect(document.activeElement).toBe(transcript);
    });

    it("allows keyboard navigation to the composer textarea", () => {
      renderChatPanel();

      const transcript = screen.getByRole("log", { name: "Chat transcript" });
      transcript.focus();
      expect(document.activeElement).toBe(transcript);

      const textarea = screen.getByPlaceholderText("Type a message...");
      textarea.focus();
      expect(document.activeElement).toBe(textarea);
    });
  });

  describe("Response announcements", () => {
    it("announces 'Responding' when generation starts and 'Response complete' when it finishes", async () => {
      vi.useFakeTimers();
      renderChatPanel();

      // Check initial state: live regions are empty
      const liveRegions = document.querySelectorAll("[aria-live='polite']");
      expect(liveRegions.length).toBeGreaterThanOrEqual(2);

      // Status transitions to 'submitted'
      act(() => {
        updateHookState?.((prev) => ({
          ...prev,
          status: "submitted",
          isLoading: true,
        }));
      });

      expect(screen.getByText("Responding")).toBeTruthy();

      // Status transitions to 'streaming' - should still say responding
      act(() => {
        updateHookState?.((prev) => ({
          ...prev,
          status: "streaming",
          isLoading: true,
        }));
      });

      expect(screen.getByText("Responding")).toBeTruthy();

      // Status transitions to 'ready' - should announce completion
      act(() => {
        updateHookState?.((prev) => ({
          ...prev,
          status: "ready",
          isLoading: false,
        }));
      });

      expect(screen.getByText("Response complete")).toBeTruthy();

      // Announcement is cleared after timeout
      act(() => {
        vi.advanceTimersByTime(4000);
      });

      expect(screen.queryByText("Response complete")).toBeNull();
    });

    it("announces in Spanish when language is 'es'", async () => {
      vi.useFakeTimers();
      await i18n.changeLanguage("es");
      await i18n.loadNamespaces(["chat"]);

      renderChatPanel();

      act(() => {
        updateHookState?.((prev) => ({
          ...prev,
          status: "submitted",
          isLoading: true,
        }));
      });

      expect(screen.getByText("Respondiendo")).toBeTruthy();

      act(() => {
        updateHookState?.((prev) => ({
          ...prev,
          status: "ready",
          isLoading: false,
        }));
      });

      expect(screen.getByText("Respuesta completa")).toBeTruthy();
    });

    it("keeps existing chat panel opening announcement functional", () => {
      currentHookState = {
        ...currentHookState,
        chatAnnouncement: "Opening chat for Photosynthesis.",
      };

      renderChatPanel();

      expect(screen.getByText("Opening chat for Photosynthesis.")).toBeTruthy();
    });
  });

  describe("Visually hidden sender labels", () => {
    it("renders chronological sender labels in user and assistant messages with sr-only class", () => {
      const userMsg: UIMessage = {
        id: "msg-user-1",
        role: "user",
        parts: [{ type: "text", text: "What is quantum mechanics?" }],
      };
      const assistantMsg: UIMessage = {
        id: "msg-assistant-1",
        role: "assistant",
        parts: [{ type: "text", text: "Quantum mechanics is a fundamental theory in physics." }],
      };

      currentHookState = {
        ...currentHookState,
        messages: [userMsg, assistantMsg],
        messageCount: 2,
      };

      renderChatPanel();

      const userLabel = screen.getByText("You");
      expect(userLabel).toBeTruthy();
      expect(userLabel.classList.contains("sr-only")).toBe(true);

      const assistantLabel = screen.getByText("Assistant");
      expect(assistantLabel).toBeTruthy();
      expect(assistantLabel.classList.contains("sr-only")).toBe(true);

      // Verify chronological order: user label appears before assistant label in the DOM
      const position = userLabel.compareDocumentPosition(assistantLabel);
      expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("renders localized sender labels in Spanish", async () => {
      await i18n.changeLanguage("es");
      await i18n.loadNamespaces(["chat"]);

      const userMsg: UIMessage = {
        id: "msg-user-1",
        role: "user",
        parts: [{ type: "text", text: "¿Qué es la fotosíntesis?" }],
      };
      const assistantMsg: UIMessage = {
        id: "msg-assistant-1",
        role: "assistant",
        parts: [{ type: "text", text: "La fotosíntesis es un proceso metabólico." }],
      };

      currentHookState = {
        ...currentHookState,
        messages: [userMsg, assistantMsg],
        messageCount: 2,
      };

      renderChatPanel();

      const userLabel = screen.getByText("Tú");
      expect(userLabel.classList.contains("sr-only")).toBe(true);

      const assistantLabel = screen.getByText("Asistente");
      expect(assistantLabel.classList.contains("sr-only")).toBe(true);
    });
  });
});
