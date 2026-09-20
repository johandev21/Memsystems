import type { UIMessage } from "@ai-sdk/react";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Message,
  MessageContent,
  MessageResponse,
  type MessageResponseProps,
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/features/ai";
import { cn } from "@/shared/utils/cn";
import type { CitedSourceDTO } from "../api/chat";
import { getReferenceKeyFromHref, prepareReferenceMessage } from "../types/message-reference.types";
import { MessageReferences, ReferencePopover } from "./reference-popover";

export interface AssistantMessageProps {
  message?: UIMessage;
  versions?: UIMessage[];
  citedSources?: CitedSourceDTO[];
  citedSourcesMap?: Map<string, CitedSourceDTO[]>;
  onCopy: (text: string) => void;
  onRegenerate: () => void;
  showRegenerate?: boolean;
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

  if (!activeMessage || content.isEmpty) return <EmptyAssistantMessage />;

  const hasMultipleVersions = versionList.length > 1;

  const handleCopy = () => {
    onCopy(content.fullPlainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Message from="assistant">
      <MessageContent>
        <AssistantReasoning content={content} />
        <AssistantResponses messageId={activeMessage.id} content={content} />
        {!content.isStreaming && <MessageReferences references={content.remainingReferences} />}
      </MessageContent>

      {!content.isStreaming && (
        <div className="mt-2 flex w-full items-center justify-between gap-3 text-text-tertiary">
          {hasMultipleVersions ? (
            <div className="flex items-center gap-1 text-xs text-text-faint select-none">
              <button
                type="button"
                disabled={activeIndex === 0}
                onClick={() => setSelectedVersionIndex((i) => Math.max(0, i - 1))}
                className="flex size-6 items-center justify-center rounded-md transition-colors hover:bg-surface-2 hover:text-text-primary disabled:pointer-events-none disabled:opacity-30 cursor-pointer active:scale-95"
                aria-label={t("assistant.previousVersion")}
              >
                <ChevronLeftIcon className="size-3.5" />
              </button>
              <span className="min-w-[3.25rem] text-center text-xs font-medium">
                {t("assistant.branchPage", {
                  current: activeIndex + 1,
                  total: versionList.length,
                })}
              </span>
              <button
                type="button"
                disabled={activeIndex === versionList.length - 1}
                onClick={() =>
                  setSelectedVersionIndex((i) => Math.min(versionList.length - 1, i + 1))
                }
                className="flex size-6 items-center justify-center rounded-md transition-colors hover:bg-surface-2 hover:text-text-primary disabled:pointer-events-none disabled:opacity-30 cursor-pointer active:scale-95"
                aria-label={t("assistant.nextVersion")}
              >
                <ChevronRightIcon className="size-3.5" />
              </button>
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-1">
            {showRegenerate && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      disabled={content.isStreaming}
                      onClick={onRegenerate}
                      className="flex size-7 items-center justify-center rounded-lg transition-colors hover:bg-surface-2 hover:text-text-primary disabled:opacity-40 cursor-pointer active:scale-95"
                      aria-label={t("assistant.regenerateResponse")}
                    >
                      <RotateCcwIcon
                        className={cn("size-3.5", content.isStreaming && "animate-spin")}
                      />
                    </button>
                  }
                />
                <TooltipContent>{t("assistant.regenerateResponse")}</TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex size-7 items-center justify-center rounded-lg transition-colors hover:bg-surface-2 hover:text-text-primary cursor-pointer active:scale-95"
                    aria-label={t("assistant.copyMessage")}
                  >
                    {copied ? (
                      <CheckIcon className="size-3.5 text-primary" />
                    ) : (
                      <CopyIcon className="size-3.5" />
                    )}
                  </button>
                }
              />
              <TooltipContent>
                {copied ? t("assistant.copied") : t("assistant.copyMessage")}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
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
  // Live = any part still streaming. Reasoning-only phases (no text yet)
  // must count as streaming, otherwise the Reasoning header never shows its
  // live "Thinking..." state.
  const isStreaming = hasStreamingText || hasStreamingReasoning;
  // Reasoning is "live" only while it streams and no answer text streams yet.
  // Once text starts, the answer takes over and reasoning collapses to done.
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
          if (reference)
            return <ReferencePopover reference={reference}>{children}</ReferencePopover>;
          // Unknown citation key (e.g. model hallucinated R9 or live message
          // before history refetch): render plain number text instead of a
          // dead `#reference-*` fragment link or raw markdown.
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
  return {
    isEmpty: textParts.length === 0 && reasoningText.length === 0,
    isReasoningStreaming,
    isStreaming,
    messageComponents,
    preparedParts,
    reasoningText,
    fullPlainText,
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
  return content.preparedParts.map((part) => (
    <MessageResponse
      key={`${messageId}-${part.markdown}`}
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
