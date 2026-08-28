import type { UIMessage } from "ai";
import { DownloadIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { useCallback } from "react";
import { cn } from "@/shared/lib/utils";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/shared/ui/message-scroller";
import { Button } from "@/shared/ui/button";

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
  title = "No messages yet",
  description = "Start a conversation to see messages here",
  icon,
  children,
  ...props
}: ConversationEmptyStateProps) => (
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
          <h3 className="font-medium text-sm">{title}</h3>
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </div>
      </>
    )}
  </div>
);

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

const getMessageText = (message: UIMessage): string =>
  message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");

export type ConversationDownloadProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  messages: UIMessage[];
  filename?: string;
  formatMessage?: (message: UIMessage, index: number) => string;
};

const defaultFormatMessage = (message: UIMessage): string => {
  const roleLabel = message.role.charAt(0).toUpperCase() + message.role.slice(1);
  return `**${roleLabel}:** ${getMessageText(message)}`;
};

export const messagesToMarkdown = (
  messages: UIMessage[],
  formatMessage: (message: UIMessage, index: number) => string = defaultFormatMessage,
): string => messages.map((msg, i) => formatMessage(msg, i)).join("\n\n");

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
