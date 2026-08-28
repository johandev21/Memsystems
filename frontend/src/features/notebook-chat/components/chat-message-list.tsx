import type { UIMessage } from "@ai-sdk/react";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import type { CitedSourceDTO } from "@/shared/api";
import { MessageScrollerItem } from "@/shared/ui/message-scroller";
import { AssistantMessage } from "./assistant-message";
import { UserMessage } from "./user-message";

export interface ChatMessageListProps {
  messages: UIMessage[];
  citedSourcesMap: Map<string, CitedSourceDTO[]>;
  isThinking: boolean;
  onCopy: (text: string) => void;
  onRegenerate: () => void;
}

export function ChatMessageList({
  messages,
  citedSourcesMap,
  isThinking,
  onCopy,
  onRegenerate,
}: ChatMessageListProps) {
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
      {messages.map((message, index) => (
        <MessageScrollerItem
          key={message.id}
          messageId={message.id}
          scrollAnchor={message.id === lastUserMessageId}
        >
          <MessageBubble
            message={message}
            citedSources={citedSourcesMap.get(message.id) ?? []}
            onCopy={onCopy}
            onRegenerate={onRegenerate}
            isLast={index === messages.length - 1}
          />
        </MessageScrollerItem>
      ))}
      {isThinking && (
        <MessageScrollerItem messageId="thinking-indicator">
          <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Thinking...</span>
          </div>
        </MessageScrollerItem>
      )}
    </>
  );
}

interface MessageBubbleProps {
  message: UIMessage;
  citedSources: CitedSourceDTO[];
  onCopy: (text: string) => void;
  onRegenerate: () => void;
  isLast: boolean;
}

function MessageBubble({
  message,
  citedSources,
  onCopy,
  onRegenerate,
  isLast,
}: MessageBubbleProps) {
  if (message.role === "user") {
    return <UserMessage message={message} />;
  }

  return (
    <AssistantMessage
      message={message}
      citedSources={citedSources}
      onCopy={onCopy}
      onRegenerate={onRegenerate}
      showRegenerate={isLast}
    />
  );
}
