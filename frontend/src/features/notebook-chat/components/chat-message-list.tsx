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
  /**
   * True only while the request is in flight AND no assistant content
   * (reasoning or text) has streamed yet. Never true once the first
   * reasoning/text part arrives — the live Reasoning block / answer takes over.
   */
  showPendingIndicator: boolean;
  /** Truthful copy for the pending phase, e.g. "Thinking…" vs "Waiting…". */
  pendingLabel?: string;
  /**
   * Id of the user message that is allowed to pull the viewport. Only set for
   * messages sent during this session; hydrated history leaves it null so the
   * conversation opens at the banner instead of jumping to the last turn.
   */
  anchorMessageId?: string | null;
  error?: Error | null;
  onCopy: (text: string) => void;
  onRegenerate: () => void;
}

function entranceStyle(index: number): CSSProperties | undefined {
  const delay = chatEntranceDelay(index);
  return delay > 0 ? { animationDelay: `${delay}ms` } : undefined;
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
}: ChatMessageListProps) {
  const { t } = useTranslation("chat");
  const turns = useMemo(() => groupMessagesIntoTurns(messages), [messages]);
  const resolvedPendingLabel = pendingLabel ?? t("pending.waiting");

  return (
    <>
      {turns.map((turn, index) => {
        const isLast = index === turns.length - 1;
        const animateStyle = entranceStyle(index);
        if (turn.type === "user") {
          return (
            <MessageScrollerItem
              key={turn.id}
              messageId={turn.id}
              scrollAnchor={turn.id === anchorMessageId}
            >
              <div className={CHAT_ENTRANCE_CLASS} style={animateStyle}>
                <UserMessage message={turn.message} />
              </div>
            </MessageScrollerItem>
          );
        }

        return (
          <MessageScrollerItem key={turn.id} messageId={turn.id}>
            <div className={CHAT_ENTRANCE_CLASS} style={animateStyle}>
              <AssistantMessage
                versions={turn.versions}
                citedSourcesMap={citedSourcesMap}
                onCopy={onCopy}
                onRegenerate={onRegenerate}
                showRegenerate={isLast}
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
          <ChatErrorCard message={error.message} onRegenerate={onRegenerate} />
        </MessageScrollerItem>
      )}
    </>
  );
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
