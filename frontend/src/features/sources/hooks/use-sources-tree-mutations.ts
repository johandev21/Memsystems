import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { moveSource, updateSource, type Source } from "../api/sources";
import {
  createSourceFolder,
  deleteSourceFolder,
  updateSourceFolder,
} from "../api/source-folders";
import { getDescendantFolderIds } from "../model/sources-tree";
import type { SourceFolder } from "../types/source-folder.types";

export interface UseSourcesTreeMutationsOptions {
  notebookId: string;
  folders: SourceFolder[] | undefined;
  canMove: (itemId: string, targetFolderId: string | null) => boolean;
  setExpandedIds: (updater: (prev: Set<string>) => Set<string>) => void;
}

/** Optimistic folder/source tree mutations shared by the desktop and mobile Sources panels. */
export function useSourcesTreeMutations({
  notebookId,
  folders,
  canMove,
  setExpandedIds,
}: UseSourcesTreeMutationsOptions) {
  const { t } = useTranslation(["sources", "tree"]);
  const queryClient = useQueryClient();

  const [editingItemId, setEditingItemId] = useState<string | null>(null);


  const createFolderMutation = useMutation({
    mutationFn: (input: { name: string; parentId?: string | null; skipAutoEdit?: boolean }) =>
      createSourceFolder(notebookId, { name: input.name, parentId: input.parentId }),
    onSuccess: (newFolder, variables) => {
      queryClient.invalidateQueries({ queryKey: ["source-folders", notebookId] });
      if (newFolder.parentId) {
        setExpandedIds((prev) => new Set([...prev, newFolder.parentId!]));
      }
      if (!variables.skipAutoEdit) {
        setEditingItemId(newFolder.id);
      }
    },
  });

  const handleCreateFolder = useCallback(
    (parentId: string | null = null, name?: string) => {
      createFolderMutation.mutate({
        name: name ?? t("tree:defaults.untitledFolder", "Untitled folder"),
        parentId,
        skipAutoEdit: Boolean(name),
      });
    },
    [createFolderMutation, t],
  );

  const renameMutation = useMutation({
    mutationFn: async ({ itemId, nextName }: { itemId: string; nextName: string }) => {
      const isFolder = folders?.some((f) => f.id === itemId);
      if (isFolder) {
        return updateSourceFolder(itemId, { name: nextName });
      }
      return updateSource(itemId, { title: nextName });
    },
    onMutate: async ({ itemId, nextName }) => {
      await queryClient.cancelQueries({ queryKey: ["sources", notebookId] });
      await queryClient.cancelQueries({ queryKey: ["source-folders", notebookId] });

      const previousSources = queryClient.getQueryData<Source[]>(["sources", notebookId]);
      const previousFolders = queryClient.getQueryData<SourceFolder[]>(["source-folders", notebookId]);

      const now = new Date().toISOString();
      const isFolder = previousFolders?.some((f) => f.id === itemId);

      if (isFolder) {
        queryClient.setQueryData<SourceFolder[]>(["source-folders", notebookId], (old) => {
          if (!old) return old;
          return old.map((f) => (f.id === itemId ? { ...f, name: nextName, updatedAt: now } : f));
        });
      } else {
        queryClient.setQueryData<Source[]>(["sources", notebookId], (old) => {
          if (!old) return old;
          return old.map((s) => (s.id === itemId ? { ...s, title: nextName } : s));
        });
      }

      return { previousSources, previousFolders };
    },
    onError: (err, _vars, context) => {
      if (context?.previousSources) {
        queryClient.setQueryData(["sources", notebookId], context.previousSources);
      }
      if (context?.previousFolders) {
        queryClient.setQueryData(["source-folders", notebookId], context.previousFolders);
      }
      const message =
        err instanceof Error ? err.message : t("tree:errors.renameFailed", "Failed to rename");
      toast.error(message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["sources", notebookId] });
      queryClient.invalidateQueries({ queryKey: ["source-folders", notebookId] });
    },
  });

  const handleBeginRename = useCallback((id: string) => {
    setEditingItemId(id);
  }, []);

  const handleRenameCommit = useCallback(
    (id: string, nextName: string) => {
      setEditingItemId(null);
      const trimmed = nextName.trim();
      if (!trimmed) return;

      const folder = folders?.find((f) => f.id === id);
      if (folder) {
        if (folder.name === trimmed) return;
        renameMutation.mutate({ itemId: id, nextName: trimmed });
        return;
      }

      const source = queryClient
        .getQueryData<Source[]>(["sources", notebookId])
        ?.find((s) => s.id === id);
      if (source) {
        if (source.title === trimmed) return;
        renameMutation.mutate({ itemId: id, nextName: trimmed });
        return;
      }
    },
    [folders, queryClient, notebookId, renameMutation],
  );

  const handleRenameCancel = useCallback(() => {
    setEditingItemId(null);
  }, []);

  const deleteFolderMutation = useMutation({
    mutationFn: async (folderId: string) => {
      return deleteSourceFolder(folderId);
    },
    onMutate: async (folderId: string) => {
      await queryClient.cancelQueries({ queryKey: ["sources", notebookId] });
      await queryClient.cancelQueries({ queryKey: ["source-folders", notebookId] });

      const previousSources = queryClient.getQueryData<Source[]>(["sources", notebookId]);
      const previousFolders = queryClient.getQueryData<SourceFolder[]>(["source-folders", notebookId]);

      if (previousFolders) {
        const descendants = getDescendantFolderIds(previousFolders, folderId);
        const deletedIds = new Set([folderId, ...descendants]);

        queryClient.setQueryData<SourceFolder[]>(["source-folders", notebookId], (old) => {
          if (!old) return old;
          return old.filter((f) => !deletedIds.has(f.id));
        });

        if (previousSources) {
          queryClient.setQueryData<Source[]>(["sources", notebookId], (old) => {
            if (!old) return old;
            return old.map((s) =>
              s.folderId && deletedIds.has(s.folderId) ? { ...s, folderId: null } : s,
            );
          });
        }
      }

      return { previousSources, previousFolders };
    },
    onError: (err, _vars, context) => {
      if (context?.previousSources) {
        queryClient.setQueryData(["sources", notebookId], context.previousSources);
      }
      if (context?.previousFolders) {
        queryClient.setQueryData(["source-folders", notebookId], context.previousFolders);
      }
      const message =
        err instanceof Error
          ? err.message
          : t("tree:errors.deleteFolderFailed", "Failed to delete folder");
      toast.error(message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["sources", notebookId] });
      queryClient.invalidateQueries({ queryKey: ["source-folders", notebookId] });
    },
  });

  const handleDeleteFolder = useCallback(
    (folderId: string) => {
      deleteFolderMutation.mutate(folderId);
    },
    [deleteFolderMutation],
  );

  const moveItemMutation = useMutation({
    mutationFn: async ({
      itemId,
      targetFolderId,
    }: {
      itemId: string;
      targetFolderId: string | null;
    }) => {
      const isFolder = folders?.some((f) => f.id === itemId);
      if (isFolder) {
        return updateSourceFolder(itemId, { parentId: targetFolderId });
      }
      return moveSource(itemId, targetFolderId);
    },
    onMutate: async ({ itemId, targetFolderId }) => {
      await queryClient.cancelQueries({ queryKey: ["sources", notebookId] });
      await queryClient.cancelQueries({ queryKey: ["source-folders", notebookId] });

      const previousSources = queryClient.getQueryData<Source[]>(["sources", notebookId]);
      const previousFolders = queryClient.getQueryData<SourceFolder[]>(["source-folders", notebookId]);

      const isFolder = previousFolders?.some((f) => f.id === itemId);

      if (isFolder) {
        queryClient.setQueryData<SourceFolder[]>(["source-folders", notebookId], (old) => {
          if (!old) return old;
          return old.map((f) => (f.id === itemId ? { ...f, parentId: targetFolderId } : f));
        });
      } else {
        queryClient.setQueryData<Source[]>(["sources", notebookId], (old) => {
          if (!old) return old;
          return old.map((s) => (s.id === itemId ? { ...s, folderId: targetFolderId } : s));
        });
      }

      if (targetFolderId !== null) {
        setExpandedIds((prev) => new Set([...prev, targetFolderId]));
      }

      return { previousSources, previousFolders };
    },
    onError: (err, _vars, context) => {
      if (context?.previousSources) {
        queryClient.setQueryData(["sources", notebookId], context.previousSources);
      }
      if (context?.previousFolders) {
        queryClient.setQueryData(["source-folders", notebookId], context.previousFolders);
      }
      const message =
        err instanceof Error ? err.message : t("tree:errors.moveFailed", "Failed to move item");
      toast.error(message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["sources", notebookId] });
      queryClient.invalidateQueries({ queryKey: ["source-folders", notebookId] });
    },
  });

  const handleMove = useCallback(
    (itemId: string, targetFolderId: string | null) => {
      if (!canMove(itemId, targetFolderId)) return;
      moveItemMutation.mutate({ itemId, targetFolderId });
    },
    [canMove, moveItemMutation],
  );

  return {
    editingItemId,
    handleCreateFolder,
    handleBeginRename,
    handleRenameCommit,
    handleRenameCancel,
    handleDeleteFolder,
    handleMove,
  };
}
