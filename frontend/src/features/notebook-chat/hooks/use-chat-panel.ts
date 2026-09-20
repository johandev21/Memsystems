import type { FileUIPart } from "ai";
import { type UIMessage, useChat } from "@ai-sdk/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useConnectionStatus } from "@/features/ai";
import { useModelPersistence } from "@/features/notebooks/hooks/use-model-persistence";
import {
  type ChatMessageDTO,
  type ChatRequest,
  type CitedSourceDTO,
  chatMessagesQueryOptions,
  clearChatHistory,
} from "../api/chat";
import i18n from "@/shared/i18n";
import { modelsQueryOptions } from "@/features/ai";
import { notebookQueryOptions } from "@/features/notebooks/api";

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

    let parts: UIMessage["parts"] = [];
    if (msg.parts && Array.isArray(msg.parts) && msg.parts.length > 0) {
      parts = msg.parts as UIMessage["parts"];
    } else {
      if (msg.reasoning && msg.reasoning.trim()) {
        parts.push({ type: "reasoning", text: msg.reasoning });
      }
      if (msg.content) {
        parts.push({ type: "text", text: msg.content });
      }
    }

    formatted.push({
      id: msg.id,
      role: msg.role as "user" | "assistant",
      parts,
      metadata: msg.metadata ?? undefined,
    } as UIMessage);
  }

  return formatted;
}

export function useChatPanel(notebookId: string, panelRef?: React.RefObject<HTMLElement | null>) {
  const { t } = useTranslation("chat");
  const { data: notebook } = useQuery(notebookQueryOptions(notebookId));
  const { data: models } = useQuery(modelsQueryOptions);
  const chatHistoryQuery = useQuery(chatMessagesQueryOptions(notebookId));
  const chatHistory = chatHistoryQuery.data;
  const isHistoryPending = chatHistoryQuery.isPending;
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

  const transport = useMemo(() => {
    return new DefaultChatTransport({
      api: `/api/notebooks/${notebookId}/chat`,
      credentials: "include",
      prepareSendMessagesRequest: ({ messages }) => {
        const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
        const language = (i18n.resolvedLanguage ?? i18n.language ?? "en").split("-")[0];
        return {
          body: {
            model: selectedModel,
            message: lastUserMessage ?? null,
            messages: messages.map((m) => ({
              id: m.id,
              role: m.role,
              parts: m.parts,
              metadata: m.metadata,
            })),
            language,
          } satisfies ChatRequest,
        };
      },
    });
  }, [notebookId, selectedModel]);

  const initialMessages = useMemo(() => formatChatMessages(chatHistory), [chatHistory]);

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
  const abortedMessagesRef = useRef<UIMessage[] | null>(null);

  const invalidateNotebookCaches = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ["chat", notebookId, "messages"],
    });
    queryClient.invalidateQueries({ queryKey: ["notebooks", notebookId] });
    queryClient.invalidateQueries({ queryKey: ["notebooks", "home"] });
    queryClient.invalidateQueries({ queryKey: ["notebooks", "all"] });
  }, [queryClient, notebookId]);

  const { messages, sendMessage, regenerate, setMessages, status, stop, error } = useChat({
    id: notebookId,
    transport,
    messages: initialMessages,
    onFinish: async ({ isAbort, isError, messages: finishedMessages }) => {
      if (isAbort) {
        abortedMessagesRef.current = finishedMessages;
        await queryClient.refetchQueries({
          queryKey: ["chat", notebookId, "messages"],
        });
        return;
      }

      abortedMessagesRef.current = null;
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

  const formattedMessages = useMemo(() => formatChatMessages(chatHistory), [chatHistory]);

  useEffect(() => {
    if (!chatHistory) return;
    if (status === "streaming" || status === "submitted") return;
    if (abortedMessagesRef.current) return;
    setMessages(formattedMessages);
  }, [chatHistory, formattedMessages, status, setMessages]);

  const isLoading = status === "submitted" || status === "streaming";
  const messageCount = messages.length;

  // Only a user message sent during this session is allowed to pull the
  // viewport. Messages hydrated from persisted history must never anchor, or
  // opening a notebook would scroll straight past the banner to the last turn.
  const hydratedMessageIds = useMemo(
    () => new Set((chatHistory ?? []).map((message) => message.id)),
    [chatHistory],
  );
  const anchorMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message?.role === "user") {
        return hydratedMessageIds.has(message.id) ? null : message.id;
      }
    }
    return null;
  }, [messages, hydratedMessageIds]);

  const composerTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const [chatAnnouncement, setChatAnnouncement] = useState<string | null>(null);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);

  const clearHistoryMutation = useMutation({
    mutationFn: () => clearChatHistory(notebookId),
    onSuccess: () => {
      abortedMessagesRef.current = null;
      setMessages([]);
      queryClient.setQueryData(["chat", notebookId, "messages"], []);
      queryClient.invalidateQueries({
        queryKey: ["chat", notebookId, "messages"],
      });
      queryClient.invalidateQueries({ queryKey: ["notebooks", notebookId] });
      queryClient.invalidateQueries({ queryKey: ["notebooks", "home"] });
      queryClient.invalidateQueries({ queryKey: ["notebooks", "all"] });
      setIsClearDialogOpen(false);
      toast.success(t("clearHistory.cleared"));
    },
    onError: () => {
      toast.error(t("clearHistory.clearFailed"));
    },
  });

  const handleSubmit = useCallback(
    (submission: string | { text: string; files?: FileUIPart[] }) => {
      const text = typeof submission === "string" ? submission : submission.text;
      const files = typeof submission === "string" ? undefined : submission.files;
      const trimmed = text.trim();
      const hasFiles = Boolean(files && files.length > 0);

      if ((!trimmed && !hasFiles) || isLoading) return;
      abortedMessagesRef.current = null;
      setInput("");

      if (hasFiles && files) {
        const parts: UIMessage["parts"] = [];
        for (const file of files) {
          parts.push({
            type: "file",
            mediaType: file.mediaType,
            url: file.url,
            filename: file.filename,
          });
        }
        if (trimmed) {
          parts.push({ type: "text", text: trimmed });
        }
        sendMessage({
          role: "user",
          parts,
        });
      } else {
        sendMessage({ text: trimmed });
      }
    },
    [isLoading, sendMessage],
  );

  const handleCopy = useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text);
      toast.success(t("message.copiedToClipboard"));
    },
    [t],
  );

  const handleRegenerate = useCallback(() => {
    abortedMessagesRef.current = null;
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
            detail.concept
              ? t("announcement.openingChatFor", { concept: detail.concept })
              : t("announcement.openingChat"),
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
  }, [handleSubmit, panelRef, t]);

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
    isHistoryPending,
    error,
    messageCount,
    anchorMessageId,
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
