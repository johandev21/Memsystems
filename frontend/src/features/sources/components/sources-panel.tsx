import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ChevronsUpDown, FileText, Folder, FolderOpen, FolderPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  flattenVisibleTree,
  getTreeDragData,
  getTreeDropData,
  usePersistentExpandedFolders,
  useTreeFocusRegistry,
  useTreeKeyboardNav,
} from "@/components/ui/tree";
import {
  type Source,
  moveSource,
  sourcesQueryOptions,
  updateSource,
} from "../api/sources";
import {
  createSourceFolder,
  deleteSourceFolder,
  sourceFoldersQueryOptions,
  updateSourceFolder,
} from "../api/source-folders";
import type { SourceFolder } from "../types/source-folder.types";
import { buildSourcesTree, canMoveSourcesItem, getDescendantFolderIds } from "../model/sources-tree";
import { useUploadStore } from "../hooks/use-upload-store";
import { AddSourceDialog } from "./add-source-dialog";
import { PendingUploadRow } from "./pending-upload-row";
import {
  isSourceProcessing,
  SOURCE_POLL_INTERVAL_MS,
} from "../utils/source-processing";
import { SourcesList } from "./sources-list/sources-list";
import { useSourceMutations } from "./sources-list/use-source-mutations";
import { SourcesPanelHeader } from "@/features/notebooks/components/notebook-workspace/sources-panel-header";

export function SourcesPanel({
  notebookId,
  collapsed,
  onSelectSource,
  onToggleCollapse,
  showHeader = true,
}: {
  notebookId: string;
  collapsed?: boolean;
  onSelectSource: (id: string) => void;
  onToggleCollapse?: () => void;
  showHeader?: boolean;
}) {
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const { t } = useTranslation(["sources", "tree"]);
  const queryClient = useQueryClient();

  const {
    data: sources,
    isPending: isSourcesPending,
    isError: isSourcesError,
  } = useQuery({
    ...sourcesQueryOptions(notebookId),
    staleTime: 0,
    refetchInterval: (query) => {
      const current = query.state.data as Source[] | undefined;
      return current?.some(isSourceProcessing) ? SOURCE_POLL_INTERVAL_MS : false;
    },
  });

  const {
    data: folders,
    isPending: isFoldersPending,
    isError: isFoldersError,
  } = useQuery({
    ...sourceFoldersQueryOptions(notebookId),
    enabled: Boolean(notebookId),
  });

  const isPending = isSourcesPending || isFoldersPending;
  const isError = isSourcesError || isFoldersError;

  const [expandedIds, setExpandedIds] = usePersistentExpandedFolders(
    notebookId,
    folders ?? [],
    "sources-tree:expanded:",
  );

  const expandAll = useCallback(() => {
    if (folders) {
      setExpandedIds(new Set(folders.map((f) => f.id)));
    }
  }, [folders, setExpandedIds]);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, [setExpandedIds]);

  const toggleFolder = useCallback(
    (folderId: string) => {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(folderId)) {
          next.delete(folderId);
        } else {
          next.add(folderId);
        }
        return next;
      });
    },
    [setExpandedIds],
  );

  const setFolderOpen = useCallback(
    (folderId: string, open: boolean) => {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (open) {
          next.add(folderId);
        } else {
          next.delete(folderId);
        }
        return next;
      });
    },
    [setExpandedIds],
  );

  const canMove = useCallback(
    (itemId: string, targetFolderId: string | null) => {
      return canMoveSourcesItem(
        { folders: folders ?? [], sources: sources ?? [] },
        itemId,
        targetFolderId,
      );
    },
    [folders, sources],
  );

  const [editingItemId, setEditingItemId] = useState<string | null>(null);


  const createFolderMutation = useMutation({
    mutationFn: (input: { name: string; parentId?: string | null }) =>
      createSourceFolder(notebookId, input),
    onSuccess: (newFolder) => {
      queryClient.invalidateQueries({ queryKey: ["source-folders", notebookId] });
      if (newFolder.parentId) {
        setExpandedIds((prev) => new Set([...prev, newFolder.parentId!]));
      }
      setEditingItemId(newFolder.id);
    },
  });

  const handleCreateFolder = useCallback(
    (parentId: string | null = null) => {
      createFolderMutation.mutate({
        name: t("tree:defaults.untitledFolder", "Untitled folder"),
        parentId,
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

      const source = sources?.find((s) => s.id === id);
      if (source) {
        if (source.title === trimmed) return;
        renameMutation.mutate({ itemId: id, nextName: trimmed });
        return;
      }
    },
    [folders, sources, renameMutation],
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const dragData = getTreeDragData(event.active.data.current);
    if (dragData) {
      setActiveDragId(dragData.itemId);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const dragData = getTreeDragData(event.active.data.current);
      const dropData = getTreeDropData(event.over?.data.current);
      setActiveDragId(null);
      if (!dragData || !dropData) return;

      const itemId = dragData.itemId;
      const targetFolderId = dropData.folderId;

      handleMove(itemId, targetFolderId);
    },
    [handleMove],
  );

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
  }, []);

  useEffect(() => {
    const onCreate = () => handleCreateFolder(null);
    const onExpand = () => expandAll();
    const onCollapse = () => collapseAll();

    window.addEventListener("sources:create-folder", onCreate);
    window.addEventListener("sources:expand-all", onExpand);
    window.addEventListener("sources:collapse-all", onCollapse);

    return () => {
      window.removeEventListener("sources:create-folder", onCreate);
      window.removeEventListener("sources:expand-all", onExpand);
      window.removeEventListener("sources:collapse-all", onCollapse);
    };
  }, [handleCreateFolder, expandAll, collapseAll]);

  const allPendingUploads = useUploadStore((state) => state.pendingUploads);
  const pendingUploads = useMemo(
    () => allPendingUploads.filter((upload) => upload.notebookId === notebookId),
    [allPendingUploads, notebookId],
  );
  const cancelPendingUpload = useUploadStore((state) => state.cancelPendingUpload);

  const {
    sourceToDelete,
    setSourceToDelete,
    deleteMutation,
    retryMutation,
    cancelMutation,
  } = useSourceMutations(notebookId);

  // ── Keyboard navigation ──────────────────────────────────────────────────
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const { treeHasFocus, registerTreeSurface, registerNode, focus } =
    useTreeFocusRegistry(setFocusedItemId);

  const visibleItems = useMemo(() => {
    const tree = buildSourcesTree({ folders: folders ?? [], sources: sources ?? [] });
    return flattenVisibleTree(tree, expandedIds);
  }, [folders, sources, expandedIds]);

  const activate = useCallback(
    (node: (typeof visibleItems)[number]) => {
      if (node.type === "folder") {
        toggleFolder(node.id);
      } else {
        onSelectSource(node.id);
      }
    },
    [toggleFolder, onSelectSource],
  );

  const requestDeleteKbd = useCallback(
    (node: (typeof visibleItems)[number]) => {
      if (node.type === "folder") {
        handleDeleteFolder(node.id);
      } else if (node.source) {
        setSourceToDelete({ id: node.source.id, title: node.source.title });
      }
    },
    [handleDeleteFolder, setSourceToDelete],
  );

  const { handleKeyDown } = useTreeKeyboardNav({
    activeDragItemId: activeDragId,
    visibleItems,
    openFolderIds: expandedIds,
    setFolderOpen,
    focus,
    activate,
    beginRename: handleBeginRename,
    requestDelete: requestDeleteKbd,
  });
  // ────────────────────────────────────────────────────────────────────────

  if (collapsed) {
    return (
      <div className="flex flex-col bg-panel-bg">
        {showHeader && (
          <SourcesPanelHeader
            collapsed={true}
            notebookId={notebookId}
            onToggleCollapse={onToggleCollapse}
          />
        )}
      </div>
    );
  }

  const hasNoSources =
    !isPending &&
    !isError &&
    (sources?.length ?? 0) === 0 &&
    (folders?.length ?? 0) === 0 &&
    pendingUploads.length === 0;

  return (
    <DndContext
      collisionDetection={pointerWithin}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex h-full min-w-0 flex-col bg-panel-bg">
        {showHeader && (
          <SourcesPanelHeader
            collapsed={false}
            notebookId={notebookId}
            onToggleCollapse={onToggleCollapse}
            onCreateFolder={() => handleCreateFolder(null)}
            onExpandAll={expandAll}
            onCollapseAll={collapseAll}
            canMove={canMove}
          />
        )}

        <ContextMenu>
          <ContextMenuTrigger
            ref={setScrollElement}
            data-slot="sources-panel-content"
            className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 overflow-auto p-2"
          >
            {pendingUploads.map((upload) => (
              <PendingUploadRow key={upload.id} upload={upload} onCancel={cancelPendingUpload} />
            ))}

            <SourcesList
              sources={sources}
              folders={folders}
              openFolderIds={expandedIds}
              onToggleFolder={toggleFolder}
              onCreateFolder={handleCreateFolder}
              onExpandAll={expandAll}
              onCollapseAll={collapseAll}
              onMove={handleMove}
              canMove={canMove}
              setFolderOpen={setFolderOpen}
              isPending={isPending}
              isError={isError}
              hasNoSources={hasNoSources}
              scrollElement={scrollElement}
              onSelectSource={onSelectSource}
              onDelete={(source) => setSourceToDelete({ id: source.id, title: source.title })}
              onRetry={(source) => retryMutation.mutate(source.id)}
              onCancel={(source) => cancelMutation.mutate(source.id)}
              deletingId={deleteMutation.isPending ? deleteMutation.variables : undefined}
              retryingId={retryMutation.isPending ? retryMutation.variables : undefined}
              cancellingId={cancelMutation.isPending ? cancelMutation.variables : undefined}
              editingItemId={editingItemId}
              onBeginRename={handleBeginRename}
              onRenameCommit={handleRenameCommit}
              onRenameCancel={handleRenameCancel}
              onDeleteFolder={handleDeleteFolder}
              focusedItemId={focusedItemId}
              treeHasFocus={treeHasFocus}
              registerNode={registerNode}
              registerTreeSurface={registerTreeSurface}
              onKeyDown={handleKeyDown}
              onFocusItem={setFocusedItemId}
            />
          </ContextMenuTrigger>
          <ContextMenuContent className="min-w-48">
            <ContextMenuGroup>
              <ContextMenuItem onClick={() => handleCreateFolder(null)}>
                <FolderPlus className="size-4 mr-2" />
                {t("tree:actions.newFolder", "New folder")}
              </ContextMenuItem>
            </ContextMenuGroup>
            <ContextMenuSeparator />
            <ContextMenuGroup>
              <ContextMenuItem onClick={expandAll}>
                <FolderOpen className="size-4 mr-2" />
                {t("tree:actions.expandAll", "Expand all")}
              </ContextMenuItem>
              <ContextMenuItem onClick={collapseAll}>
                <ChevronsUpDown className="size-4 mr-2" />
                {t("tree:actions.collapseAll", "Collapse all")}
              </ContextMenuItem>
            </ContextMenuGroup>
          </ContextMenuContent>
        </ContextMenu>

        <div className="p-2">
          <AddSourceDialog notebookId={notebookId}>
            <div className="cursor-pointer rounded-2xl border-2 border-dashed border-border p-4 text-center text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5">
              {t("sources:panel.addSourcesPrompt")}
            </div>
          </AddSourceDialog>
        </div>

        <ConfirmDeleteDialog
          open={sourceToDelete !== null}
          onOpenChange={(open) => !open && setSourceToDelete(null)}
          title={t("sources:panel.deleteTitle")}
          description={t("sources:panel.deleteDescription", { title: sourceToDelete?.title ?? "" })}
          onConfirm={() => {
            if (!sourceToDelete) return;
            deleteMutation.mutate(sourceToDelete.id);
            setSourceToDelete(null);
          }}
          isLoading={deleteMutation.isPending}
        />
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDragId ? (
          <SourcesDragPreview
            itemId={activeDragId}
            sources={sources ?? []}
            folders={folders ?? []}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function SourcesDragPreview({
  itemId,
  sources,
  folders,
}: {
  itemId: string;
  sources: readonly Source[];
  folders: readonly SourceFolder[];
}) {
  const folder = folders.find((f) => f.id === itemId);
  const source = sources.find((s) => s.id === itemId);
  const name = folder?.name ?? source?.title ?? "Item";
  const isFolder = Boolean(folder);

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-popover px-3 py-1.5 text-xs font-medium text-popover-foreground shadow-lg">
      {isFolder ? (
        <Folder className="size-4 shrink-0 text-muted-foreground" />
      ) : (
        <FileText className="size-4 shrink-0 text-muted-foreground" />
      )}
      <span className="max-w-48 truncate">{name}</span>
    </div>
  );
}
