import type { UIMessage } from "@ai-sdk/react";
import { Loader2, RotateCcw } from "lucide-react";
import { useMemo } from "react";
import type { CitedSourceDTO } from "../api/chat";
import { MessageScrollerItem } from "@/components/ui/message-scroller";
import { AssistantMessage } from "./assistant-message";
import { UserMessage } from "./user-message";
import { groupMessagesIntoTurns } from "../types/chat-turn.types";

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
          <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <span>{error.message || "An error occurred while generating the response."}</span>
            <button
              type="button"
              onClick={onRegenerate}
              className="flex items-center gap-1 rounded-lg bg-destructive px-2.5 py-1 font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors cursor-pointer"
            >
              <RotateCcw className="size-3" />
              Retry
            </button>
          </div>
        </MessageScrollerItem>
      )}
    </>
  );
}
