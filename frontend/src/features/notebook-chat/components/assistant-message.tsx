import type { UIMessage } from "@ai-sdk/react";
import { useMemo } from "react";
import {
  Message,
  MessageContent,
  MessageResponse,
  type MessageResponseProps,
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/features/ai";
import type { CitedSourceDTO } from "@/shared/api";
import { getReferenceKeyFromHref, prepareReferenceMessage } from "../model/message-reference";
import { MessageReferences, ReferencePopover } from "./reference-popover";

interface AssistantMessageProps {
  message: UIMessage;
  citedSources: CitedSourceDTO[];
  onCopy: (text: string) => void;
  onRegenerate: () => void;
  showRegenerate: boolean;
}

type TextPart = { type: "text"; text: string; state?: "streaming" | "done" };

function isTextPart(part: UIMessage["parts"][number]): part is TextPart {
  const candidate = part as unknown as TextPart;
  return candidate.type === "text" && typeof candidate.text === "string";
}

function getReasoningText(parts: UIMessage["parts"]): string {
  return parts
    .filter((p): p is { type: "reasoning"; text: string } => p.type === "reasoning")
    .map((p) => p.text)
    .join("\n\n");
}

type MessageComponents = NonNullable<MessageResponseProps["components"]>;

export function AssistantMessage({ message, citedSources }: AssistantMessageProps) {
  const content = useAssistantMessageContent(message, citedSources);
  if (content.isEmpty) return <EmptyAssistantMessage />;

  return (
    <Message from="assistant">
      <MessageContent>
        <AssistantReasoning content={content} />
        <AssistantResponses messageId={message.id} content={content} />
        {!content.isStreaming && <MessageReferences references={content.remainingReferences} />}
      </MessageContent>
    </Message>
  );
}

function useAssistantMessageContent(message: UIMessage, citedSources: CitedSourceDTO[]) {
  const isStreaming = message.parts.some((part) => isTextPart(part) && part.state === "streaming");
  const reasoningText = getReasoningText(message.parts);
  const textParts = message.parts.filter(isTextPart);
  const referencesByKey = useMemo(
    () => new Map(citedSources.map((source) => [source.citationKey.toUpperCase(), source])),
    [citedSources],
  );
  const messageComponents = useMemo<MessageComponents>(
    () => ({
      a: ({ href, children, ...props }) => {
        const referenceKey = getReferenceKeyFromHref(href);
        const reference = referenceKey
          ? referencesByKey.get(referenceKey.toUpperCase())
          : undefined;
        if (reference) return <ReferencePopover reference={reference}>{children}</ReferencePopover>;
        return (
          <a
            {...props}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-muted-foreground underline decoration-1 underline-offset-[3px] transition-colors hover:text-foreground focus-visible:text-foreground"
          >
            {children}
          </a>
        );
      },
    }),
    [referencesByKey],
  );
  const preparedParts = textParts.map((part) =>
    prepareReferenceMessage(part.text, citedSources, isStreaming),
  );
  const inlineCitationKeys = new Set(preparedParts.flatMap((part) => [...part.inlineCitationKeys]));
  return {
    isEmpty: textParts.length === 0 && reasoningText.length === 0,
    isReasoningStreaming: isStreaming && message.parts.at(-1)?.type === "reasoning",
    isStreaming,
    messageComponents,
    preparedParts,
    reasoningText,
    remainingReferences: citedSources.filter(
      (source) => !inlineCitationKeys.has(source.citationKey),
    ),
  };
}

function AssistantReasoning({
  content,
}: {
  content: ReturnType<typeof useAssistantMessageContent>;
}) {
  if (!content.reasoningText) return null;
  return (
    <Reasoning isStreaming={content.isReasoningStreaming}>
      <ReasoningTrigger />
      <ReasoningContent>{content.reasoningText}</ReasoningContent>
    </Reasoning>
  );
}

function AssistantResponses({
  messageId,
  content,
}: {
  messageId: string;
  content: ReturnType<typeof useAssistantMessageContent>;
}) {
  return content.preparedParts.map((part, index) => (
    <MessageResponse
      key={`${messageId}-${index}`}
      components={content.messageComponents}
      isStreaming={content.isStreaming}
    >
      {part.markdown}
    </MessageResponse>
  ));
}

function EmptyAssistantMessage() {
  return (
    <Message from="assistant">
      <MessageContent>
        <MessageResponse> </MessageResponse>
      </MessageContent>
    </Message>
  );
}
