import type { UIMessage } from "@ai-sdk/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Message,
  MessageContent,
  MessageResponse,
  type MessageResponseProps,
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/features/ai";
import type { CitedSourceDTO } from "../api/chat";
import { noEvidenceMetadataOf } from "../types/no-evidence.types";
import { getReferenceKeyFromHref, prepareReferenceMessage } from "../types/message-reference.types";
import { isMessageCancelled } from "../types/chat-turn.types";
import { CitationChipRow, CitationHoverCard } from "@/shared/citations/citation-hover-card";
import { NoEvidencePanel } from "./no-evidence-message";
import { AssistantActionToolbar } from "./assistant-action-toolbar";
import { cn } from "@/shared/utils/cn";

export { AssistantVersionControls } from "./assistant-version-controls";
export type { AssistantVersionControlsProps } from "./assistant-version-controls";
export { AssistantActionToolbar } from "./assistant-action-toolbar";
export type { AssistantActionToolbarProps } from "./assistant-action-toolbar";

export interface AssistantMessageProps {
  message?: UIMessage;
  versions?: UIMessage[];
  citedSources?: CitedSourceDTO[];
  citedSourcesMap?: Map<string, CitedSourceDTO[]>;
  onCopy: (text: string) => void;
  onRegenerate: () => void;
  showRegenerate?: boolean;
  onContinue?: () => void;
  showContinue?: boolean;
}

type TextPart = { type: "text"; text: string; state?: "streaming" | "done" };
type ReasoningPart = { type: "reasoning"; text: string; state?: "streaming" | "done" };

function isTextPart(part: UIMessage["parts"][number]): part is TextPart {
  const candidate = part as unknown as TextPart;
  return candidate.type === "text" && typeof candidate.text === "string";
}

function isReasoningPart(part: UIMessage["parts"][number]): part is ReasoningPart {
  const candidate = part as unknown as ReasoningPart;
  return candidate.type === "reasoning" && typeof candidate.text === "string";
}

function isLivePart(part: TextPart | ReasoningPart): boolean {
  return part.state === "streaming";
}

function getReasoningText(parts: UIMessage["parts"]): string {
  return parts
    .filter((p): p is { type: "reasoning"; text: string } => p.type === "reasoning")
    .map((p) => p.text)
    .join("\n\n");
}

type MessageComponents = NonNullable<MessageResponseProps["components"]>;

export function AssistantMessage({
  message,
  versions,
  citedSources,
  citedSourcesMap,
  onCopy,
  onRegenerate,
  showRegenerate = true,
  onContinue,
  showContinue = false,
}: AssistantMessageProps) {
  const { t } = useTranslation("chat");
  const versionList = useMemo(() => {
    if (versions && versions.length > 0) return versions;
    if (message) return [message];
    return [];
  }, [versions, message]);

  const [selectedVersionIndex, setSelectedVersionIndex] = useState<number>(() =>
    Math.max(0, versionList.length - 1),
  );
  const [copied, setCopied] = useState(false);

  const prevLengthRef = useRef(versionList.length);
  useEffect(() => {
    if (versionList.length > prevLengthRef.current) {
      setSelectedVersionIndex(versionList.length - 1);
    }
    prevLengthRef.current = versionList.length;
  }, [versionList.length]);

  const activeIndex = Math.min(
    Math.max(0, selectedVersionIndex),
    Math.max(0, versionList.length - 1),
  );
  const activeMessage = versionList[activeIndex];

  const activeCitations = useMemo(() => {
    if (!activeMessage) return [];
    if (citedSourcesMap) {
      return citedSourcesMap.get(activeMessage.id) ?? [];
    }
    return citedSources ?? [];
  }, [activeMessage, citedSourcesMap, citedSources]);

  const content = useAssistantMessageContent(activeMessage, activeCitations);
  const isCancelled = isMessageCancelled(activeMessage?.metadata);

  if (!activeMessage || (content.isEmpty && !isCancelled)) return <EmptyAssistantMessage />;

  const hasMultipleVersions = versionList.length > 1;

  const handleCopy = () => {
    onCopy(content.fullPlainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Message
      className={cn(
        !content.isStreaming && "[content-visibility:auto] [contain-intrinsic-size:auto_100px]",
      )}
      from="assistant"
    >
      <span className="sr-only">{t("sender.assistant")}</span>
      <MessageContent>
        {content.noEvidence ? (
          <NoEvidencePanel metadata={content.noEvidence} />
        ) : (
          <>
            <AssistantReasoning content={content} />
            <AssistantResponses messageId={activeMessage.id} content={content} />
            {!content.isStreaming && <CitationChipRow references={content.remainingReferences} />}
          </>
        )}
        {isCancelled && !content.isStreaming && (
          <p className="text-xs text-text-tertiary select-none">{t("status.stopped")}</p>
        )}
      </MessageContent>

      {!content.isStreaming && (
        <AssistantActionToolbar
          totalVersions={versionList.length}
          activeIndex={activeIndex}
          hasMultipleVersions={hasMultipleVersions}
          onPreviousVersion={() => setSelectedVersionIndex((i) => Math.max(0, i - 1))}
          onNextVersion={() =>
            setSelectedVersionIndex((i) => Math.min(versionList.length - 1, i + 1))
          }
          onCopy={handleCopy}
          onRegenerate={onRegenerate}
          showRegenerate={showRegenerate}
          onContinue={onContinue}
          showContinue={Boolean(showContinue && isCancelled)}
          isStreaming={content.isStreaming}
          copied={copied}
        />
      )}
    </Message>
  );
}

function useAssistantMessageContent(
  message: UIMessage | undefined,
  citedSources: CitedSourceDTO[],
) {
  const parts = message?.parts ?? [];
  const hasStreamingText = parts.some((part) => isTextPart(part) && isLivePart(part));
  const hasStreamingReasoning = parts.some((part) => isReasoningPart(part) && isLivePart(part));
  const isStreaming = hasStreamingText || hasStreamingReasoning;
  const isReasoningStreaming = hasStreamingReasoning && !hasStreamingText;
  const reasoningText = getReasoningText(parts);
  const textParts = parts.filter(isTextPart);
  const referencesByKey = useMemo(
    () => new Map(citedSources.map((source) => [source.citationKey.toUpperCase(), source])),
    [citedSources],
  );
  const messageComponents = useMemo<MessageComponents>(
    () => ({
      a: ({ href, children, ...props }) => {
        const referenceKey = getReferenceKeyFromHref(href);
        if (referenceKey) {
          const reference = referencesByKey.get(referenceKey.toUpperCase());
          if (reference) return <CitationHoverCard reference={reference}>{children}</CitationHoverCard>;
          return <span className="font-medium text-muted-foreground">{children}</span>;
        }
        return (
          <a
            {...props}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-muted-foreground underline decoration-1 underline-offset-2 transition-colors hover:text-foreground focus-visible:text-foreground"
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
  const fullPlainText = textParts.map((part) => part.text).join("\n\n");
  const noEvidence = noEvidenceMetadataOf(message?.metadata);
  return {
    isEmpty: textParts.length === 0 && reasoningText.length === 0,
    isReasoningStreaming,
    isStreaming,
    messageComponents,
    preparedParts,
    reasoningText,
    fullPlainText,
    noEvidence,
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
  const { t } = useTranslation("chat");
  return (
    <Message
      className="[content-visibility:auto] [contain-intrinsic-size:auto_100px]"
      from="assistant"
    >
      <span className="sr-only">{t("sender.assistant")}</span>
      <MessageContent>
        <MessageResponse> </MessageResponse>
      </MessageContent>
    </Message>
  );
}
