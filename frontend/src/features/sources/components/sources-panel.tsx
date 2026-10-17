import { useQuery } from "@tanstack/react-query";
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
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
  TreeSearchBar,
  usePersistentExpandedFolders,
  useTreeFocusRegistry,
  useTreeKeyboardNav,
  useTreeSearch,
} from "@/components/ui/tree";
import {
  type Source,
  sourcesQueryOptions,
} from "../api/sources";
import {
  sourceFoldersQueryOptions,
} from "../api/source-folders";
import type { SourceFolder } from "../types/source-folder.types";
import { buildSourcesTree, canMoveSourcesItem } from "../model/sources-tree";
import { useUploadStore } from "../hooks/use-upload-store";
import { AddSourceDialog } from "./add-source-dialog";
import { PendingUploadRow } from "./pending-upload-row";
import {
  isSourceProcessing,
  SOURCE_POLL_INTERVAL_MS,
} from "../utils/source-processing";
import { SourcesList } from "./sources-list/sources-list";
import { SourceIcon } from "./sources-list/source-icon";
import { useSourceMutations } from "./sources-list/use-source-mutations";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import { cn } from "@/shared/utils/cn";
import { useSourcesTreeMutations } from "../hooks/use-sources-tree-mutations";
import { MobileSourcesView } from "./mobile/mobile-sources-view";
import { SourcesPanelHeader } from "@/features/notebooks/components/notebook-workspace/sources-panel-header";

const MOBILE_LAYOUT_QUERY = "(max-width: 1023px)";

export const SourcesPanel = memo(function SourcesPanel({
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
  const isMobileLayout = useMediaQuery(MOBILE_LAYOUT_QUERY);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const { t } = useTranslation(["sources", "tree"]);

  const {
    data: sources,
    isPending: isSourcesPending,
    isError: isSourcesError,
    refetch: refetchSources,
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
    refetch: refetchFolders,
  } = useQuery({
    ...sourceFoldersQueryOptions(notebookId),
    enabled: Boolean(notebookId),
  });

  const handleRetryLoad = useCallback(() => {
    refetchSources();
    refetchFolders();
  }, [refetchSources, refetchFolders]);

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

  const {
    editingItemId,
    handleCreateFolder,
    handleBeginRename,
    handleRenameCommit,
    handleRenameCancel,
    handleDeleteFolder,
    handleMove,
  } = useSourcesTreeMutations({ notebookId, folders, canMove, setExpandedIds });

  const search = useTreeSearch({
    items: useMemo(
      () =>
        sources?.map((s) => ({
          id: s.id,
          name: s.title,
          folderId: s.folderId,
        })) ?? [],
      [sources],
    ),
    folders: useMemo(
      () =>
        folders?.map((f) => ({
          id: f.id,
          name: f.name,
          parentId: f.parentId,
        })) ?? [],
      [folders],
    ),
  });

  const effectiveOpenFolderIds = useMemo(() => {
    if (!search.isSearching) return expandedIds;
    return new Set([...expandedIds, ...search.expandedFolderIds]);
  }, [expandedIds, search.isSearching, search.expandedFolderIds]);

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

      handleMove(dragData.itemId, dropData.folderId);
    },
    [handleMove],
  );

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
  }, []);

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
  const [folderToDelete, setFolderToDelete] = useState<SourceFolder | null>(null);

  const requestDeleteFolder = useCallback(
    (folderId: string) => {
      const folder = folders?.find((f) => f.id === folderId);
      if (folder) setFolderToDelete(folder);
    },
    [folders],
  );

  const handleDelete = useCallback(
    (source: Source) => setSourceToDelete({ id: source.id, title: source.title }),
    [setSourceToDelete],
  );
  const handleRetry = useCallback(
    (source: Source) => retryMutation.mutate(source.id),
    [retryMutation],
  );
  const handleCancel = useCallback(
    (source: Source) => cancelMutation.mutate(source.id),
    [cancelMutation],
  );

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
        requestDeleteFolder(node.id);
      } else if (node.source) {
        setSourceToDelete({ id: node.source.id, title: node.source.title });
      }
    },
    [requestDeleteFolder, setSourceToDelete],
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
    createFolder: handleCreateFolder,
  });

  if (isMobileLayout) {
    return (
      <>
        <MobileSourcesView
          notebookId={notebookId}
          sources={sources}
          folders={folders}
          pendingUploads={pendingUploads}
          isPending={isPending}
          isError={isError}
          onRetryLoad={handleRetryLoad}
          onSelectSource={onSelectSource}
          onCancelPendingUpload={cancelPendingUpload}
          canMove={canMove}
          onMove={handleMove}
          onCreateFolder={handleCreateFolder}
          onDeleteFolder={handleDeleteFolder}
          onDeleteSource={(source) => setSourceToDelete({ id: source.id, title: source.title })}
          onRetrySource={(source) => retryMutation.mutate(source.id)}
          onCancelSource={(source) => cancelMutation.mutate(source.id)}
          deletingId={deleteMutation.isPending ? deleteMutation.variables : undefined}
          retryingId={retryMutation.isPending ? retryMutation.variables : undefined}
          cancellingId={cancelMutation.isPending ? cancelMutation.variables : undefined}
          editingItemId={editingItemId}
          onBeginRename={handleBeginRename}
          onRenameCommit={handleRenameCommit}
          onRenameCancel={handleRenameCancel}
        />
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
      </>
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
      <div className="relative flex h-full min-w-0 flex-col bg-panel-bg">
        {showHeader && (
          <SourcesPanelHeader
            collapsed={Boolean(collapsed)}
            notebookId={notebookId}
            onToggleCollapse={onToggleCollapse}
            canMove={canMove}
            isSearchOpen={search.isSearchOpen}
            onToggleSearch={search.toggleSearch}
          />
        )}

        {search.isSearchOpen && !collapsed && (
          <div className="px-2 pt-2">
            <TreeSearchBar
              value={search.searchQuery}
              onChange={search.setSearchQuery}
              onClear={search.clearSearch}
              onClose={search.toggleSearch}
              matchCount={search.matchCount}
              isSearching={search.isSearching}
              placeholder="Search sources..."
            />
          </div>
        )}

        <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", collapsed && "hidden")}>
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
              openFolderIds={effectiveOpenFolderIds}
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
              onDelete={handleDelete}
              onRetry={handleRetry}
              onCancel={handleCancel}
              deletingId={deleteMutation.isPending ? deleteMutation.variables : undefined}
              retryingId={retryMutation.isPending ? retryMutation.variables : undefined}
              cancellingId={cancelMutation.isPending ? cancelMutation.variables : undefined}
              editingItemId={editingItemId}
              onBeginRename={handleBeginRename}
              onRenameCommit={handleRenameCommit}
              onRenameCancel={handleRenameCancel}
              onDeleteFolder={requestDeleteFolder}
              onRetryLoad={handleRetryLoad}
              focusedItemId={focusedItemId}
              treeHasFocus={treeHasFocus}
              registerNode={registerNode}
              registerTreeSurface={registerTreeSurface}
              onKeyDown={handleKeyDown}
              onFocusItem={setFocusedItemId}
              searchQuery={search.isSearching ? search.searchQuery : ""}
              isItemVisible={search.isItemVisible}
              isFolderVisible={search.isFolderVisible}
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

        <ConfirmDeleteDialog
          open={folderToDelete !== null}
          onOpenChange={(open) => !open && setFolderToDelete(null)}
          title={t("tree:deleteDialog.folderTitle", "Delete folder")}
          description={t("tree:deleteDialog.folderDescription", { name: folderToDelete?.name ?? "" })}
          onConfirm={() => {
            if (!folderToDelete) return;
            handleDeleteFolder(folderToDelete.id);
            setFolderToDelete(null);
          }}
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
});

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
    <div className="relative flex items-center gap-2 rounded-xl border border-border/80 bg-popover px-3 py-1.5 text-xs font-medium text-popover-foreground shadow-lg">
      {isFolder ? (
        <Folder className="size-4 shrink-0 text-muted-foreground" />
      ) : source ? (
        <SourceIcon source={source} className="size-4 shrink-0 text-muted-foreground" />
      ) : (
        <FileText className="size-4 shrink-0 text-muted-foreground" />
      )}
      <span className="max-w-48 truncate">{name}</span>
    </div>
  );
}
