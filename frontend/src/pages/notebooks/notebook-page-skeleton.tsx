import type { ReactNode } from "react";
import { Logo, SettingsLink } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
// Direct import: the @/features/notebook-chat barrel pulls the AI SDK and the
// composer graph into the pending chunk; only the placeholder is needed here.
import { ChatConversationSkeleton } from "@/features/notebook-chat/components/chat-conversation-skeleton";
import { cn } from "@/shared/utils/cn";

function NotebookHeaderSkeleton() {
  return (
    <header className="flex h-11 sm:h-12 items-center justify-between px-3 sm:px-4 lg:px-6 bg-background shrink-0 gap-2">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <Logo className="size-6 text-foreground" />
        <span className="hidden sm:inline text-muted-foreground/40 font-mono text-xs select-none shrink-0">
          /
        </span>
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="shrink-0">
        <SettingsLink />
      </div>
    </header>
  );
}

function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "overflow-hidden shadow-sm dark:shadow-none rounded-panel border border-border/80 bg-card",
        className,
      )}
    >
      <div className="flex flex-col h-full min-w-0 overflow-hidden bg-panel-bg">{children}</div>
    </div>
  );
}

function PanelHeaderSkeleton() {
  return (
    <header className="flex items-center justify-between p-1.5 bg-panel-header-bg min-h-11">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-7 w-7 rounded-md" />
    </header>
  );
}

function SourcesPanelSkeleton() {
  return (
    <>
      <PanelHeaderSkeleton />
      <div className="flex flex-col gap-2 p-2" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-full rounded-lg" />
        ))}
      </div>
    </>
  );
}

function StudioPanelSkeleton() {
  return (
    <>
      <PanelHeaderSkeleton />
      <div className="flex flex-col gap-2 p-2" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5, 6].map((index) => (
          <Skeleton
            key={index}
            className={cn("h-3.5", index % 3 === 2 ? "w-3/5" : index % 2 === 0 ? "w-4/5" : "w-2/3")}
          />
        ))}
      </div>
    </>
  );
}

function ChatBodySkeleton() {
  return (
    <div className="flex-1 min-h-0 overflow-hidden p-4">
      <div className="mx-auto w-full max-w-4xl">
        <ChatConversationSkeleton withBanner />
      </div>
    </div>
  );
}

export function NotebookPageSkeleton() {
  return (
    <div className="flex h-dvh flex-col">
      <NotebookHeaderSkeleton />
      <div className="flex-1 mx-0 sm:mx-2 lg:mx-4 my-0 sm:my-2 scrollbar-none overflow-hidden">
        <div className="hidden lg:flex h-full gap-2.5">
          <Panel className="w-1/5">
            <SourcesPanelSkeleton />
          </Panel>
          <Panel className="flex-1">
            <PanelHeaderSkeleton />
            <ChatBodySkeleton />
          </Panel>
          <Panel className="w-1/5">
            <StudioPanelSkeleton />
          </Panel>
        </div>
        <div className="lg:hidden h-full flex flex-col">
          <div className="flex items-center gap-2 p-2" aria-hidden="true">
            <Skeleton className="h-8 flex-1 rounded-lg" />
            <Skeleton className="h-8 flex-1 rounded-lg" />
            <Skeleton className="h-8 flex-1 rounded-lg" />
          </div>
          <ChatBodySkeleton />
        </div>
      </div>
    </div>
  );
}
