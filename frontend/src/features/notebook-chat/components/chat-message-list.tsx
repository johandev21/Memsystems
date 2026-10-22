import type { UIMessage } from "@ai-sdk/react";
import { ExternalLink, Loader2, RotateCcw, Settings2 } from "lucide-react";
import { useMemo, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { CitedSourceDTO } from "../api/chat";
import { MessageScrollerItem } from "@/components/ui/message-scroller";
import { AssistantMessage } from "./assistant-message";
import { UserMessage } from "./user-message";
import { groupMessagesIntoTurns } from "../types/chat-turn.types";
import { GATEWAY_TOP_UP_URL, classifyChatError } from "../utils/chat-error";
import { CHAT_ENTRANCE_CLASS, chatEntranceDelay } from "../utils/chat-entrance";

export interface ChatMessageListProps {
  messages: UIMessage[];
  citedSourcesMap: Map<string, CitedSourceDTO[]>;
  showPendingIndicator: boolean;
  pendingLabel?: string;
  anchorMessageId?: string | null;
  error?: Error | null;
  onCopy: (text: string) => void | boolean | Promise<void | boolean>;
  onRegenerate: (messageId?: string) => void;
  onContinue?: () => void;
  isLoading?: boolean;
  allBranchMessages?: UIMessage[];
  onEdit?: (message: UIMessage, text: string) => void;
  onSelectBranch?: (messageId: string) => void;
}

export function ChatMessageList({
  messages,
  citedSourcesMap,
  showPendingIndicator,
  pendingLabel,
  anchorMessageId,
  error,
  onCopy,
  onRegenerate,
  onContinue,
  isLoading = false,
  allBranchMessages = messages,
  onEdit,
  onSelectBranch,
}: ChatMessageListProps) {
  const { t } = useTranslation("chat");
  const turns = useMemo(() => groupMessagesIntoTurns(messages), [messages]);
  const resolvedPendingLabel = pendingLabel ?? t("pending.waiting");

  return (
    <>
      {turns.map((turn, index) => {
        const isLast = index === turns.length - 1;
        const delay = chatEntranceDelay(index);
        const animateStyle =
          delay > 0 ? ({ "--chat-delay": `${delay}ms` } as CSSProperties) : undefined;
        if (turn.type === "user") {
          const parentId = (turn.message.metadata as { parentId?: string | null } | undefined)?.parentId ?? null;
          const siblings = getSiblingMessages(allBranchMessages, "user", parentId);
          return (
            <MessageScrollerItem
              key={turn.id}
              messageId={turn.id}
              scrollAnchor={Boolean(anchorMessageId && turn.id === anchorMessageId)}
            >
              <div className={CHAT_ENTRANCE_CLASS} style={animateStyle}>
                <UserMessage message={turn.message} siblingMessages={siblings} disabled={isLoading} onEdit={onEdit} onCopy={onCopy} onSelectBranch={onSelectBranch} />
              </div>
            </MessageScrollerItem>
          );
        }

        const activeAssistant = turn.versions.at(-1);
        const assistantParentId = (activeAssistant?.metadata as { parentId?: string | null } | undefined)?.parentId ?? null;
        const assistantSiblings = getSiblingMessages(allBranchMessages, "assistant", assistantParentId);

        return (
          <MessageScrollerItem key={turn.id} messageId={turn.id}>
            <div className={CHAT_ENTRANCE_CLASS} style={animateStyle}>
              <AssistantMessage
                isLast={isLast}
                message={activeAssistant}
                versions={assistantSiblings.length > 0 ? assistantSiblings : turn.versions}
                citedSourcesMap={citedSourcesMap}
                onCopy={onCopy}
                onRegenerate={() => onRegenerate(activeAssistant?.id)}
                onSelectVersion={onSelectBranch}
                isInteractionDisabled={isLoading}
                showRegenerate={isLast}
                onContinue={onContinue}
                showContinue={isLast && !isLoading}
              />
            </div>
          </MessageScrollerItem>
        );
      })}
      {showPendingIndicator && (
        <MessageScrollerItem messageId="thinking-indicator">
          <div
            role="status"
            className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{resolvedPendingLabel}</span>
          </div>
        </MessageScrollerItem>
      )}
      {error && (
        <MessageScrollerItem messageId="chat-error-banner">
          <ChatErrorCard message={error.message} onRegenerate={() => onRegenerate()} />
        </MessageScrollerItem>
      )}
    </>
  );
}

function getSiblingMessages(
  messages: UIMessage[],
  role: UIMessage["role"],
  parentId: string | null,
): UIMessage[] {
  return messages
    .filter((message) => {
      const metadata = message.metadata as { parentId?: string | null } | undefined;
      return message.role === role && (metadata?.parentId ?? null) === parentId;
    })
    .sort((left, right) => {
      const leftIndex = (left.metadata as { siblingIndex?: number } | undefined)?.siblingIndex ?? 0;
      const rightIndex = (right.metadata as { siblingIndex?: number } | undefined)?.siblingIndex ?? 0;
      return leftIndex - rightIndex;
    });
}

function ChatErrorCard({ message, onRegenerate }: { message?: string; onRegenerate: () => void }) {
  const { t } = useTranslation("chat");
  const classified = useMemo(() => classifyChatError(message), [message]);

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
      <p className="font-semibold">{classified.title}</p>
      <p className="mt-1 leading-5 opacity-90">{classified.message}</p>
      {classified.showModelHint && (
        <p className="mt-1 leading-5 opacity-75">{t("errorCard.tip")}</p>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRegenerate}
          className="flex items-center gap-1 rounded-lg bg-destructive px-2.5 py-1 font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors cursor-pointer"
        >
          <RotateCcw className="size-3" />
          {t("errorCard.retry")}
        </button>
        {classified.showTopUp && (
          <a
            href={GATEWAY_TOP_UP_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-lg px-2 py-1 font-medium underline underline-offset-2 hover:opacity-80"
          >
            {t("errorCard.addCredits")}
            <ExternalLink className="size-3" />
          </a>
        )}
        {classified.showSettings && (
          <a
            href="/settings"
            className="flex items-center gap-1 rounded-lg px-2 py-1 font-medium underline underline-offset-2 hover:opacity-80"
          >
            <Settings2 className="size-3" />
            {t("errorCard.openSettings")}
          </a>
        )}
      </div>
    </div>
  );
}
