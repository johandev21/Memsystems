import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  GatewayKeyPrompt,
  isConnectionUsable,
} from "@/features/ai";
import { NotebookBanner } from "@/features/notebooks";
import { CLEAR_NOTEBOOK_CHAT_EVENT } from "@/features/notebooks";
import { useEffect, useLayoutEffect, useRef } from "react";
import { MessageScrollerItem } from "@/components/ui/message-scroller";
import { useChatPanel } from "../hooks/use-chat-panel";
import { ChatEmptyState } from "./chat-empty-state";
import { ChatMessageList } from "./chat-message-list";
import { ClearHistoryDialog } from "./clear-history-dialog";
import { Composer } from "./composer";

export function ChatPanel({ notebookId }: { notebookId: string }) {
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
    error,
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
    ? "Thinking…"
    : "Waiting for response…";

  const notebookTitle = notebook?.title ?? "Notebook";
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
        style={{ ["--composer-height" as string]: "96px" } as React.CSSProperties}
      >
        <Conversation key={notebookId} className="flex-1 min-h-0">
          <ConversationContent
            className="mx-auto w-full max-w-4xl pb-32"
            aria-busy={isLoading}
            style={
              { paddingBottom: "calc(var(--composer-height, 96px) + 1rem)" } as React.CSSProperties
            }
          >
            {notebook && (
              <MessageScrollerItem messageId="notebook-banner">
                <NotebookBanner
                  notebookId={notebook.id}
                  title={notebook.title}
                  description={notebook.description}
                  icon={notebook.icon ?? undefined}
                  bannerUrl={notebook.bannerUrl}
                  bannerFocalPoint={notebook.bannerFocalPoint}
                  updatedAt={notebook.updatedAt}
                  isUntitled={showBannerAsUntitled}
                />
                {!hasMessages && (
                  <ChatEmptyState
                    notebookTitle={notebookTitle}
                    description={notebook?.description ?? null}
                    isUntitled={isUntitled}
                  />
                )}
              </MessageScrollerItem>
            )}

            {!notebook && !hasMessages && (
              <MessageScrollerItem messageId="chat-empty-state">
                <ChatEmptyState
                  notebookTitle={notebookTitle}
                  description={null}
                  isUntitled={isUntitled}
                />
              </MessageScrollerItem>
            )}

            {hasMessages && (
              <ChatMessageList
                messages={messages}
                citedSourcesMap={citedSourcesMap}
                showPendingIndicator={showPendingIndicator}
                pendingLabel={pendingLabel}
                error={error}
                onCopy={handleCopy}
                onRegenerate={handleRegenerate}
              />
            )}
          </ConversationContent>
          <ConversationScrollButton
            style={
              {
                bottom: "calc(var(--composer-height, 96px) + 0.75rem)",
              } as React.CSSProperties
            }
          />
        </Conversation>

        <div
          ref={composerWrapperRef}
          className="absolute inset-x-0 bottom-0 z-composer p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] select-none"
        >
          <div className="mx-auto w-full max-w-4xl">
            {connection && !connection.ok && connection.degraded && (
              <div
                role="status"
                className="mb-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-700 dark:text-amber-300"
              >
                AI Gateway is busy — responses may fail. Waiting a bit and retrying usually
                works.
              </div>
            )}
            <ClearHistoryDialog
              open={isClearDialogOpen}
              onOpenChange={handleClearDialogChange}
              onConfirm={handleClearHistory}
              isClearing={clearHistoryMutation.isPending}
            />
            {isConnectionUsable(connection) ? (
              <Composer
                input={input}
                onInputChange={setInput}
                onSubmit={handleSubmit}
                isLoading={isLoading}
                onStop={stop}
                models={modelOptions}
                selectedModel={selectedModel}
                onModelChange={handleModelChange}
                textareaRef={composerTextareaRef}
              />
            ) : (
              <GatewayKeyPrompt description="An AI Gateway key is required to chat with your study assistant." />
            )}
          </div>
        </div>
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
