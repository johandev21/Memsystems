import type { UIMessage } from "ai";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { ComponentProps, HTMLAttributes, ReactElement } from "react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { cn } from "@/shared/utils/cn";
import { MarkdownRenderer, type MarkdownRendererProps } from "@/components/ui/markdown";
import { MarkdownCodeBlock } from "./markdown-code-block";
import { MarkdownTable } from "./markdown-table";
import { MessageBranchContext, useMessageBranch } from "./message-branch-context";
import type { MessageBranchContextType } from "./message-branch-context";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"];
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full max-w-19/20 flex-col gap-2",
      from === "user" && "ml-auto justify-end",
      className,
    )}
    data-role={from}
    {...props}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({ children, className, ...props }: MessageContentProps) => (
  <div
    className={cn(
      "flex w-fit min-w-0 max-w-full flex-col gap-2 overflow-hidden text-sm",
      "group-data-[role=user]:ml-auto group-data-[role=user]:rounded-2xl group-data-[role=user]:bg-primary group-data-[role=user]:px-4 group-data-[role=user]:py-3 group-data-[role=user]:text-primary-foreground group-data-[role=user]:[--selection-background:var(--primary-foreground)] group-data-[role=user]:[--selection-foreground:var(--primary)] group-data-[role=user]:[--color-foreground:var(--primary-foreground)] group-data-[role=user]:[--color-muted-foreground:color-mix(in_oklab,var(--primary-foreground)_60%,transparent)] group-data-[role=user]:[--color-border:color-mix(in_oklab,var(--primary-foreground)_20%,transparent)] group-data-[role=user]:[--color-muted:color-mix(in_oklab,var(--primary-foreground)_8%,transparent)] group-data-[role=user]:[--color-ring:var(--primary-foreground)] group-data-[role=user]:[&_.typeset]:text-primary-foreground",
      "group-data-[role=assistant]:text-foreground",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export type MessageActionsProps = ComponentProps<"div">;

export const MessageActions = ({ className, children, ...props }: MessageActionsProps) => (
  <div className={cn("flex items-center gap-1", className)} {...props}>
    {children}
  </div>
);

export type MessageActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
};

export const MessageAction = ({
  tooltip,
  children,
  label,
  variant = "ghost",
  size = "icon-sm",
  ...props
}: MessageActionProps) => (
  <Button size={size} type="button" variant={variant} {...props}>
    {children}
    <span className="sr-only">{label || tooltip}</span>
  </Button>
);

export type MessageBranchProps = HTMLAttributes<HTMLDivElement> & {
  defaultBranch?: number;
  onBranchChange?: (branchIndex: number) => void;
};

export const MessageBranch = ({
  defaultBranch = 0,
  onBranchChange,
  className,
  ...props
}: MessageBranchProps) => {
  const [currentBranch, setCurrentBranch] = useState(defaultBranch);
  const [branches, setBranches] = useState<ReactElement[]>([]);

  const handleBranchChange = useCallback(
    (newBranch: number) => {
      setCurrentBranch(newBranch);
      onBranchChange?.(newBranch);
    },
    [onBranchChange],
  );

  const goToPrevious = useCallback(() => {
    const newBranch = currentBranch > 0 ? currentBranch - 1 : branches.length - 1;
    handleBranchChange(newBranch);
  }, [currentBranch, branches.length, handleBranchChange]);

  const goToNext = useCallback(() => {
    const newBranch = currentBranch < branches.length - 1 ? currentBranch + 1 : 0;
    handleBranchChange(newBranch);
  }, [currentBranch, branches.length, handleBranchChange]);

  const contextValue = useMemo<MessageBranchContextType>(
    () => ({
      branches,
      currentBranch,
      goToNext,
      goToPrevious,
      setBranches,
      totalBranches: branches.length,
    }),
    [branches, currentBranch, goToNext, goToPrevious],
  );

  return (
    <MessageBranchContext.Provider value={contextValue}>
      <div className={cn("grid w-full gap-2 [&>div]:pb-0", className)} {...props} />
    </MessageBranchContext.Provider>
  );
};

export type MessageBranchContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageBranchContent = ({ children, ...props }: MessageBranchContentProps) => {
  const { currentBranch, setBranches, branches } = useMessageBranch();
  const childrenArray = useMemo(
    () => (Array.isArray(children) ? children : [children]),
    [children],
  );

  useEffect(() => {
    if (branches.length !== childrenArray.length) {
      setBranches(childrenArray);
    }
  }, [childrenArray, branches, setBranches]);

  return (
    <>
      {childrenArray.map((branch, index) => (
        <div
          className={cn(
            "grid gap-2 overflow-hidden [&>div]:pb-0",
            index === currentBranch ? "block" : "hidden",
          )}
          key={branch.key}
          {...props}
        >
          {branch}
        </div>
      ))}
    </>
  );
};

export type MessageBranchSelectorProps = ComponentProps<typeof ButtonGroup>;

export const MessageBranchSelector = ({ className, ...props }: MessageBranchSelectorProps) => {
  const { totalBranches } = useMessageBranch();

  if (totalBranches <= 1) {
    return null;
  }

  return (
    <ButtonGroup
      className={cn(
        "[&>*:not(:first-child)]:rounded-l-md [&>*:not(:last-child)]:rounded-r-md",
        className,
      )}
      orientation="horizontal"
      {...props}
    />
  );
};

export type MessageBranchPreviousProps = ComponentProps<typeof Button>;

export const MessageBranchPrevious = ({ children, ...props }: MessageBranchPreviousProps) => {
  const { t } = useTranslation("ai");
  const { goToPrevious, totalBranches } = useMessageBranch();

  return (
    <Button
      aria-label={t("message.previousBranch")}
      disabled={totalBranches <= 1}
      onClick={goToPrevious}
      size="icon-sm"
      type="button"
      variant="ghost"
      {...props}
    >
      {children ?? <ChevronLeftIcon size={14} />}
    </Button>
  );
};

export type MessageBranchNextProps = ComponentProps<typeof Button>;

export const MessageBranchNext = ({ children, ...props }: MessageBranchNextProps) => {
  const { t } = useTranslation("ai");
  const { goToNext, totalBranches } = useMessageBranch();

  return (
    <Button
      aria-label={t("message.nextBranch")}
      disabled={totalBranches <= 1}
      onClick={goToNext}
      size="icon-sm"
      type="button"
      variant="ghost"
      {...props}
    >
      {children ?? <ChevronRightIcon size={14} />}
    </Button>
  );
};

export type MessageBranchPageProps = HTMLAttributes<HTMLSpanElement>;

export const MessageBranchPage = ({ className, ...props }: MessageBranchPageProps) => {
  const { t } = useTranslation("ai");
  const { currentBranch, totalBranches } = useMessageBranch();

  return (
    <ButtonGroupText
      className={cn("border-none bg-transparent text-muted-foreground shadow-none", className)}
      {...props}
    >
      {t("message.branchPage", { current: currentBranch + 1, total: totalBranches })}
    </ButtonGroupText>
  );
};

export type MessageResponseProps = MarkdownRendererProps;

export const MessageResponse = memo(
  ({ className, components, isStreaming, ...props }: MessageResponseProps) => {
    const mergedComponents = useMemo(
      () => ({
        code: MarkdownCodeBlock,
        table: MarkdownTable,
        ...components,
      }),
      [components],
    );

    return (
      <MarkdownRenderer
        className={cn(
          "typeset typeset-chat size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          className,
        )}
        isStreaming={isStreaming}
        components={mergedComponents}
        trailingContent={
          <span
            aria-hidden="true"
            className="block h-0 overflow-hidden text-xs leading-none select-text"
            data-slot="message-response-selection-boundary"
          >
            {"\u200B"}
          </span>
        }
        {...props}
      />
    );
  },
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.isStreaming === nextProps.isStreaming &&
    nextProps.className === prevProps.className &&
    prevProps.components === nextProps.components,
);

MessageResponse.displayName = "MessageResponse";

export type MessageToolbarProps = ComponentProps<"div">;

export const MessageToolbar = ({ className, children, ...props }: MessageToolbarProps) => (
  <div className={cn("mt-4 flex w-full items-center justify-between gap-4", className)} {...props}>
    {children}
  </div>
);
