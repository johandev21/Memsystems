import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useTranslation } from "react-i18next";
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
import { libraryQueryOptions, type LibraryResponse } from "@/features/notebook-library/api/library";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import { cn } from "@/shared/utils/cn";
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
  const { t } = useTranslation("settings");
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [pendingHardDelete, setPendingHardDelete] = useState<TrashItem | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
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
      const previousLibrary = queryClient.getQueryData<LibraryResponse>(
        libraryQueryOptions.queryKey,
      );

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
      toast.error(t("trash.modal.emptyFailedToast"));
    },
    onSuccess: () => {
      toast.success(t("trash.modal.emptySuccessToast"));
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

  const { allItems, filteredItems, expiringSoon, recentlyDeleted } = useTrashItems(data, searchQuery);
  const holdToEmpty = useHoldToEmptyTrash(allItems.length > 0, handleEmptyTrash);

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

  const headerContent = (
    <TrashModalHeader
      hasItems={allItems.length > 0}
      isHoldingEmpty={holdToEmpty.isHoldingEmpty}
      onStartHold={holdToEmpty.startHold}
      onCancelHold={holdToEmpty.cancelHold}
    />
  );
  const bodyContent = (
    <TrashModalBody
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      isLoading={isLoading}
      isError={isError}
      allItems={allItems}
      filteredItems={filteredItems}
      expiringSoon={expiringSoon}
      recentlyDeleted={recentlyDeleted}
      sentinelRef={sentinelRef}
      isFetchingNextPage={isFetchingNextPage}
      isRestoring={(id) => restoreMutation.isPending && restoreMutation.variables?.id === id}
      isDeleting={(id) => deleteForeverMutation.isPending && deleteForeverMutation.variables?.id === id}
      onRestore={handleRestore}
      onDeleteForever={setPendingHardDelete}
    />
  );

  return (
    <>
      <TrashModalSurface
        isDesktop={isDesktop}
        open={open}
        onOpenChange={onOpenChange}
        title={t("trash.modal.title")}
        subtitle={t("trash.modal.subtitle")}
        headerContent={headerContent}
        bodyContent={bodyContent}
      />
      <ConfirmDeleteDialog
        open={pendingHardDelete !== null}
        onOpenChange={(openConfirm) => !openConfirm && setPendingHardDelete(null)}
        title={t("trash.modal.confirmDeleteTitle")}
        description={t("trash.modal.confirmDeleteDescription", {
          name: pendingHardDelete?.name ?? "",
        })}
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

function useTrashItems(data: InfiniteData<TrashPageResponse> | undefined, searchQuery: string) {
  const allItems = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return allItems;
    const query = searchQuery.toLowerCase().trim();
    return allItems.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        (item.notebookTitle && item.notebookTitle.toLowerCase().includes(query)) ||
        (item.subtypeLabel && item.subtypeLabel.toLowerCase().includes(query)),
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

  return { allItems, filteredItems, expiringSoon, recentlyDeleted };
}

function TrashModalSurface({
  isDesktop,
  open,
  onOpenChange,
  title,
  subtitle,
  headerContent,
  bodyContent,
}: {
  isDesktop: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle: string;
  headerContent: ReactNode;
  bodyContent: ReactNode;
}) {
  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent showCloseButton={true} className="sm:max-w-2xl gap-0 p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-3 border-b border-border/50">
            <DialogTitle className="sr-only">{title}</DialogTitle>
            <DialogDescription className="sr-only">{subtitle}</DialogDescription>
            {headerContent}
          </DialogHeader>
          {bodyContent}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="p-0 max-h-[85vh] overflow-hidden">
        <DrawerHeader className="p-4 pb-3 border-b border-border/50 text-left">
          <DrawerTitle className="sr-only">{title}</DrawerTitle>
          <DrawerDescription className="sr-only">{subtitle}</DrawerDescription>
          {headerContent}
        </DrawerHeader>
        {bodyContent}
      </DrawerContent>
    </Drawer>
  );
}

function TrashModalHeader({
  hasItems,
  isHoldingEmpty,
  onStartHold,
  onCancelHold,
}: {
  hasItems: boolean;
  isHoldingEmpty: boolean;
  onStartHold: () => void;
  onCancelHold: () => void;
}) {
  const { t } = useTranslation("settings");

  return (
    <div className="flex items-center justify-between gap-3 min-w-0 pr-10">
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold leading-none tracking-tight text-foreground">
          {t("trash.modal.title")}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground truncate">{t("trash.modal.subtitle")}</p>
      </div>
      {hasItems && (
        <HoldToEmptyButton
          isHolding={isHoldingEmpty}
          onStartHold={onStartHold}
          onCancelHold={onCancelHold}
        />
      )}
    </div>
  );
}

function HoldToEmptyButton({
  isHolding,
  onStartHold,
  onCancelHold,
}: {
  isHolding: boolean;
  onStartHold: () => void;
  onCancelHold: () => void;
}) {
  const { t } = useTranslation("settings");

  return (
    <button
      type="button"
      data-holding={isHolding ? "true" : "false"}
      onPointerDown={onStartHold}
      onPointerUp={onCancelHold}
      onPointerLeave={onCancelHold}
      onPointerCancel={onCancelHold}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
          onStartHold();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onCancelHold();
        }
      }}
      aria-label={t("trash.modal.holdToEmptyAria")}
      className="hold-delete-btn shrink-0 cursor-pointer rounded-lg bg-muted px-2.5 py-1.5 text-xs font-medium text-foreground select-none touch-manipulation"
    >
      <span className="flex items-center gap-1.5">
        <Trash2 className="size-3 text-muted-foreground" />
        <span>{t("trash.modal.holdToEmpty")}</span>
      </span>
      <span
        aria-hidden="true"
        className="hold-delete-overlay rounded-lg bg-destructive px-2.5 py-1.5 text-xs font-medium text-destructive-foreground"
      >
        <Trash2 className="size-3" />
        <span>{t("trash.modal.holdToEmpty")}</span>
      </span>
    </button>
  );
}

function useHoldToEmptyTrash(hasItems: boolean, onEmpty: () => void) {
  const [isHoldingEmpty, setIsHoldingEmpty] = useState(false);
  const holdTimerRef = useRef<number | null>(null);

  const startHold = () => {
    if (!hasItems) return;
    setIsHoldingEmpty(true);
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
    }
    holdTimerRef.current = setTimeout(() => {
      setIsHoldingEmpty(false);
      holdTimerRef.current = null;
      onEmpty();
    }, HOLD_DURATION_MS);
  };

  const cancelHold = () => {
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

  return { isHoldingEmpty, startHold, cancelHold };
}

interface TrashModalBodyProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isLoading: boolean;
  isError: boolean;
  allItems: TrashItem[];
  filteredItems: TrashItem[];
  expiringSoon: TrashItem[];
  recentlyDeleted: TrashItem[];
  sentinelRef: RefObject<HTMLDivElement | null>;
  isFetchingNextPage: boolean;
  isRestoring: (itemId: string) => boolean;
  isDeleting: (itemId: string) => boolean;
  onRestore: (item: TrashItem) => void;
  onDeleteForever: (item: TrashItem) => void;
}

function TrashModalBody({ searchQuery, onSearchChange, ...resultsProps }: TrashModalBodyProps) {
  const { t } = useTranslation("settings");

  return (
    <Command
      shouldFilter={false}
      className="flex size-full flex-col overflow-hidden bg-transparent"
    >
      <CommandInput
        placeholder={t("trash.modal.searchPlaceholder")}
        value={searchQuery}
        onValueChange={onSearchChange}
        className="h-10 text-xs"
      />
      <CommandList className="max-h-[60vh] overflow-y-auto px-2 py-2">
        <TrashItemsResult {...resultsProps} searchQuery={searchQuery} />
      </CommandList>
    </Command>
  );
}

type TrashItemsResultProps = Omit<TrashModalBodyProps, "onSearchChange">;

function TrashItemsResult({
  searchQuery,
  isLoading,
  isError,
  allItems,
  filteredItems,
  expiringSoon,
  recentlyDeleted,
  sentinelRef,
  isFetchingNextPage,
  isRestoring,
  isDeleting,
  onRestore,
  onDeleteForever,
}: TrashItemsResultProps) {
  const { t } = useTranslation("settings");

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="size-5 text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={<Trash2 className="size-5 text-muted-foreground" />}
        title={t("trash.modal.loadFailedTitle")}
        description={t("trash.modal.loadFailedDescription")}
        className="py-10"
      />
    );
  }

  if (allItems.length === 0) {
    return (
      <EmptyState
        icon={<Trash2 className="size-5 text-muted-foreground" />}
        title={t("trash.modal.emptyTitle")}
        description={t("trash.modal.emptyDescription")}
        className="py-10"
      />
    );
  }

  if (filteredItems.length === 0) {
    return (
      <CommandEmpty className="py-8 text-center text-xs text-muted-foreground">
        {t("trash.modal.noResults", { query: searchQuery })}
      </CommandEmpty>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {expiringSoon.length > 0 && (
        <TrashItemGroup
          items={expiringSoon}
          heading={t("trash.modal.expiringSoonHeading")}
          isExpiringSoon
          isRestoring={isRestoring}
          isDeleting={isDeleting}
          onRestore={onRestore}
          onDeleteForever={onDeleteForever}
        />
      )}
      {recentlyDeleted.length > 0 && (
        <TrashItemGroup
          items={recentlyDeleted}
          heading={t("trash.modal.recentlyDeletedHeading")}
          isExpiringSoon={false}
          isRestoring={isRestoring}
          isDeleting={isDeleting}
          onRestore={onRestore}
          onDeleteForever={onDeleteForever}
        />
      )}
      {/* Sentinel for infinite pagination */}
      <div ref={sentinelRef} className="py-1 flex justify-center">
        {isFetchingNextPage && <Spinner className="size-4 text-muted-foreground" />}
      </div>
    </div>
  );
}

interface TrashItemGroupProps {
  items: TrashItem[];
  heading: string;
  isExpiringSoon: boolean;
  isRestoring: (itemId: string) => boolean;
  isDeleting: (itemId: string) => boolean;
  onRestore: (item: TrashItem) => void;
  onDeleteForever: (item: TrashItem) => void;
}

function TrashItemGroup({
  items,
  heading,
  isExpiringSoon,
  isRestoring,
  isDeleting,
  onRestore,
  onDeleteForever,
}: TrashItemGroupProps) {
  return (
    <CommandGroup
      heading={heading}
      className="[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground"
    >
      {items.map((item) => (
        <TrashItemRow
          key={item.id}
          item={item}
          isExpiringSoon={isExpiringSoon}
          isRestoring={isRestoring(item.id)}
          isDeleting={isDeleting(item.id)}
          onRestore={onRestore}
          onDeleteForever={onDeleteForever}
        />
      ))}
    </CommandGroup>
  );
}

function TrashItemRow({
  item,
  isExpiringSoon,
  isRestoring,
  isDeleting,
  onRestore,
  onDeleteForever,
}: {
  item: TrashItem;
  isExpiringSoon: boolean;
  isRestoring: boolean;
  isDeleting: boolean;
  onRestore: (item: TrashItem) => void;
  onDeleteForever: (item: TrashItem) => void;
}) {
  const { t } = useTranslation("settings");

  return (
    <CommandItem
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
            {item.subtypeLabel ?? t("trash.modal.itemFallback")}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span
          className={cn(
            "w-12 text-right text-xs tabular-nums",
            isExpiringSoon ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {t("trash.modal.daysRemaining", { count: item.daysRemaining })}
        </span>
        <TrashRowActions
          item={item}
          isRestoring={isRestoring}
          isDeleting={isDeleting}
          onRestore={onRestore}
          onDeleteForever={onDeleteForever}
        />
      </div>
    </CommandItem>
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
  const { t } = useTranslation("settings");
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
              aria-label={t("trash.modal.restore")}
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
        <TooltipContent>{t("trash.modal.restore")}</TooltipContent>
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
              aria-label={t("trash.modal.deleteForever")}
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
        <TooltipContent>{t("trash.modal.deleteForever")}</TooltipContent>
      </Tooltip>
    </div>
  );
}
