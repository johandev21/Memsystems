import type { UIMessage } from "@ai-sdk/react";
import { ExternalLink, Loader2, RotateCcw, Settings2 } from "lucide-react";
import { useMemo } from "react";
import type { CitedSourceDTO } from "../api/chat";
import { MessageScrollerItem } from "@/components/ui/message-scroller";
import { AssistantMessage } from "./assistant-message";
import { UserMessage } from "./user-message";
import { groupMessagesIntoTurns } from "../types/chat-turn.types";
import {
  GATEWAY_TOP_UP_URL,
  classifyChatError,
} from "../utils/chat-error";

export interface ChatMessageListProps {
  messages: UIMessage[];
  citedSourcesMap: Map<string, CitedSourceDTO[]>;
  isThinking: boolean;
  error?: Error | null;
  onCopy: (text: string) => void;
  onRegenerate: () => void;
}

export function ChatMessageList({
  messages,
  citedSourcesMap,
  isThinking,
  error,
  onCopy,
  onRegenerate,
}: ChatMessageListProps) {
  const turns = useMemo(() => groupMessagesIntoTurns(messages), [messages]);

  const lastUserMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === "user") {
        return messages[i].id;
      }
    }
    return null;
  }, [messages]);

  return (
    <>
      {turns.map((turn, index) => {
        const isLast = index === turns.length - 1;
        if (turn.type === "user") {
          return (
            <MessageScrollerItem
              key={turn.id}
              messageId={turn.id}
              scrollAnchor={turn.id === lastUserMessageId}
            >
              <UserMessage message={turn.message} />
            </MessageScrollerItem>
          );
        }

        return (
          <MessageScrollerItem key={turn.id} messageId={turn.id}>
            <AssistantMessage
              versions={turn.versions}
              citedSourcesMap={citedSourcesMap}
              onCopy={onCopy}
              onRegenerate={onRegenerate}
              showRegenerate={isLast}
            />
          </MessageScrollerItem>
        );
      })}
      {isThinking && (
        <MessageScrollerItem messageId="thinking-indicator">
          <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Thinking...</span>
          </div>
        </MessageScrollerItem>
      )}
      {error && (
        <MessageScrollerItem messageId="chat-error-banner">
          <ChatErrorCard message={error.message} onRegenerate={onRegenerate} />
        </MessageScrollerItem>
      )}
    </>
  );
}

function ChatErrorCard({
  message,
  onRegenerate,
}: {
  message?: string;
  onRegenerate: () => void;
}) {
  const classified = useMemo(() => classifyChatError(message), [message]);

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
      <p className="font-semibold">{classified.title}</p>
      <p className="mt-1 leading-5 opacity-90">{classified.message}</p>
      {classified.showModelHint && (
        <p className="mt-1 leading-5 opacity-75">
          Tip: cheaper models are throttled less often.
        </p>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRegenerate}
          className="flex items-center gap-1 rounded-lg bg-destructive px-2.5 py-1 font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors cursor-pointer"
        >
          <RotateCcw className="size-3" />
          Retry
        </button>
        {classified.showTopUp && (
          <a
            href={GATEWAY_TOP_UP_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-lg px-2 py-1 font-medium underline underline-offset-2 hover:opacity-80"
          >
            Add credits
            <ExternalLink className="size-3" />
          </a>
        )}
        {classified.showSettings && (
          <a
            href="/settings"
            className="flex items-center gap-1 rounded-lg px-2 py-1 font-medium underline underline-offset-2 hover:opacity-80"
          >
            <Settings2 className="size-3" />
            Open settings
          </a>
        )}
      </div>
    </div>
  );
}
