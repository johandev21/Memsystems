import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { libraryQueryOptions, type LibraryResponse } from "@/features/notebook-library";
import {
  deleteForeverTrashItem,
  emptyTrashApi,
  fetchTrashPage,
  restoreTrashItem,
  type TrashItem,
  type TrashPageResponse,
} from "../api/trash";

export const HOLD_DURATION_MS = 1400;

export function getTrashDaysLeft(item: Pick<TrashItem, "daysRemaining">): number {
  return item.daysRemaining;
}

export function useTrashItems(
  data: InfiniteData<TrashPageResponse> | undefined,
  searchQuery: string,
) {
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
        .filter((item) => getTrashDaysLeft(item) <= 7)
        .sort((a, b) => getTrashDaysLeft(a) - getTrashDaysLeft(b)),
    [filteredItems],
  );

  const recentlyDeleted = useMemo(
    () =>
      filteredItems
        .filter((item) => getTrashDaysLeft(item) > 7)
        .sort((a, b) => getTrashDaysLeft(b) - getTrashDaysLeft(a)),
    [filteredItems],
  );

  return { allItems, filteredItems, expiringSoon, recentlyDeleted };
}

export function useHoldToEmptyTrash(hasItems: boolean, onEmpty: () => void) {
  const [isHoldingEmpty, setIsHoldingEmpty] = useState(false);
  const holdTimerRef = useRef<number | null>(null);

  const startHold = () => {
    if (!hasItems) return;
    setIsHoldingEmpty(true);
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
    }
    holdTimerRef.current = window.setTimeout(() => {
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

export interface UseTrashModalControllerOptions {
  open?: boolean;
  onRestore?: (item: TrashItem) => void;
  onDeleteForever?: (item: TrashItem) => void;
  onEmptyTrash?: () => void;
}

export function useTrashModalController(
  openOrOptions: boolean | UseTrashModalControllerOptions,
  extraOptions?: Omit<UseTrashModalControllerOptions, "open">,
) {
  const options =
    typeof openOrOptions === "boolean"
      ? { open: openOrOptions, ...extraOptions }
      : openOrOptions;
  const { open = false, onRestore, onDeleteForever, onEmptyTrash } = options;

  const { t } = useTranslation("settings");
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
      toast.error(t("trash.modal.restoreFailedToast", { name: item.name }));
    },
    onSuccess: (_res, item) => {
      toast.success(t("trash.modal.restoreSuccessToast", { name: item.name }));
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
      toast.error(t("trash.modal.deleteFailedToast", { name: item.name }));
    },
    onSuccess: (_res, item) => {
      toast.success(t("trash.modal.deleteSuccessToast", { name: item.name }));
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

  const { allItems, filteredItems, expiringSoon, recentlyDeleted } = useTrashItems(
    data,
    searchQuery,
  );
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

  return {
    searchQuery,
    setSearchQuery,
    pendingHardDelete,
    setPendingHardDelete,
    sentinelRef: sentinelRef as RefObject<HTMLDivElement | null>,
    isLoading,
    isError,
    allItems,
    filteredItems,
    expiringSoon,
    recentlyDeleted,
    isFetchingNextPage,
    isRestoring: (id: string) => restoreMutation.isPending && restoreMutation.variables?.id === id,
    isDeleting: (id: string) =>
      deleteForeverMutation.isPending && deleteForeverMutation.variables?.id === id,
    handleRestore,
    handleDeleteForever,
    handleEmptyTrash,
    holdToEmpty,
    restoreMutation,
    deleteForeverMutation,
    emptyTrashMutation,
  };
}
