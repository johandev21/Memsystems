import { useQuery } from "@tanstack/react-query";
import { sourceDisplayTitle } from "../utils/source-display-title";
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
import { memo, useCallback, useMemo, useState, type ComponentProps } from "react";
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
  const {
    isMobileLayout,
    mobileViewProps,
    sourceToDelete,
    setSourceToDelete,
    confirmSourceDelete,
    deleteMutation,
    folderToDelete,
    setFolderToDelete,
    confirmFolderDelete,
    activeDragId,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
    sensors,
    canMove,
    search,
    pendingUploads,
    cancelPendingUpload,
    handleCreateFolder,
    expandAll,
    collapseAll,
    sourceListProps,
    sources,
    folders,
    setScrollElement,
  } = useSourcesPanelController(notebookId, onSelectSource);

  return isMobileLayout ? (
    <MobileSourcesPanel
      {...mobileViewProps}
      sourceToDelete={sourceToDelete}
      onCloseDelete={() => setSourceToDelete(null)}
      onConfirmDelete={confirmSourceDelete}
      isDeleting={deleteMutation.isPending}
    />
  ) : (
    <DesktopSourcesPanel
      notebookId={notebookId}
      collapsed={collapsed}
      showHeader={showHeader}
      onToggleCollapse={onToggleCollapse}
      canMove={canMove}
      search={search}
      pendingUploads={pendingUploads}
      onCancelPendingUpload={cancelPendingUpload}
      onCreateFolder={handleCreateFolder}
      onExpandAll={expandAll}
      onCollapseAll={collapseAll}
      sourceListProps={sourceListProps}
      scrollElementRef={setScrollElement}
      sourceToDelete={sourceToDelete}
      folderToDelete={folderToDelete}
      onCloseSourceDelete={() => setSourceToDelete(null)}
      onConfirmSourceDelete={confirmSourceDelete}
      onCloseFolderDelete={() => setFolderToDelete(null)}
      onConfirmFolderDelete={confirmFolderDelete}
      isDeletingSource={deleteMutation.isPending}
      activeDragId={activeDragId}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      sensors={sensors}
      sources={sources ?? []}
      folders={folders ?? []}
    />
  );
});

function useSourcesPanelData(notebookId: string) {
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

  return {
    sources,
    folders,
    isPending: isSourcesPending || isFoldersPending,
    isError: isSourcesError || isFoldersError,
    handleRetryLoad,
  };
}

function useSourcesPanelTree(
  notebookId: string,
  folders: SourceFolder[] | undefined,
  sources: Source[] | undefined,
) {
  const [expandedIds, setExpandedIds] = usePersistentExpandedFolders(
    notebookId,
    folders ?? [],
    "sources-tree:expanded:",
  );
  const expandAll = useCallback(() => {
    if (folders) setExpandedIds(new Set(folders.map((folder) => folder.id)));
  }, [folders, setExpandedIds]);
  const collapseAll = useCallback(() => setExpandedIds(new Set()), [setExpandedIds]);
  const toggleFolder = useCallback((folderId: string) => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, [setExpandedIds]);
  const setFolderOpen = useCallback((folderId: string, open: boolean) => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (open) next.add(folderId);
      else next.delete(folderId);
      return next;
    });
  }, [setExpandedIds]);
  const canMove = useCallback(
    (itemId: string, targetFolderId: string | null) =>
      canMoveSourcesItem({ folders: folders ?? [], sources: sources ?? [] }, itemId, targetFolderId),
    [folders, sources],
  );
  const search = useTreeSearch({
    items: useMemo(
      () => sources?.map((source) => ({
        id: source.id,
        name: sourceDisplayTitle(source),
        folderId: source.folderId,
      })) ?? [],
      [sources],
    ),
    folders: useMemo(
      () => folders?.map((folder) => ({
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
      })) ?? [],
      [folders],
    ),
  });
  const effectiveOpenFolderIds = useMemo(
    () => search.isSearching
      ? new Set([...expandedIds, ...search.expandedFolderIds])
      : expandedIds,
    [expandedIds, search.expandedFolderIds, search.isSearching],
  );

  return {
    expandedIds,
    setExpandedIds,
    expandAll,
    collapseAll,
    toggleFolder,
    setFolderOpen,
    canMove,
    search,
    effectiveOpenFolderIds,
  };
}

function useSourcesPanelDrag(handleMove: (itemId: string, folderId: string | null) => void) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const dragData = getTreeDragData(event.active.data.current);
    if (dragData) setActiveDragId(dragData.itemId);
  }, []);
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const dragData = getTreeDragData(event.active.data.current);
    const dropData = getTreeDropData(event.over?.data.current);
    setActiveDragId(null);
    if (dragData && dropData) handleMove(dragData.itemId, dropData.folderId);
  }, [handleMove]);
  const handleDragCancel = useCallback(() => setActiveDragId(null), []);
  return { sensors, activeDragId, handleDragStart, handleDragEnd, handleDragCancel };
}

function useSourcesPanelController(notebookId: string, onSelectSource: (id: string) => void) {
  const isMobileLayout = useMediaQuery(MOBILE_LAYOUT_QUERY);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const panelData = useSourcesPanelData(notebookId);
  const { sources, folders, isPending, isError, handleRetryLoad } = panelData;
  const tree = useSourcesPanelTree(notebookId, folders, sources);
  const {
    expandedIds,
    setExpandedIds,
    expandAll,
    collapseAll,
    toggleFolder,
    setFolderOpen,
    canMove,
    search,
    effectiveOpenFolderIds,
  } = tree;

  const {
    editingItemId,
    handleCreateFolder,
    handleBeginRename,
    handleRenameCommit,
    handleRenameCancel,
    handleDeleteFolder,
    handleMove,
  } = useSourcesTreeMutations({ notebookId, folders, canMove, setExpandedIds });

  const drag = useSourcesPanelDrag(handleMove);
  const { sensors, activeDragId, handleDragStart, handleDragEnd, handleDragCancel } = drag;

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
    (source: Source) => setSourceToDelete({ id: source.id, title: sourceDisplayTitle(source) }),
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

  const {
    focusedItemId,
    setFocusedItemId,
    treeHasFocus,
    registerTreeSurface,
    registerNode,
    handleKeyDown,
  } = useSourcesPanelKeyboard({
    folders,
    sources,
    expandedIds,
    activeDragId,
    toggleFolder,
    setFolderOpen,
    onSelectSource,
    requestDeleteFolder,
    setSourceToDelete,
    handleBeginRename,
    handleCreateFolder,
  });
  const hasNoSources =
    !isPending &&
    !isError &&
    (sources?.length ?? 0) === 0 &&
    (folders?.length ?? 0) === 0 &&
    pendingUploads.length === 0;
  const mobileViewProps: ComponentProps<typeof MobileSourcesView> = {
    notebookId,
    sources,
    folders,
    pendingUploads,
    isPending,
    isError,
    onRetryLoad: handleRetryLoad,
    onSelectSource,
    onCancelPendingUpload: cancelPendingUpload,
    canMove,
    onMove: handleMove,
    onCreateFolder: handleCreateFolder,
    onDeleteFolder: handleDeleteFolder,
    onDeleteSource: handleDelete,
    onRetrySource: handleRetry,
    onCancelSource: handleCancel,
    deletingId: deleteMutation.isPending ? deleteMutation.variables : undefined,
    retryingId: retryMutation.isPending ? retryMutation.variables : undefined,
    cancellingId: cancelMutation.isPending ? cancelMutation.variables : undefined,
    editingItemId,
    onBeginRename: handleBeginRename,
    onRenameCommit: handleRenameCommit,
    onRenameCancel: handleRenameCancel,
  };
  const sourceListProps: ComponentProps<typeof SourcesList> = {
    sources,
    folders,
    openFolderIds: effectiveOpenFolderIds,
    onToggleFolder: toggleFolder,
    onCreateFolder: handleCreateFolder,
    onExpandAll: expandAll,
    onCollapseAll: collapseAll,
    onMove: handleMove,
    canMove,
    setFolderOpen,
    isPending,
    isError,
    hasNoSources,
    scrollElement,
    onSelectSource,
    onDelete: handleDelete,
    onRetry: handleRetry,
    onCancel: handleCancel,
    deletingId: deleteMutation.isPending ? deleteMutation.variables : undefined,
    retryingId: retryMutation.isPending ? retryMutation.variables : undefined,
    cancellingId: cancelMutation.isPending ? cancelMutation.variables : undefined,
    editingItemId,
    onBeginRename: handleBeginRename,
    onRenameCommit: handleRenameCommit,
    onRenameCancel: handleRenameCancel,
    onDeleteFolder: requestDeleteFolder,
    onRetryLoad: handleRetryLoad,
    focusedItemId,
    treeHasFocus,
    registerNode,
    registerTreeSurface,
    onKeyDown: handleKeyDown,
    onFocusItem: setFocusedItemId,
    searchQuery: search.isSearching ? search.searchQuery : "",
    isItemVisible: search.isItemVisible,
    isFolderVisible: search.isFolderVisible,
  };
  const confirmSourceDelete = () => {
    if (!sourceToDelete) return;
    deleteMutation.mutate(sourceToDelete.id);
    setSourceToDelete(null);
  };
  const confirmFolderDelete = () => {
    if (!folderToDelete) return;
    handleDeleteFolder(folderToDelete.id);
    setFolderToDelete(null);
  };

  return {
    isMobileLayout,
    mobileViewProps,
    sourceToDelete,
    setSourceToDelete,
    confirmSourceDelete,
    deleteMutation,
    folderToDelete,
    setFolderToDelete,
    confirmFolderDelete,
    activeDragId,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
    sensors,
    canMove,
    search,
    pendingUploads,
    cancelPendingUpload,
    handleCreateFolder,
    expandAll,
    collapseAll,
    sourceListProps,
    sources,
    folders,
    setScrollElement,
  };
}

type SourceDeleteTarget = { id: string; title: string } | null;

function useSourcesPanelKeyboard({
  folders,
  sources,
  expandedIds,
  activeDragId,
  toggleFolder,
  setFolderOpen,
  onSelectSource,
  requestDeleteFolder,
  setSourceToDelete,
  handleBeginRename,
  handleCreateFolder,
}: {
  folders: SourceFolder[] | undefined;
  sources: Source[] | undefined;
  expandedIds: Set<string>;
  activeDragId: string | null;
  toggleFolder: (folderId: string) => void;
  setFolderOpen: (folderId: string, open: boolean) => void;
  onSelectSource: (id: string) => void;
  requestDeleteFolder: (folderId: string) => void;
  setSourceToDelete: (target: SourceDeleteTarget) => void;
  handleBeginRename: (id: string) => void;
  handleCreateFolder: (parentId: string | null) => void;
}) {
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const { treeHasFocus, registerTreeSurface, registerNode, focus } =
    useTreeFocusRegistry(setFocusedItemId);
  const visibleItems = useMemo(() => {
    const tree = buildSourcesTree({ folders: folders ?? [], sources: sources ?? [] });
    return flattenVisibleTree(tree, expandedIds);
  }, [folders, sources, expandedIds]);

  const activate = useCallback(
    (node: (typeof visibleItems)[number]) => {
      if (node.type === "folder") toggleFolder(node.id);
      else onSelectSource(node.id);
    },
    [toggleFolder, onSelectSource],
  );
  const requestDelete = useCallback(
    (node: (typeof visibleItems)[number]) => {
      if (node.type === "folder") requestDeleteFolder(node.id);
      else if (node.source) {
        setSourceToDelete({ id: node.source.id, title: sourceDisplayTitle(node.source) });
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
    requestDelete,
    createFolder: handleCreateFolder,
  });

  return {
    focusedItemId,
    setFocusedItemId,
    treeHasFocus,
    registerTreeSurface,
    registerNode,
    handleKeyDown,
  };
}

function MobileSourcesPanel({
  sourceToDelete,
  onCloseDelete,
  onConfirmDelete,
  isDeleting,
  ...viewProps
}: ComponentProps<typeof MobileSourcesView> & {
  sourceToDelete: SourceDeleteTarget;
  onCloseDelete: () => void;
  onConfirmDelete: () => void;
  isDeleting: boolean;
}) {
  const { t } = useTranslation("sources");
  return (
    <>
      <MobileSourcesView {...viewProps} />
      <ConfirmDeleteDialog
        open={sourceToDelete !== null}
        onOpenChange={(open) => !open && onCloseDelete()}
        title={t("panel.deleteTitle")}
        description={t("panel.deleteDescription", { title: sourceToDelete?.title ?? "" })}
        onConfirm={onConfirmDelete}
        isLoading={isDeleting}
      />
    </>
  );
}

function DesktopSourcesPanel({
  notebookId,
  collapsed,
  showHeader,
  onToggleCollapse,
  canMove,
  search,
  pendingUploads,
  onCancelPendingUpload,
  onCreateFolder,
  onExpandAll,
  onCollapseAll,
  sourceListProps,
  scrollElementRef,
  sourceToDelete,
  folderToDelete,
  onCloseSourceDelete,
  onConfirmSourceDelete,
  onCloseFolderDelete,
  onConfirmFolderDelete,
  isDeletingSource,
  activeDragId,
  onDragStart,
  onDragEnd,
  onDragCancel,
  sensors,
  sources,
  folders,
}: {
  notebookId: string;
  collapsed?: boolean;
  showHeader: boolean;
  onToggleCollapse?: () => void;
  canMove: (itemId: string, targetFolderId: string | null) => boolean;
  search: ReturnType<typeof useTreeSearch>;
  pendingUploads: ComponentProps<typeof MobileSourcesView>["pendingUploads"];
  onCancelPendingUpload: ComponentProps<typeof MobileSourcesView>["onCancelPendingUpload"];
  onCreateFolder: (parentId: string | null) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  sourceListProps: ComponentProps<typeof SourcesList>;
  scrollElementRef: (element: HTMLDivElement | null) => void;
  sourceToDelete: SourceDeleteTarget;
  folderToDelete: SourceFolder | null;
  onCloseSourceDelete: () => void;
  onConfirmSourceDelete: () => void;
  onCloseFolderDelete: () => void;
  onConfirmFolderDelete: () => void;
  isDeletingSource: boolean;
  activeDragId: string | null;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragCancel: () => void;
  sensors: ReturnType<typeof useSensors>;
  sources: Source[];
  folders: SourceFolder[];
}) {
  const { t } = useTranslation(["sources", "tree"]);
  return (
    <DndContext
      collisionDetection={pointerWithin}
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
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
              placeholder={t("panel.searchPlaceholder")}
            />
          </div>
        )}

        <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", collapsed && "hidden")}>
          <ContextMenu>
            <ContextMenuTrigger
              ref={scrollElementRef}
              data-slot="sources-panel-content"
              className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 overflow-auto p-2"
            >
              {pendingUploads.map((upload) => (
                <PendingUploadRow key={upload.id} upload={upload} onCancel={onCancelPendingUpload} />
              ))}
              <SourcesList {...sourceListProps} />
            </ContextMenuTrigger>
            <ContextMenuContent className="min-w-48">
              <ContextMenuGroup>
                <ContextMenuItem onClick={() => onCreateFolder(null)}>
                  <FolderPlus className="size-4 mr-2" />
                  {t("tree:actions.newFolder", "New folder")}
                </ContextMenuItem>
              </ContextMenuGroup>
              <ContextMenuSeparator />
              <ContextMenuGroup>
                <ContextMenuItem onClick={onExpandAll}>
                  <FolderOpen className="size-4 mr-2" />
                  {t("tree:actions.expandAll", "Expand all")}
                </ContextMenuItem>
                <ContextMenuItem onClick={onCollapseAll}>
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
          onOpenChange={(open) => !open && onCloseSourceDelete()}
          title={t("sources:panel.deleteTitle")}
          description={t("sources:panel.deleteDescription", { title: sourceToDelete?.title ?? "" })}
          onConfirm={onConfirmSourceDelete}
          isLoading={isDeletingSource}
        />
        <ConfirmDeleteDialog
          open={folderToDelete !== null}
          onOpenChange={(open) => !open && onCloseFolderDelete()}
          title={t("tree:deleteDialog.folderTitle", "Delete folder")}
          description={t("tree:deleteDialog.folderDescription", { name: folderToDelete?.name ?? "" })}
          onConfirm={onConfirmFolderDelete}
        />
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDragId ? (
          <SourcesDragPreview itemId={activeDragId} sources={sources} folders={folders} />
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
  const name = folder?.name ?? (source ? sourceDisplayTitle(source) : "Item");
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
