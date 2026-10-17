import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronRight, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/shared/utils/cn";
import { fetchTrashPage, type TrashItem } from "../api/trash";
import { TrashItemIcon } from "./trash-item-icon";

export interface TrashLedgerViewProps {
  onRestore?: (item: TrashItem) => void;
  onDeleteForever?: (item: TrashItem) => void;
  onEmptyTrash?: () => void;
}

const HOLD_DURATION_MS = 1400;

export function TrashLedgerView({
  onRestore,
  onDeleteForever,
  onEmptyTrash,
}: TrashLedgerViewProps) {
  const [pendingHardDelete, setPendingHardDelete] = useState<TrashItem | null>(null);
  const [isHoldingEmpty, setIsHoldingEmpty] = useState(false);
  const [expiringExpanded, setExpiringExpanded] = useState(true);
  const [recentExpanded, setRecentExpanded] = useState(true);
  const holdTimerRef = useRef<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["trash"],
    queryFn: ({ pageParam }) => fetchTrashPage(pageParam, 30),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 10_000,
  });

  const allItems = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );

  const expiringSoon = useMemo(
    () =>
      allItems
        .filter((item) => item.daysRemaining <= 7)
        .sort((a, b) => a.daysRemaining - b.daysRemaining),
    [allItems],
  );

  const recentlyDeleted = useMemo(
    () =>
      allItems
        .filter((item) => item.daysRemaining > 7)
        .sort((a, b) => b.daysRemaining - a.daysRemaining),
    [allItems],
  );

  // Infinite scroll intersection observer
  useEffect(() => {
    if (!sentinelRef.current || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const startHoldEmpty = () => {
    if (allItems.length === 0) return;
    setIsHoldingEmpty(true);
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
    }
    holdTimerRef.current = window.setTimeout(() => {
      setIsHoldingEmpty(false);
      holdTimerRef.current = null;
      onEmptyTrash?.();
    }, HOLD_DURATION_MS);
  };

  const cancelHoldEmpty = () => {
    setIsHoldingEmpty(false);
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (holdTimerRef.current !== null) {
        window.clearTimeout(holdTimerRef.current);
      }
    };
  }, []);

  return (
    <>
      <div
        aria-label="Trash Ledger"
        className="trash-surface-enter flex flex-col w-full"
      >
        {/* Editorial Page Header matching Pure Ledger Variant A */}
        <header className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-semibold leading-none tracking-tighter text-foreground sm:text-4xl">
              Trash
            </h1>
            <p className="mt-2.5 text-sm leading-6 text-muted-foreground">
              Items in trash are permanently deleted after 30 days. Restoring a folder restores everything inside it.
            </p>
          </div>

          {allItems.length > 0 && onEmptyTrash && (
            <button
              type="button"
              data-holding={isHoldingEmpty ? "true" : "false"}
              onPointerDown={startHoldEmpty}
              onPointerUp={cancelHoldEmpty}
              onPointerLeave={cancelHoldEmpty}
              onPointerCancel={cancelHoldEmpty}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
                  startHoldEmpty();
                }
              }}
              onKeyUp={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  cancelHoldEmpty();
                }
              }}
              aria-label="Hold to Empty Trash"
              className="hold-delete-btn shrink-0 cursor-pointer rounded-xl bg-muted px-3.5 py-2 text-xs font-medium text-foreground select-none touch-manipulation"
            >
              <span className="flex items-center gap-1.5">
                <Trash2 className="size-3.5 text-muted-foreground" />
                <span>Hold to Empty Trash</span>
              </span>
              <span
                aria-hidden="true"
                className="hold-delete-overlay rounded-xl bg-destructive px-3.5 py-2 text-xs font-medium text-destructive-foreground"
              >
                <Trash2 className="size-3.5" />
                <span>Hold to Empty Trash</span>
              </span>
            </button>
          )}
        </header>

        {/* Global Ledger Body */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Spinner className="size-6 text-muted-foreground" />
          </div>
        ) : isError ? (
          <EmptyState
            icon={<Trash2 className="size-6 text-muted-foreground" />}
            title="Failed to load trash"
            description="An error occurred while fetching deleted items. Please try again."
            className="py-16"
          />
        ) : allItems.length === 0 ? (
          <EmptyState
            icon={<Trash2 className="size-6 text-muted-foreground" />}
            title="Trash is empty"
            description="Deleted folders, notebooks, sources, and study materials stay recoverable here for 30 days."
            className="py-16"
          />
        ) : (
          <div className="flex flex-col gap-8">
            {expiringSoon.length > 0 && (
              <section aria-label="Expiring Within 7 Days">
                <button
                  type="button"
                  aria-expanded={expiringExpanded}
                  onClick={() => setExpiringExpanded((prev) => !prev)}
                  className="mb-1.5 flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground active:scale-97 select-none touch-manipulation"
                >
                  <ChevronRight
                    className={cn(
                      "size-3.5 transition-transform duration-150 ease-out",
                      expiringExpanded && "rotate-90",
                    )}
                  />
                  <span>Expiring Within 7 Days</span>
                </button>
                {expiringExpanded && (
                  <div role="list" className="flex flex-col gap-0.5">
                    {expiringSoon.map((item) => (
                      <LedgerRow
                        key={item.id}
                        item={item}
                        onRestore={onRestore ? () => onRestore(item) : undefined}
                        onDeleteForever={
                          onDeleteForever ? () => setPendingHardDelete(item) : undefined
                        }
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {recentlyDeleted.length > 0 && (
              <section aria-label="Recently Deleted">
                <button
                  type="button"
                  aria-expanded={recentExpanded}
                  onClick={() => setRecentExpanded((prev) => !prev)}
                  className="mb-1.5 flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground active:scale-97 select-none touch-manipulation"
                >
                  <ChevronRight
                    className={cn(
                      "size-3.5 transition-transform duration-150 ease-out",
                      recentExpanded && "rotate-90",
                    )}
                  />
                  <span>Recently Deleted</span>
                </button>
                {recentExpanded && (
                  <div role="list" className="flex flex-col gap-0.5">
                    {recentlyDeleted.map((item) => (
                      <LedgerRow
                        key={item.id}
                        item={item}
                        onRestore={onRestore ? () => onRestore(item) : undefined}
                        onDeleteForever={
                          onDeleteForever ? () => setPendingHardDelete(item) : undefined
                        }
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="py-2 flex justify-center">
              {isFetchingNextPage && <Spinner className="size-5 text-muted-foreground" />}
            </div>
          </div>
        )}
      </div>

      <ConfirmDeleteDialog
        open={pendingHardDelete !== null}
        onOpenChange={(open) => !open && setPendingHardDelete(null)}
        title="Delete Forever"
        description={`Permanently delete "${pendingHardDelete?.name ?? ""}"? This cannot be undone.`}
        onConfirm={() => {
          if (pendingHardDelete && onDeleteForever) {
            onDeleteForever(pendingHardDelete);
            setPendingHardDelete(null);
          }
        }}
      />
    </>
  );
}

interface LedgerRowProps {
  item: TrashItem;
  onRestore?: () => void;
  onDeleteForever?: () => void;
}

function LedgerRow({ item, onRestore, onDeleteForever }: LedgerRowProps) {
  const isUrgent = item.daysRemaining <= 7;

  return (
    <div
      role="listitem"
      className="flex items-center justify-between gap-4 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/60"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="mt-0.5 shrink-0">
          <TrashItemIcon kind={item.kind} />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-medium leading-5 text-foreground wrap-anywhere line-clamp-2"
            title={item.name}
          >
            <bdi>{item.name}</bdi>
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {item.subtypeLabel ?? "Item"}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <span
          className={cn(
            "w-14 text-right text-xs tabular-nums",
            isUrgent ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {item.daysRemaining}d left
        </span>
        <div className="flex items-center gap-0.5">
          {onRestore && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onRestore}
                    aria-label="Restore"
                    className="size-7 cursor-pointer rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground active:scale-97 touch-manipulation"
                  >
                    <RotateCcw className="size-3.5 shrink-0" />
                  </Button>
                }
              />
              <TooltipContent>Restore</TooltipContent>
            </Tooltip>
          )}

          {onDeleteForever && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onDeleteForever}
                    aria-label="Delete forever"
                    className="size-7 cursor-pointer rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive active:scale-97 touch-manipulation"
                  >
                    <Trash2 className="size-3.5 shrink-0" />
                  </Button>
                }
              />
              <TooltipContent>Delete forever</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}
