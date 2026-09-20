import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  GatewayKeyPrompt,
  isConnectionUsable,
} from "@/features/ai";
import { NotebookBanner } from "@/features/notebooks/components/shared/notebook-banner";
import { CLEAR_NOTEBOOK_CHAT_EVENT } from "@/features/notebooks/components/dialogs/notebook-settings-dialog";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { MessageScrollerItem } from "@/components/ui/message-scroller";
import { useChatPanel } from "../hooks/use-chat-panel";
import { CHAT_ENTRANCE_CLASS } from "../utils/chat-entrance";
import { ChatConversationSkeleton } from "./chat-conversation-skeleton";
import { ChatEmptyState } from "./chat-empty-state";
import { ChatMessageList } from "./chat-message-list";
import { ClearHistoryDialog } from "./clear-history-dialog";
import { Composer } from "./composer";

export function ChatPanel({ notebookId }: { notebookId: string }) {
  const { t } = useTranslation("chat");
  const panelRef = useRef<HTMLDivElement>(null);
  const composerWrapperRef = useRef<HTMLDivElement>(null);
  const conversationWrapperRef = useRef<HTMLDivElement>(null);
  const {
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
  } = useChatPanel(notebookId, panelRef);

  useComposerHeight(conversationWrapperRef, composerWrapperRef);

  useEffect(() => {
    const handleClearRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ notebookId?: string }>).detail;
      if (
        detail?.notebookId === notebookId &&
        messageCount > 0 &&
        !isLoading &&
        (!panelRef.current || panelRef.current.getClientRects().length > 0)
      ) {
        setIsClearDialogOpen(true);
      }
    };
    window.addEventListener(CLEAR_NOTEBOOK_CHAT_EVENT, handleClearRequest);
    return () => window.removeEventListener(CLEAR_NOTEBOOK_CHAT_EVENT, handleClearRequest);
  }, [isLoading, messageCount, notebookId, panelRef, setIsClearDialogOpen]);

  const selectedModelSupportsReasoning = modelOptions.some(
    (m) => m.id === selectedModel && m.capabilities?.reasoning === true,
  );
  // Only show the generic pending row while NO assistant content has arrived
  // yet. As soon as the first reasoning/text part streams, the live
  // AssistantMessage (Reasoning block / answer) takes over and this hides,
  // so we never double-render "Thinking…" alongside real reasoning.
  const lastMessage = messages.at(-1);
  const hasAssistantPlaceholder =
    lastMessage?.role === "assistant" && (lastMessage.parts?.length ?? 0) > 0;
  const showPendingIndicator = status === "submitted" && !hasAssistantPlaceholder;
  const pendingLabel = selectedModelSupportsReasoning
    ? t("pending.thinking")
    : t("pending.waiting");

  const notebookTitle = notebook?.title ?? t("panel.notebookFallback");
  const isUntitled = notebookTitle.toLowerCase() === "untitled";
  const showBannerAsUntitled = isUntitled && messageCount === 0;
  const hasMessages = messageCount > 0;
  const handleClearDialogChange = (open: boolean) => {
    if (!clearHistoryMutation.isPending) setIsClearDialogOpen(open);
  };
  const handleClearHistory = () => clearHistoryMutation.mutate();

  return (
    <div ref={panelRef} className="flex flex-1 h-full w-full flex-col min-h-0">
      <div aria-live="polite" className="sr-only">
        {chatAnnouncement}
      </div>
      <div
        ref={conversationWrapperRef}
        className="relative flex w-full min-h-0 flex-1 flex-col"
        style={{ "--composer-height": "96px" } as React.CSSProperties}
      >
        <Conversation key={notebookId} className="flex-1 min-h-0" defaultScrollPosition="start">
          <ChatContent
            notebook={notebook}
            notebookTitle={notebookTitle}
            flags={{
              isUntitled,
              showBannerAsUntitled,
              hasMessages,
              isLoading,
              isHistoryPending,
              showPendingIndicator,
            }}
            messages={messages}
            citedSourcesMap={citedSourcesMap}
            pendingLabel={pendingLabel}
            anchorMessageId={anchorMessageId}
            error={error}
            onCopy={handleCopy}
            onRegenerate={handleRegenerate}
          />
          <ConversationScrollButton
            className="bottom-(--composer-offset)"
            style={
              {
                "--composer-offset": "calc(var(--composer-height, 96px) + 0.75rem)",
              } as React.CSSProperties
            }
          />
        </Conversation>

        <ChatComposerArea
          composerWrapperRef={composerWrapperRef}
          connection={connection}
          isClearDialogOpen={isClearDialogOpen}
          onClearDialogChange={handleClearDialogChange}
          onClearHistory={handleClearHistory}
          isClearing={clearHistoryMutation.isPending}
          input={input}
          onInputChange={setInput}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          onStop={stop}
          models={modelOptions}
          selectedModel={selectedModel}
          onModelChange={handleModelChange}
          composerTextareaRef={composerTextareaRef}
        />
      </div>
    </div>
  );
}

interface ChatContentFlags {
  isUntitled: boolean;
  showBannerAsUntitled: boolean;
  hasMessages: boolean;
  isLoading: boolean;
  isHistoryPending: boolean;
  showPendingIndicator: boolean;
}

interface ChatContentProps {
  notebook: ReturnType<typeof useChatPanel>["notebook"];
  notebookTitle: string;
  flags: ChatContentFlags;
  messages: ReturnType<typeof useChatPanel>["messages"];
  citedSourcesMap: ReturnType<typeof useChatPanel>["citedSourcesMap"];
  pendingLabel: string;
  anchorMessageId: ReturnType<typeof useChatPanel>["anchorMessageId"];
  error: ReturnType<typeof useChatPanel>["error"];
  onCopy: (content: string) => void;
  onRegenerate: () => void;
}

function ChatContent({
  notebook,
  notebookTitle,
  flags,
  messages,
  citedSourcesMap,
  pendingLabel,
  anchorMessageId,
  error,
  onCopy,
  onRegenerate,
}: ChatContentProps) {
  const {
    isUntitled,
    showBannerAsUntitled,
    hasMessages,
    isLoading,
    isHistoryPending,
    showPendingIndicator,
  } = flags;
  // Show the skeleton until the first history result settles, but never block
  // a user who starts typing straight away: any optimistic message wins.
  const showHistorySkeleton = isHistoryPending && !hasMessages;
  return (
    <ConversationContent
      className="mx-auto w-full max-w-4xl pb-32 pb-(--composer-pad)"
      aria-busy={isLoading}
      style={
        { "--composer-pad": "calc(var(--composer-height, 96px) + 1rem)" } as React.CSSProperties
      }
    >
      {notebook && (
        <MessageScrollerItem messageId="notebook-banner">
          <div className={CHAT_ENTRANCE_CLASS}>
            <NotebookBanner
              notebookId={notebook.id}
              title={notebook.title}
              description={notebook.description}
              icon={notebook.icon ?? undefined}
              bannerUrl={notebook.bannerUrl}
              bannerVariants={notebook.bannerVariants}
              bannerFocalPoint={notebook.bannerFocalPoint}
              updatedAt={notebook.updatedAt}
              isUntitled={showBannerAsUntitled}
            />
            {!hasMessages && !showHistorySkeleton && (
              <ChatEmptyState
                notebookTitle={notebookTitle}
                description={notebook?.description ?? null}
                isUntitled={isUntitled}
              />
            )}
          </div>
        </MessageScrollerItem>
      )}

      {showHistorySkeleton && (
        <MessageScrollerItem messageId="chat-history-skeleton">
          <div className={CHAT_ENTRANCE_CLASS}>
            <ChatConversationSkeleton withBanner={!notebook} />
          </div>
        </MessageScrollerItem>
      )}

      {!notebook && !hasMessages && !showHistorySkeleton && (
        <MessageScrollerItem messageId="chat-empty-state">
          <div className={CHAT_ENTRANCE_CLASS}>
            <ChatEmptyState
              notebookTitle={notebookTitle}
              description={null}
              isUntitled={isUntitled}
            />
          </div>
        </MessageScrollerItem>
      )}

      {hasMessages && (
        <ChatMessageList
          messages={messages}
          citedSourcesMap={citedSourcesMap}
          showPendingIndicator={showPendingIndicator}
          pendingLabel={pendingLabel}
          anchorMessageId={anchorMessageId}
          error={error}
          onCopy={onCopy}
          onRegenerate={onRegenerate}
        />
      )}
    </ConversationContent>
  );
}

interface ChatComposerAreaProps {
  composerWrapperRef: React.RefObject<HTMLDivElement | null>;
  connection: ReturnType<typeof useChatPanel>["connection"];
  isClearDialogOpen: boolean;
  onClearDialogChange: (open: boolean) => void;
  onClearHistory: () => void;
  isClearing: boolean;
  input: string;
  onInputChange: (val: string) => void;
  onSubmit: ReturnType<typeof useChatPanel>["handleSubmit"];
  isLoading: boolean;
  onStop: () => void;
  models: ReturnType<typeof useChatPanel>["modelOptions"];
  selectedModel: string;
  onModelChange: (model: string) => void;
  composerTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

function ChatComposerArea({
  composerWrapperRef,
  connection,
  isClearDialogOpen,
  onClearDialogChange,
  onClearHistory,
  isClearing,
  input,
  onInputChange,
  onSubmit,
  isLoading,
  onStop,
  models,
  selectedModel,
  onModelChange,
  composerTextareaRef,
}: ChatComposerAreaProps) {
  const { t } = useTranslation("chat");

  return (
    <div
      ref={composerWrapperRef}
      className="absolute inset-x-0 bottom-0 z-composer p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] select-none"
    >
      <div className="mx-auto w-full max-w-4xl">
        {connection && !connection.ok && connection.degraded && (
          <div
            role="status"
            className="mb-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs leading-5 text-warning dark:text-warning"
          >
            {t("panel.gatewayBusy")}
          </div>
        )}
        <ClearHistoryDialog
          open={isClearDialogOpen}
          onOpenChange={onClearDialogChange}
          onConfirm={onClearHistory}
          isClearing={isClearing}
        />
        {isConnectionUsable(connection) ? (
          <Composer
            input={input}
            onInputChange={onInputChange}
            onSubmit={onSubmit}
            isLoading={isLoading}
            onStop={onStop}
            models={models}
            selectedModel={selectedModel}
            onModelChange={onModelChange}
            textareaRef={composerTextareaRef}
          />
        ) : (
          <GatewayKeyPrompt description={t("panel.gatewayKeyDescription")} />
        )}
      </div>
    </div>
  );
}

function useComposerHeight(
  conversationRef: React.RefObject<HTMLDivElement | null>,
  composerRef: React.RefObject<HTMLDivElement | null>,
) {
  useLayoutEffect(() => {
    const parent = conversationRef.current;
    const composer = composerRef.current;
    if (!parent || !composer) return;
    const updateHeight = () =>
      parent.style.setProperty("--composer-height", `${composer.offsetHeight}px`);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(composer);
    window.addEventListener("resize", updateHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [conversationRef, composerRef]);
}
