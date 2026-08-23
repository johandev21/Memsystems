import type { UIMessage } from "@ai-sdk/react";
import { Loader2 } from "lucide-react";
import type { CitedSourceDTO } from "@/shared/api";
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
  return (
    <>
      {messages.map((message, index) => {
        const isLast = index === messages.length - 1;
        const citedSources = citedSourcesMap.get(message.id) ?? [];
        return (
          <MessageBubble
            key={message.id}
            message={message}
            citedSources={citedSources}
            onCopy={onCopy}
            onRegenerate={onRegenerate}
            isLast={isLast}
          />
        );
      })}
      {isThinking && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Thinking...</span>
        </div>
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
