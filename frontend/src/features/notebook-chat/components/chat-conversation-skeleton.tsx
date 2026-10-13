import { Skeleton } from "@/components/ui/skeleton";

export interface ChatConversationSkeletonProps {
  withBanner?: boolean;
}

export function ChatConversationSkeleton({ withBanner = false }: ChatConversationSkeletonProps) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-8" data-testid="chat-history-skeleton">
      {withBanner && (
        <div className="aspect-3/1 w-full overflow-hidden rounded-4xl border border-border bg-muted">
          <Skeleton className="size-full rounded-none" />
        </div>
      )}
      <div className="flex flex-col gap-4">
        <Skeleton className="ms-auto h-9 w-2/3 max-w-md" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/5" />
        </div>
      </div>
    </div>
  );
}
