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
  type ChatHistoryDTO,
  type ChatRequest,
  type CitedSourceDTO,
  chatMessagesQueryOptions,
  clearChatHistory,
  selectChatBranch,
} from "../api/chat";
import i18n from "@/shared/i18n";
import { useModelsCatalog } from "@/features/ai";
import { notebookQueryOptions } from "@/features/notebooks/api";

const DEFAULT_MODEL_ID = "openai/gpt-5.6-sol";
const EMPTY_SELECTED_PATH_IDS: string[] = [];

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
      metadata:
        msg.metadata || msg.parentId !== undefined
          ? {
              ...(msg.metadata ?? {}),
              parentId: msg.parentId,
              siblingIndex: msg.siblingIndex,
              siblingCount: msg.siblingCount,
              isOnSelectedPath: msg.isOnSelectedPath,
              isSelected: msg.isSelected,
            }
          : undefined,
    } as UIMessage);
  }

  return formatted;
}

export function transcriptBeforeEdit(messages: UIMessage[], messageId: string): UIMessage[] {
  const index = messages.findIndex((message) => message.id === messageId);
  return index < 0 ? messages : messages.slice(0, index);
}

function latestAssistantReply(messages: UIMessage[]): UIMessage | undefined {
  let lastUserIndex = -1;
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index]?.role === "user") {
      lastUserIndex = index;
      break;
    }
  }
  for (let index = messages.length - 1; index > lastUserIndex; index--) {
    if (messages[index]?.role === "assistant") return messages[index];
  }
  return undefined;
}

function hasAssistantText(message: UIMessage): boolean {
  return message.parts.some((part) => part.type === "text" && "text" in part && part.text.trim().length > 0);
}

function latestDurableEndpoint(messages: UIMessage[]): string | undefined {
  const assistantReply = latestAssistantReply(messages);
  if (assistantReply && hasAssistantText(assistantReply)) return assistantReply.id;
  return [...messages].reverse().find((message) => message.role === "user")?.id;
}

function transcriptThroughMessage(messages: UIMessage[], messageId: string): UIMessage[] {
  const messagesById = new Map(messages.map((message) => [message.id, message]));
  const path: UIMessage[] = [];
  const visitedIds = new Set<string>();
  let current = messagesById.get(messageId);

  while (current) {
    if (visitedIds.has(current.id)) return [];
    path.push(current);
    visitedIds.add(current.id);
    const parentId = (current.metadata as { parentId?: string | null } | undefined)?.parentId;
    if (parentId && !messagesById.has(parentId)) return [];
    current = parentId ? messagesById.get(parentId) : undefined;
  }

  return path.reverse();
}

export function useChatPanel(notebookId: string, panelRef?: React.RefObject<HTMLElement | null>, sourceIds?: string[]) {
  const { t } = useTranslation("chat");
  const { data: notebook } = useQuery(notebookQueryOptions(notebookId));
  const { models: catalogModels, capabilitiesVerified } = useModelsCatalog();
  const chatHistoryQuery = useQuery(chatMessagesQueryOptions(notebookId));
  const historyData = chatHistoryQuery.data as ChatHistoryDTO | ChatMessageDTO[] | undefined;
  const chatHistory = Array.isArray(historyData) ? historyData : historyData?.messages;
  const selectedMessageId = Array.isArray(historyData) ? null : historyData?.selectedMessageId ?? null;
  const selectedPathIds = Array.isArray(historyData)
    ? EMPTY_SELECTED_PATH_IDS
    : historyData?.selectedPathIds ?? EMPTY_SELECTED_PATH_IDS;
  const selectedMessageIdOverrideRef = useRef<string | null | undefined>(undefined);
  const isHistoryPending = chatHistoryQuery.isPending;
  const { data: connection } = useConnectionStatus();

  const modelOptions = catalogModels;

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

  const requestIntentRef = useRef<{
    parentMessageId?: string | null;
    editMessageId?: string;
    regenerateMessageId?: string;
  }>({});
  // A branch selection is asynchronous. Keep this in a ref as well as state so
  // two submit events in the same React batch cannot race the selection.
  const branchSelectionPendingRef = useRef(false);
  const pendingBranchRestoreRef = useRef<string | null>(null);
  const [isBranchSelectionPending, setIsBranchSelectionPending] = useState(false);

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
            parentMessageId: requestIntentRef.current.parentMessageId,
            editMessageId: requestIntentRef.current.editMessageId,
            regenerateMessageId: requestIntentRef.current.regenerateMessageId,
            sourceIds: sourceIds ?? undefined,
          } satisfies ChatRequest,
        };
      },
    });
  }, [notebookId, selectedModel, sourceIds]);

  const selectedHistoryMessages = useMemo(() => {
    const all = formatChatMessages(chatHistory);
    if (!selectedPathIds.length) return Array.isArray(historyData) ? all : [];
    const messagesById = new Map(all.map((message) => [message.id, message]));
    return selectedPathIds.flatMap((id) => {
      const message = messagesById.get(id);
      return message ? [message] : [];
    });
  }, [chatHistory, historyData, selectedPathIds]);
  const initialMessages = selectedHistoryMessages;

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

  const { messages, sendMessage, regenerate, setMessages, status, stop, error, clearError } = useChat({
    id: notebookId,
    transport,
    messages: initialMessages,
    experimental_throttle: 50,
    onFinish: async ({ isAbort, isError, messages: finishedMessages }) => {
      if (isAbort) {
        const latestEndpoint = latestDurableEndpoint(finishedMessages);
        if (selectedMessageIdOverrideRef.current !== undefined && latestEndpoint) {
          selectedMessageIdOverrideRef.current = latestEndpoint;
        }
        const markedMessages = finishedMessages.map((msg, idx) =>
          idx === finishedMessages.length - 1 && msg.role === "assistant"
            ? {
                ...msg,
                metadata: {
                  ...(typeof msg.metadata === "object" && msg.metadata !== null
                    ? msg.metadata
                    : {}),
                  finishReason: "cancelled",
                },
              }
            : msg,
        );
        setMessages(markedMessages);
        abortedMessagesRef.current = markedMessages;
        await queryClient.refetchQueries({
          queryKey: ["chat", notebookId, "messages"],
        });
        return;
      }

      abortedMessagesRef.current = null;
      if (!isError) {
        const latestEndpoint = latestDurableEndpoint(finishedMessages);
        if (selectedMessageIdOverrideRef.current !== undefined && latestEndpoint) {
          selectedMessageIdOverrideRef.current = latestEndpoint;
        }
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

  const citedSourcesMap = useMemo(() => {
    const map = new Map<string, CitedSourceDTO[]>();
    for (const msg of chatHistory ?? []) {
      if (msg.citedSources?.length) {
        map.set(msg.id, msg.citedSources);
      }
    }
    for (const msg of messages ?? []) {
      const meta = (msg.metadata ?? {}) as { citedSources?: CitedSourceDTO[] };
      if (meta.citedSources?.length) {
        map.set(msg.id, meta.citedSources);
      }
    }
    return map;
  }, [chatHistory, messages]);

  // Hydrate from server history only when the history data itself changes. Re-running on
  // `status`/`messages` changes replaced the live transcript with stale history (the
  // post-finish refetch had not landed yet, or the optimistic user message was not persisted),
  // which made the conversation vanish and re-render.
  const lastSyncedHistoryRef = useRef<{
    messages: ChatMessageDTO[] | undefined;
    selectedPathKey: string;
  }>({ messages: chatHistory, selectedPathKey: selectedPathIds.join("\u0000") });
  useEffect(() => {
    if (!chatHistory) return;
    if (status === "streaming" || status === "submitted") return;
    if (abortedMessagesRef.current) return;

    const pendingEndpoint = pendingBranchRestoreRef.current;
    if (pendingEndpoint) {
      const restoredTranscript = transcriptThroughMessage(formattedMessages, pendingEndpoint);
      if (restoredTranscript.length > 0) {
        setMessages(restoredTranscript);
        lastSyncedHistoryRef.current = {
          messages: chatHistory,
          selectedPathKey: selectedPathIds.join("\u0000"),
        };
        pendingBranchRestoreRef.current = null;
        branchSelectionPendingRef.current = false;
        setIsBranchSelectionPending(false);
        clearError();
      }
      return;
    }

    if (
      selectedMessageIdOverrideRef.current !== undefined &&
      selectedMessageIdOverrideRef.current !== selectedMessageId
    ) return;
    const selectedPathKey = selectedPathIds.join("\u0000");
    const lastSyncedHistory = lastSyncedHistoryRef.current;
    if (
      lastSyncedHistory.messages === chatHistory &&
      lastSyncedHistory.selectedPathKey === selectedPathKey
    ) return;
    lastSyncedHistoryRef.current = { messages: chatHistory, selectedPathKey };
    setMessages(selectedHistoryMessages);
  }, [chatHistory, clearError, formattedMessages, selectedHistoryMessages, selectedMessageId, selectedPathIds, status, setMessages]);

  const isLoading = status === "submitted" || status === "streaming";
  const messageCount = messages.length;

  const [clearedAnchorId, setClearedAnchorId] = useState<string | null>(null);

  const initialHydratedIdsRef = useRef<Set<string> | null>(null);
  if (initialHydratedIdsRef.current === null && chatHistory) {
    initialHydratedIdsRef.current = new Set(chatHistory.map((message) => message.id));
  }

  const rawAnchorMessageId = useMemo(() => {
    const initialIds = initialHydratedIdsRef.current;
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message?.role === "user") {
        return initialIds?.has(message.id) ? null : message.id;
      }
    }
    return null;
  }, [messages]);

  const anchorMessageId =
    rawAnchorMessageId && rawAnchorMessageId !== clearedAnchorId
      ? rawAnchorMessageId
      : null;

  const clearAnchor = useCallback(() => {
    if (rawAnchorMessageId && clearedAnchorId !== rawAnchorMessageId) {
      setClearedAnchorId(rawAnchorMessageId);
    }
  }, [rawAnchorMessageId, clearedAnchorId]);

  const composerTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const [chatAnnouncement, setChatAnnouncement] = useState<string | null>(null);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);

  const getCurrentParentMessageId = useCallback(() => {
    if (selectedMessageIdOverrideRef.current !== undefined) {
      return selectedMessageIdOverrideRef.current;
    }
    const currentMessage = messages.at(-1);
    return currentMessage?.role === "assistant" && hasAssistantText(currentMessage)
      ? currentMessage.id
      : selectedMessageId;
  }, [messages, selectedMessageId]);

  const clearHistoryMutation = useMutation({
    mutationFn: () => clearChatHistory(notebookId),
    onSuccess: () => {
      abortedMessagesRef.current = null;
      selectedMessageIdOverrideRef.current = null;
      requestIntentRef.current = { parentMessageId: null };
      setClearedAnchorId(null);
      setMessages([]);
      queryClient.setQueryData(["chat", notebookId, "messages"], {
        messages: [],
        selectedMessageId: null,
        selectedPathIds: [],
      });
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

      if ((!trimmed && !hasFiles) || isLoading || branchSelectionPendingRef.current) return;
      abortedMessagesRef.current = null;
      requestIntentRef.current = { parentMessageId: getCurrentParentMessageId() };
      setClearedAnchorId(null);
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
    [getCurrentParentMessageId, isLoading, sendMessage],
  );

  const handleEdit = useCallback((message: UIMessage, text: string) => {
    if (isLoading || branchSelectionPendingRef.current) return;
    const trimmed = text.trim();
    if (!trimmed || trimmed === message.parts.filter((part) => part.type === "text").map((part) => part.text).join("\n\n").trim()) return;
    abortedMessagesRef.current = null;
    setClearedAnchorId(null);
    requestIntentRef.current = {
      parentMessageId: (message.metadata as { parentId?: string | null } | undefined)?.parentId ?? null,
      editMessageId: message.id,
    };
    if (messages.some((current) => current.id === message.id)) {
      // The SDK builds its request transcript from its current messages. Remove
      // the edited turn and all descendants before sendMessage appends the edit.
      setMessages(transcriptBeforeEdit(messages, message.id));
    }
    const files = message.parts.filter((part) => part.type === "file");
    sendMessage({
      role: "user",
      parts: [...files, { type: "text", text: trimmed }] as UIMessage["parts"],
    });
  }, [isLoading, messages, sendMessage, setMessages]);

  const handleCopy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        toast.success(t("message.copiedToClipboard"));
        return true;
      } catch {
        toast.error(t("message.copyFailed"));
        return false;
      }
    },
    [t],
  );

  const handleRegenerate = useCallback((messageId?: string) => {
    abortedMessagesRef.current = null;
    setClearedAnchorId(null);
    if (isLoading || branchSelectionPendingRef.current) return;
    if (messageId) {
      requestIntentRef.current = { regenerateMessageId: messageId };
    } else {
      const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
      if (lastUserMessage) {
        // A failed request can leave its optimistic user message in the SDK
        // transcript. It is not a valid branch parent until the server has
        // persisted it. Reuse the original request intent in that case. Once
        // persisted, retry from the user's actual ancestor instead of making
        // the user message its own parent.
        const persistedUser = chatHistory?.find((message) => message.id === lastUserMessage.id);
        if (persistedUser) {
          requestIntentRef.current = {
            parentMessageId: persistedUser.parentId ?? null,
          };
        } else if (requestIntentRef.current.parentMessageId === undefined) {
          requestIntentRef.current = {
            parentMessageId: getCurrentParentMessageId(),
          };
        }
      } else if (requestIntentRef.current.parentMessageId === undefined) {
        requestIntentRef.current = {
            parentMessageId: getCurrentParentMessageId(),
        };
      }
    }
    regenerate(messageId ? { messageId } : undefined);
  }, [chatHistory, getCurrentParentMessageId, isLoading, messages, regenerate]);

  const handleSelectBranch = useCallback(async (messageId: string) => {
    if (isLoading || branchSelectionPendingRef.current) return;
    const previousTranscript = messages;
    const previousEndpoint = getCurrentParentMessageId();
    abortedMessagesRef.current = null;
    pendingBranchRestoreRef.current = null;
    branchSelectionPendingRef.current = true;
    setIsBranchSelectionPending(true);
    const panel = panelRef?.current;
    const findMessageRow = () => {
      const rows = Array.from(
        panel?.querySelectorAll<HTMLElement>("[data-message-id]") ??
          document.querySelectorAll<HTMLElement>("[data-message-id]"),
      ).filter((element) => element.dataset.messageId === messageId);
      return rows.find((element) => element.getClientRects().length > 0) ?? rows[0];
    };
    const viewport =
      panel?.querySelector<HTMLElement>('[data-slot="message-scroller-viewport"]') ??
      document.querySelector<HTMLElement>('[data-slot="message-scroller-viewport"]');
    const beforeTop = findMessageRow()?.getBoundingClientRect().top;
    try {
      const selection = await selectChatBranch(notebookId, messageId);
      // Requests must follow the selected branch even before React has rendered
      // the query refetch result and rebuilt these callbacks.
      const selectedMessageId = selection?.selectedMessageId ?? messageId;
      selectedMessageIdOverrideRef.current = selectedMessageId;
      const selectedTranscript = transcriptThroughMessage(formattedMessages, selectedMessageId);
      if (selectedTranscript.length > 0) {
        setMessages(selectedTranscript);
      } else {
        pendingBranchRestoreRef.current = selectedMessageId;
      }
      let historyRefetchFailed = false;
      try {
        await queryClient.refetchQueries({ queryKey: ["chat", notebookId, "messages"] });
      } catch {
        historyRefetchFailed = true;
        toast.error(t("branch.selectFailed"));
      }

      const refreshedHistory = queryClient.getQueryData<ChatHistoryDTO | ChatMessageDTO[]>([
        "chat", notebookId, "messages",
      ]);
      const refreshedMessages = Array.isArray(refreshedHistory)
        ? formatChatMessages(refreshedHistory)
        : formatChatMessages(refreshedHistory?.messages ?? chatHistory);
      const refreshedTranscript = transcriptThroughMessage(refreshedMessages, selectedMessageId);
      if (refreshedTranscript.length > 0) {
        setMessages(refreshedTranscript);
        pendingBranchRestoreRef.current = null;
        clearError();
      } else {
        // The selection endpoint may remember a descendant that this client
        // has not loaded yet. Keep the visible transcript and its matching
        // parent together if history cannot provide that full ancestry.
        selectedMessageIdOverrideRef.current = previousEndpoint;
        setMessages(previousTranscript);
        pendingBranchRestoreRef.current = null;
        if (!historyRefetchFailed) toast.error(t("branch.selectFailed"));
      }
      if (beforeTop !== undefined) requestAnimationFrame(() => {
        const after = findMessageRow();
        if (after && viewport) viewport.scrollTop += after.getBoundingClientRect().top - beforeTop;
      });
    } catch {
      selectedMessageIdOverrideRef.current = previousEndpoint;
      setMessages(previousTranscript);
      pendingBranchRestoreRef.current = null;
      toast.error(t("branch.selectFailed"));
      try {
        await queryClient.refetchQueries({ queryKey: ["chat", notebookId, "messages"] });
      } catch {
        // Keep the failed selection local; the next explicit refetch can recover.
      }
    } finally {
      if (!pendingBranchRestoreRef.current) {
        branchSelectionPendingRef.current = false;
        setIsBranchSelectionPending(false);
      }
    }
  }, [chatHistory, clearError, formattedMessages, getCurrentParentMessageId, isLoading, messages, notebookId, panelRef, queryClient, setIsBranchSelectionPending, setMessages, t]);

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
            const panel = panelRef?.current;
            const textarea =
              (typeof panel?.querySelector === "function"
                ? panel.querySelector<HTMLTextAreaElement>("textarea")
                : null) ?? composerTextareaRef.current;
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
    capabilitiesVerified,
    selectedModel,
    handleModelChange,
    messages,
    selectedMessages: messages,
    citedSourcesMap,
    status,
    isLoading,
    isBranchSelectionPending,
    isHistoryPending,
    error,
    messageCount,
    anchorMessageId,
    clearAnchor,
    input,
    setInput,
    isClearDialogOpen,
    setIsClearDialogOpen,
    clearHistoryMutation,
    handleSubmit,
    handleEdit,
    handleCopy,
    handleRegenerate,
    handleSelectBranch,
    allBranchMessages: formattedMessages,
    composerTextareaRef,
    stop,
    chatAnnouncement,
  };
}
