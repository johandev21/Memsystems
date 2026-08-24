import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  OpenAIKeyPrompt,
} from "@/features/ai";
import { NotebookBanner } from "@/features/notebooks";
import { CLEAR_NOTEBOOK_CHAT_EVENT } from "@/features/notebooks";
import { useEffect, useLayoutEffect, useRef } from "react";
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

  useLayoutEffect(() => {
    const parent = conversationWrapperRef.current;
    const composer = composerWrapperRef.current;
    if (!parent || !composer) return;

    const update = () => {
      parent.style.setProperty("--composer-height", `${composer.offsetHeight}px`);
    };

    update();

    const ro = new ResizeObserver(update);
    ro.observe(composer);

    // Re-measure on font load / window resize as fallback
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const notebookTitle = notebook?.title ?? "Notebook";
  const isUntitled = notebookTitle.toLowerCase() === "untitled";
  const showBannerAsUntitled = isUntitled && messageCount === 0;
  const hasMessages = messageCount > 0;

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
        <Conversation className="flex-1 min-h-0">
          <ConversationContent
            className="mx-auto w-full max-w-4xl pb-32"
            style={{ paddingBottom: "calc(var(--composer-height, 96px) + 1rem)" } as React.CSSProperties}
          >
            {notebook && (
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
            )}

            {hasMessages ? (
              <ChatMessageList
                messages={messages}
                citedSourcesMap={citedSourcesMap}
                isThinking={status === "submitted"}
                onCopy={handleCopy}
                onRegenerate={handleRegenerate}
              />
            ) : (
              <ChatEmptyState
                notebookTitle={notebookTitle}
                description={notebook?.description ?? null}
                isUntitled={isUntitled}
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
            <ClearHistoryDialog
              open={isClearDialogOpen}
              onOpenChange={(open) => {
                if (!clearHistoryMutation.isPending) {
                  setIsClearDialogOpen(open);
                }
              }}
              onConfirm={() => clearHistoryMutation.mutate()}
              isClearing={clearHistoryMutation.isPending}
            />
            {connection?.ok !== false ? (
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
              <OpenAIKeyPrompt
                provider={modelOptions.length > 0 ? selectedModel.split("/")[0] : undefined}
                description={
                  modelOptions.length > 0
                    ? "An API key is required to chat with your study assistant."
                    : undefined
                }
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
