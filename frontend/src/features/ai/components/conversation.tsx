import { Button } from "@/components/ui/button";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { cn } from "@/shared/utils/cn";
import type { UIMessage } from "ai";
import { DownloadIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { defaultFormatMessage, messagesToMarkdown } from "./conversation-markdown";

export type ConversationProps = ComponentProps<typeof MessageScrollerProvider> & {
  className?: string;
};

export const Conversation = ({
  className,
  children,
  autoScroll = false,
  defaultScrollPosition = "last-anchor",
  scrollPreviousItemPeek = 64,
  ...props
}: ConversationProps) => (
  <MessageScrollerProvider
    autoScroll={autoScroll}
    defaultScrollPosition={defaultScrollPosition}
    scrollPreviousItemPeek={scrollPreviousItemPeek}
    {...props}
  >
    <MessageScroller className={cn("relative flex-1", className)}>{children}</MessageScroller>
  </MessageScrollerProvider>
);

export type ConversationContentProps = ComponentProps<typeof MessageScrollerContent>;

export const ConversationContent = ({
  className,
  children,
  ...props
}: ConversationContentProps) => (
  <MessageScrollerViewport>
    <MessageScrollerContent className={cn("flex flex-col gap-8 p-4", className)} {...props}>
      {children}
    </MessageScrollerContent>
  </MessageScrollerViewport>
);

export type ConversationItemProps = ComponentProps<typeof MessageScrollerItem>;
export const ConversationItem = MessageScrollerItem;

export type ConversationEmptyStateProps = ComponentProps<"div"> & {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
};

export const ConversationEmptyState = ({
  className,
  title,
  description,
  icon,
  children,
  ...props
}: ConversationEmptyStateProps) => {
  const { t } = useTranslation("ai");
  const resolvedTitle = title ?? t("conversation.emptyTitle");
  const resolvedDescription = description ?? t("conversation.emptyDescription");

  return (
    <div
      className={cn(
        "flex size-full flex-col items-center justify-center gap-3 p-8 text-center",
        className,
      )}
      {...props}
    >
      {children ?? (
        <>
          {icon && <div className="text-muted-foreground">{icon}</div>}
          <div className="space-y-1">
            <h3 className="font-medium text-sm">{resolvedTitle}</h3>
            {resolvedDescription && (
              <p className="text-muted-foreground text-sm">{resolvedDescription}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export type ConversationScrollButtonProps = ComponentProps<typeof MessageScrollerButton>;

export const ConversationScrollButton = ({
  className,
  variant = "outline",
  size = "icon",
  ...props
}: ConversationScrollButtonProps) => {
  return (
    <MessageScrollerButton
      className={cn(
        "liquid-glass absolute bottom-4 left-[50%] z-floating-control translate-x-[-50%] cursor-pointer rounded-full border-white/35 bg-background/85 shadow-[var(--composer-glow),0_4px_16px_rgb(0_0_0/0.12)] transition-[background-color,box-shadow,transform] hover:bg-background/95 hover:shadow-[var(--composer-glow),0_6px_20px_rgb(0_0_0/0.14)] dark:!border-white/10 dark:!bg-background/85 dark:hover:!bg-background/95",
        className,
      )}
      size={size}
      variant={variant}
      {...props}
    />
  );
};

export type ConversationDownloadProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  messages: UIMessage[];
  filename?: string;
  formatMessage?: (message: UIMessage, index: number) => string;
};

export const ConversationDownload = ({
  messages,
  filename = "conversation.md",
  formatMessage = defaultFormatMessage,
  className,
  children,
  ...props
}: ConversationDownloadProps) => {
  const handleDownload = useCallback(() => {
    const markdown = messagesToMarkdown(messages, formatMessage);
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [messages, filename, formatMessage]);

  return (
    <Button
      className={cn(
        "absolute top-4 right-4 rounded-full dark:bg-background dark:hover:bg-muted cursor-pointer",
        className,
      )}
      onClick={handleDownload}
      size="icon"
      type="button"
      variant="outline"
      {...props}
    >
      {children ?? <DownloadIcon className="size-4" />}
    </Button>
  );
};
