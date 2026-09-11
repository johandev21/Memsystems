import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { createNotebook, notebooksInfiniteQueryOptions } from "../api/notebooks";
import type { Notebook } from "../types";

export interface RecentNotebooksPagination {
  hasNextPage?: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  onRetry: () => void;
  sentinelRef: RefObject<HTMLDivElement | null>;
}

export interface UseRecentNotebooksResult {
  notebooks: Notebook[];
  isLoading: boolean;
  isCreating: boolean;
  onCreate: () => Promise<void>;
  pagination: RecentNotebooksPagination;
}

export function useRecentNotebooks(): UseRecentNotebooksResult {
  const { t } = useTranslation("notebooks");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useInfiniteQuery(notebooksInfiniteQueryOptions);

  const notebooks = data?.pages.flatMap((p) => p.notebooks) ?? [];

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (!hasNextPage || isFetchingNextPage) return;
        void fetchNextPage();
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, notebooks.length]);

  const handleCreate = async () => {
    try {
      setIsCreating(true);
      const newNotebook = await createNotebook({ title: "Untitled" });
      await queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      navigate({
        to: "/notebooks/$notebookId",
        params: { notebookId: newNotebook.id },
      });
    } catch {
      toast.error(t("recent.createFailed"));
      setIsCreating(false);
    }
  };

  return {
    notebooks,
    isLoading,
    isCreating,
    onCreate: handleCreate,
    pagination: {
      hasNextPage,
      isFetchingNextPage,
      isFetchNextPageError,
      onRetry: () => void fetchNextPage(),
      sentinelRef,
    },
  };
}
