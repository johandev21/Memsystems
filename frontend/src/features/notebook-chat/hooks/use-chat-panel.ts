import { type UIMessage, useChat } from "@ai-sdk/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useConnectionStatus } from "@/features/ai";
import { useModelPersistence } from "@/features/notebooks";
import { type ChatMessageDTO, type CitedSourceDTO, chatMessagesQueryOptions, clearChatHistory } from "@/shared/api/chat";
import { modelsQueryOptions } from "@/shared/api/models";
import { notebookQueryOptions } from "@/shared/api";

const DEFAULT_MODEL_ID = "openai/gpt-5.6-sol";

export interface SendChatPromptDetail {
  prompt: string;
  autoSend?: boolean;
  focusChat?: boolean;
  concept?: string;
  chatNavigationRetry?: boolean;
}

export function formatChatMessages(history?: ChatMessageDTO[]): UIMessage[] {
  if (!history) return [];
  const seenIds = new Set<string>();
  const formatted: UIMessage[] = [];

  for (const msg of history) {
    if (!msg.id || seenIds.has(msg.id)) continue;
    seenIds.add(msg.id);

    formatted.push({
      id: msg.id,
      role: msg.role as "user" | "assistant",
      parts: [{ type: "text" as const, text: msg.content ?? "" }],
    });
  }

  return formatted;
}

export function useChatPanel(notebookId: string, panelRef?: React.RefObject<HTMLElement | null>) {
  const { data: notebook } = useQuery(notebookQueryOptions(notebookId));
  const { data: models } = useQuery(modelsQueryOptions);
  const { data: chatHistory } = useQuery(chatMessagesQueryOptions(notebookId));
  const { data: connection } = useConnectionStatus();

  const modelOptions = useMemo(() => models ?? [], [models]);

  const { model: persistedModel, setModel: setPersistedModel } = useModelPersistence(notebookId);
  const selectedModel = persistedModel ?? DEFAULT_MODEL_ID;

  useEffect(() => {
    if (modelOptions.length > 0) {
      const exists = modelOptions.some((m) => m.id === selectedModel);
      if (!exists) {
        setPersistedModel(modelOptions[0].id);
      }
    }
  }, [modelOptions, selectedModel, setPersistedModel]);

  const handleModelChange = useCallback(
    (modelId: string) => {
      setPersistedModel(modelId);
    },
    [setPersistedModel],
  );

  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;

  const transport = useMemo(() => {
    return new DefaultChatTransport({
      api: `/api/notebooks/${notebookId}/chat`,
      credentials: "include",
      prepareSendMessagesRequest: ({ messages }) => {
        const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
        return {
          body: {
            model: selectedModelRef.current,
            message: lastUserMessage ?? null,
            messages: messages.map((m) => ({
              id: m.id,
              role: m.role,
              parts: m.parts.filter((p) => p.type === "text"),
            })),
          },
        };
      },
    });
  }, [notebookId]);

  const initialMessages = useMemo(
    () => formatChatMessages(chatHistory),
    [chatHistory],
  );

  const citedSourcesMap = useMemo(() => {
    const map = new Map<string, CitedSourceDTO[]>();
    for (const msg of chatHistory ?? []) {
      if (msg.citedSources?.length) {
        map.set(msg.id, msg.citedSources);
      }
    }
    return map;
  }, [chatHistory]);

  const queryClient = useQueryClient();

  const invalidateNotebookCaches = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ["chat", notebookId, "messages"],
    });
    queryClient.invalidateQueries({ queryKey: ["notebooks", notebookId] });
    queryClient.invalidateQueries({ queryKey: ["notebooks", "home"] });
    queryClient.invalidateQueries({ queryKey: ["notebooks", "all"] });
  }, [queryClient, notebookId]);

  const { messages, sendMessage, regenerate, setMessages, status, stop } = useChat({
    id: notebookId,
    transport,
    messages: initialMessages,
    onFinish: async ({ isError }) => {
      if (!isError) {
        await queryClient.refetchQueries({
          queryKey: ["chat", notebookId, "messages"],
        });
        queryClient.invalidateQueries({
          queryKey: ["notebooks", notebookId],
        });
        queryClient.invalidateQueries({ queryKey: ["notebooks", "home"] });
        queryClient.invalidateQueries({ queryKey: ["notebooks", "all"] });
      }
    },
    onError: () => {
      invalidateNotebookCaches();
    },
  });

  const formattedMessages = useMemo(
    () => formatChatMessages(chatHistory),
    [chatHistory],
  );

  useEffect(() => {
    if (!chatHistory) return;
    if (status === "streaming" || status === "submitted") return;
    setMessages(formattedMessages);
  }, [chatHistory, formattedMessages, status, setMessages]);

  const isLoading = status === "submitted" || status === "streaming";
  const messageCount = messages.length;

  const composerTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const [chatAnnouncement, setChatAnnouncement] = useState<string | null>(null);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);

  const clearHistoryMutation = useMutation({
    mutationFn: () => clearChatHistory(notebookId),
    onSuccess: () => {
      setMessages([]);
      queryClient.setQueryData(["chat", notebookId, "messages"], []);
      queryClient.invalidateQueries({
        queryKey: ["chat", notebookId, "messages"],
      });
      queryClient.invalidateQueries({ queryKey: ["notebooks", notebookId] });
      queryClient.invalidateQueries({ queryKey: ["notebooks", "home"] });
      queryClient.invalidateQueries({ queryKey: ["notebooks", "all"] });
      setIsClearDialogOpen(false);
      toast.success("Chat history cleared");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleSubmit = useCallback(
    (text: string) => {
      if (!text.trim() || isLoading) return;
      setInput("");
      sendMessage({ text });
    },
    [isLoading, sendMessage],
  );

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const handleRegenerate = useCallback(() => {
    regenerate();
  }, [regenerate]);

  useEffect(() => {
    const handleSendPromptEvent = (e: Event) => {
      const detail = (e as CustomEvent<SendChatPromptDetail>).detail;
      const promptText = detail?.prompt;
      if (promptText?.trim()) {
        if (panelRef?.current && panelRef.current.getClientRects().length === 0) {
          return;
        }

        if (detail.focusChat) {
          setChatAnnouncement(
            detail.concept ? `Opening chat for ${detail.concept}.` : "Opening chat.",
          );
          window.setTimeout(() => setChatAnnouncement(null), 4000);
          window.requestAnimationFrame(() => {
            const textarea = composerTextareaRef.current;
            if (!textarea) return;
            textarea.scrollIntoView({
              block: "center",
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "auto"
                : "smooth",
            });
            textarea.focus();
          });
        }

        if (detail.autoSend !== false) {
          handleSubmit(promptText);
        } else {
          setInput(promptText);
        }
      }
    };

    window.addEventListener("send-chat-prompt", handleSendPromptEvent);
    return () => {
      window.removeEventListener("send-chat-prompt", handleSendPromptEvent);
    };
  }, [handleSubmit, panelRef]);

  return {
    notebook,
    connection,
    modelOptions,
    selectedModel,
    handleModelChange,
    messages,
    citedSourcesMap,
    status,
    isLoading,
    messageCount,
    input,
    setInput,
    isClearDialogOpen,
    setIsClearDialogOpen,
    clearHistoryMutation,
    handleSubmit,
    handleCopy,
    handleRegenerate,
    composerTextareaRef,
    stop,
    chatAnnouncement,
  };
}
