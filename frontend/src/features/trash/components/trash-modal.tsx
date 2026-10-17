import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  libraryQueryOptions,
  type LibraryResponse,
} from "@/features/notebook-library/api/library";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import {
  deleteForeverTrashItem,
  emptyTrashApi,
  fetchTrashPage,
  restoreTrashItem,
  type TrashItem,
  type TrashPageResponse,
} from "../api/trash";
import { TrashItemIcon } from "./trash-item-icon";

export interface TrashModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore?: (item: TrashItem) => void;
  onDeleteForever?: (item: TrashItem) => void;
  onEmptyTrash?: () => void;
}

const HOLD_DURATION_MS = 1400;

export function TrashModal({
  open,
  onOpenChange,
  onRestore,
  onDeleteForever,
  onEmptyTrash,
}: TrashModalProps) {
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [pendingHardDelete, setPendingHardDelete] = useState<TrashItem | null>(null);
  const [isHoldingEmpty, setIsHoldingEmpty] = useState(false);
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
    enabled: open,
  });

  const restoreMutation = useMutation({
    mutationFn: (item: TrashItem) => restoreTrashItem(item.kind, item.id),
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: ["trash"] });
      await queryClient.cancelQueries({ queryKey: libraryQueryOptions.queryKey });

      const previousTrash = queryClient.getQueryData<InfiniteData<TrashPageResponse>>(["trash"]);
      const previousLibrary = queryClient.getQueryData<LibraryResponse>(libraryQueryOptions.queryKey);

      queryClient.setQueryData<InfiniteData<TrashPageResponse>>(["trash"], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.filter((i) => i.id !== item.id),
          })),
        };
      });

      const now = new Date().toISOString();
      if (item.kind === "notebook_folder") {
        queryClient.setQueryData<LibraryResponse>(libraryQueryOptions.queryKey, (current) => {
          if (!current) return current;
          if (current.folders.some((f) => f.id === item.id)) return current;
          return {
            ...current,
            folders: [
              ...current.folders,
              {
                id: item.id,
                name: item.name,
                parentId: null,
                createdAt: item.deletedAt,
                updatedAt: now,
              },
            ],
          };
        });
      } else if (item.kind === "notebook") {
        queryClient.setQueryData<LibraryResponse>(libraryQueryOptions.queryKey, (current) => {
          if (!current) return current;
          if (current.notebooks.some((nb) => nb.id === item.id)) return current;
          return {
            ...current,
            notebooks: [
              ...current.notebooks,
              {
                id: item.id,
                title: item.name,
                description: "",
                icon: "notebook",
                folderId: null,
                banner: null,
                bannerUrl: null,
                bannerFocalPoint: null,
                bannerVariants: { w240: null, w480: null, w960: null, w1920: null },
                groundingMode: "strict" as const,
                createdAt: item.deletedAt,
                updatedAt: now,
              },
            ],
          };
        });
      }

      return { previousTrash, previousLibrary };
    },
    onError: (_err, item, context) => {
      if (context?.previousTrash) {
        queryClient.setQueryData(["trash"], context.previousTrash);
      }
      if (context?.previousLibrary) {
        queryClient.setQueryData(libraryQueryOptions.queryKey, context.previousLibrary);
      }
      toast.error(`Failed to restore "${item.name}"`);
    },
    onSuccess: (_res, item) => {
      toast.success(`Restored "${item.name}"`);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["trash"] });
      void queryClient.invalidateQueries({ queryKey: ["library"] });
      void queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      void queryClient.invalidateQueries({ queryKey: ["source-folders"] });
      void queryClient.invalidateQueries({ queryKey: ["sources"] });
      void queryClient.invalidateQueries({ queryKey: ["study-material-folders"] });
      void queryClient.invalidateQueries({ queryKey: ["study-materials"] });
    },
  });

  const deleteForeverMutation = useMutation({
    mutationFn: (item: TrashItem) => deleteForeverTrashItem(item.kind, item.id),
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: ["trash"] });
      const previousTrash = queryClient.getQueryData<InfiniteData<TrashPageResponse>>(["trash"]);

      queryClient.setQueryData<InfiniteData<TrashPageResponse>>(["trash"], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.filter((i) => i.id !== item.id),
          })),
        };
      });

      return { previousTrash };
    },
    onError: (_err, item, context) => {
      if (context?.previousTrash) {
        queryClient.setQueryData(["trash"], context.previousTrash);
      }
      toast.error(`Failed to delete "${item.name}"`);
    },
    onSuccess: (_res, item) => {
      toast.success(`Permanently deleted "${item.name}"`);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["trash"] });
    },
  });

  const emptyTrashMutation = useMutation({
    mutationFn: () => emptyTrashApi(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["trash"] });
      const previousTrash = queryClient.getQueryData<InfiniteData<TrashPageResponse>>(["trash"]);

      queryClient.setQueryData<InfiniteData<TrashPageResponse>>(["trash"], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: [],
          })),
        };
      });

      return { previousTrash };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousTrash) {
        queryClient.setQueryData(["trash"], context.previousTrash);
      }
      toast.error("Failed to empty trash");
    },
    onSuccess: () => {
      toast.success("Trash emptied");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["trash"] });
      void queryClient.invalidateQueries({ queryKey: ["library"] });
      void queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      void queryClient.invalidateQueries({ queryKey: ["source-folders"] });
      void queryClient.invalidateQueries({ queryKey: ["sources"] });
      void queryClient.invalidateQueries({ queryKey: ["study-material-folders"] });
      void queryClient.invalidateQueries({ queryKey: ["study-materials"] });
    },
  });

  const handleRestore = (item: TrashItem) => {
    if (onRestore) {
      onRestore(item);
    } else {
      restoreMutation.mutate(item);
    }
  };

  const handleDeleteForever = (item: TrashItem) => {
    if (onDeleteForever) {
      onDeleteForever(item);
    } else {
      deleteForeverMutation.mutate(item);
    }
  };

  const handleEmptyTrash = () => {
    if (onEmptyTrash) {
      onEmptyTrash();
    } else {
      emptyTrashMutation.mutate();
    }
  };

  const allItems = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return allItems;
    const q = searchQuery.toLowerCase().trim();
    return allItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.notebookTitle && item.notebookTitle.toLowerCase().includes(q)) ||
        (item.subtypeLabel && item.subtypeLabel.toLowerCase().includes(q)),
    );
  }, [allItems, searchQuery]);

  const expiringSoon = useMemo(
    () =>
      filteredItems
        .filter((item) => item.daysRemaining <= 7)
        .sort((a, b) => a.daysRemaining - b.daysRemaining),
    [filteredItems],
  );

  const recentlyDeleted = useMemo(
    () =>
      filteredItems
        .filter((item) => item.daysRemaining > 7)
        .sort((a, b) => b.daysRemaining - a.daysRemaining),
    [filteredItems],
  );

  // Infinite scroll
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

  // Hold to Empty Trash
  const startHoldEmpty = () => {
    if (allItems.length === 0) return;
    setIsHoldingEmpty(true);
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
    }
    holdTimerRef.current = setTimeout(() => {
      setIsHoldingEmpty(false);
      holdTimerRef.current = null;
      handleEmptyTrash();
    }, HOLD_DURATION_MS);
  };

  const cancelHoldEmpty = () => {
    setIsHoldingEmpty(false);
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (holdTimerRef.current !== null) {
        clearTimeout(holdTimerRef.current);
      }
    };
  }, []);

  const headerContent = (
    <div className="flex items-center justify-between gap-3 min-w-0 pr-10">
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold leading-none tracking-tight text-foreground">
          Trash
        </h2>
        <p className="mt-1 text-xs text-muted-foreground truncate">
          Items are permanently deleted after 30 days.
        </p>
      </div>

      {allItems.length > 0 && (
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
          className="hold-delete-btn shrink-0 cursor-pointer rounded-lg bg-muted px-2.5 py-1.5 text-xs font-medium text-foreground select-none touch-manipulation"
        >
          <span className="flex items-center gap-1.5">
            <Trash2 className="size-3 text-muted-foreground" />
            <span>Hold to Empty</span>
          </span>
          <span
            aria-hidden="true"
            className="hold-delete-overlay rounded-lg bg-destructive px-2.5 py-1.5 text-xs font-medium text-destructive-foreground"
          >
            <Trash2 className="size-3" />
            <span>Hold to Empty</span>
          </span>
        </button>
      )}
    </div>
  );

  const bodyContent = (
    <Command
      shouldFilter={false}
      className="flex size-full flex-col overflow-hidden bg-transparent"
    >
      <CommandInput
        placeholder="Search deleted items..."
        value={searchQuery}
        onValueChange={setSearchQuery}
        className="h-10 text-xs"
      />
      <CommandList className="max-h-[60vh] overflow-y-auto px-2 py-2">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner className="size-5 text-muted-foreground" />
          </div>
        ) : isError ? (
          <EmptyState
            icon={<Trash2 className="size-5 text-muted-foreground" />}
            title="Failed to load trash"
            description="An error occurred while fetching deleted items."
            className="py-10"
          />
        ) : allItems.length === 0 ? (
          <EmptyState
            icon={<Trash2 className="size-5 text-muted-foreground" />}
            title="Trash is empty"
            description="Deleted folders, notebooks, sources, and study materials stay recoverable here for 30 days."
            className="py-10"
          />
        ) : filteredItems.length === 0 ? (
          <CommandEmpty className="py-8 text-center text-xs text-muted-foreground">
            No deleted items found matching &quot;{searchQuery}&quot;
          </CommandEmpty>
        ) : (
          <div className="flex flex-col gap-3">
            {expiringSoon.length > 0 && (
              <CommandGroup
                heading="Expiring Within 7 Days"
                className="[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {expiringSoon.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 hover:bg-muted/60 data-[selected=true]:bg-muted/80"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-2.5">
                      <div className="mt-0.5 shrink-0">
                        <TrashItemIcon kind={item.kind} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-xs font-medium leading-4 text-foreground truncate"
                          title={item.name}
                        >
                          <bdi>{item.name}</bdi>
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {item.notebookTitle ? `${item.notebookTitle} · ` : ""}
                          {item.subtypeLabel ?? "Item"}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className="w-12 text-right text-xs tabular-nums text-destructive">
                        {item.daysRemaining}d left
                      </span>
                      <TrashRowActions
                        item={item}
                        isRestoring={
                          restoreMutation.isPending &&
                          restoreMutation.variables?.id === item.id
                        }
                        isDeleting={
                          deleteForeverMutation.isPending &&
                          deleteForeverMutation.variables?.id === item.id
                        }
                        onRestore={handleRestore}
                        onDeleteForever={setPendingHardDelete}
                      />
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {recentlyDeleted.length > 0 && (
              <CommandGroup
                heading="Recently Deleted"
                className="[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {recentlyDeleted.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 hover:bg-muted/60 data-[selected=true]:bg-muted/80"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-2.5">
                      <div className="mt-0.5 shrink-0">
                        <TrashItemIcon kind={item.kind} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-xs font-medium leading-4 text-foreground truncate"
                          title={item.name}
                        >
                          <bdi>{item.name}</bdi>
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {item.notebookTitle ? `${item.notebookTitle} · ` : ""}
                          {item.subtypeLabel ?? "Item"}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                        {item.daysRemaining}d left
                      </span>
                      <TrashRowActions
                        item={item}
                        isRestoring={
                          restoreMutation.isPending &&
                          restoreMutation.variables?.id === item.id
                        }
                        isDeleting={
                          deleteForeverMutation.isPending &&
                          deleteForeverMutation.variables?.id === item.id
                        }
                        onRestore={handleRestore}
                        onDeleteForever={setPendingHardDelete}
                      />
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Sentinel for infinite pagination */}
            <div ref={sentinelRef} className="py-1 flex justify-center">
              {isFetchingNextPage && <Spinner className="size-4 text-muted-foreground" />}
            </div>
          </div>
        )}
      </CommandList>
    </Command>
  );

  return (
    <>
      {isDesktop ? (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent
            showCloseButton={true}
            className="sm:max-w-2xl gap-0 p-0 overflow-hidden"
          >
            <DialogHeader className="p-4 pb-3 border-b border-border/50">
              <DialogTitle className="sr-only">Trash</DialogTitle>
              <DialogDescription className="sr-only">
                Items are permanently deleted after 30 days.
              </DialogDescription>
              {headerContent}
            </DialogHeader>
            {bodyContent}
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className="p-0 max-h-[85vh] overflow-hidden">
            <DrawerHeader className="p-4 pb-3 border-b border-border/50 text-left">
              <DrawerTitle className="sr-only">Trash</DrawerTitle>
              <DrawerDescription className="sr-only">
                Items are permanently deleted after 30 days.
              </DrawerDescription>
              {headerContent}
            </DrawerHeader>
            {bodyContent}
          </DrawerContent>
        </Drawer>
      )}

      <ConfirmDeleteDialog
        open={pendingHardDelete !== null}
        onOpenChange={(openConfirm) => !openConfirm && setPendingHardDelete(null)}
        title="Delete Forever"
        description={`Permanently delete "${pendingHardDelete?.name ?? ""}"? This cannot be undone.`}
        onConfirm={() => {
          if (pendingHardDelete) {
            handleDeleteForever(pendingHardDelete);
            setPendingHardDelete(null);
          }
        }}
      />
    </>
  );
}

interface TrashRowActionsProps {
  item: TrashItem;
  isRestoring: boolean;
  isDeleting: boolean;
  onRestore: (item: TrashItem) => void;
  onDeleteForever: (item: TrashItem) => void;
}

function TrashRowActions({
  item,
  isRestoring,
  isDeleting,
  onRestore,
  onDeleteForever,
}: TrashRowActionsProps) {
  const isPending = isRestoring || isDeleting;
  return (
    <div className="flex items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={isPending}
              onClick={(e) => {
                e.stopPropagation();
                onRestore(item);
              }}
              aria-label="Restore"
              className="size-6.5 cursor-pointer rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:scale-97 touch-manipulation disabled:opacity-50"
            >
              {isRestoring ? (
                <Spinner className="size-3.5 shrink-0" />
              ) : (
                <RotateCcw className="size-3.5 shrink-0" />
              )}
            </Button>
          }
        />
        <TooltipContent>Restore</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={isPending}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteForever(item);
              }}
              aria-label="Delete forever"
              className="size-6.5 cursor-pointer rounded-md text-muted-foreground hover:bg-muted hover:text-destructive active:scale-97 touch-manipulation disabled:opacity-50"
            >
              {isDeleting ? (
                <Spinner className="size-3.5 shrink-0" />
              ) : (
                <Trash2 className="size-3.5 shrink-0" />
              )}
            </Button>
          }
        />
        <TooltipContent>Delete forever</TooltipContent>
      </Tooltip>
    </div>
  );
}
