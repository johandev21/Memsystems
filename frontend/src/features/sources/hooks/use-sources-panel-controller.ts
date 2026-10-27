import { useQuery } from "@tanstack/react-query";
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useCallback, useMemo, useState, type ComponentProps } from "react";
import {
  flattenVisibleTree,
  getTreeDragData,
  getTreeDropData,
  usePersistentExpandedFolders,
  useTreeFocusRegistry,
  useTreeKeyboardNav,
  useTreeSearch,
} from "@/shared/components/ui/tree";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import { type Source, sourcesQueryOptions } from "../api/sources";
import { sourceFoldersQueryOptions } from "../api/source-folders";
import type { SourceFolder } from "../types/source-folder.types";
import { buildSourcesTree, canMoveSourcesItem } from "../model/sources-tree";
import { useUploadStore } from "./use-upload-store";
import {
  isSourceProcessing,
  SOURCE_POLL_INTERVAL_MS,
} from "../utils/source-processing";
import { sourceDisplayTitle } from "../utils/source-display-title";
import { useSourceMutations } from "../components/sources-list/use-source-mutations";
import { useSourcesTreeMutations } from "./use-sources-tree-mutations";
import type { MobileSourcesView } from "../components/mobile/mobile-sources-view";
import type { SourcesList } from "../components/sources-list/sources-list";

const MOBILE_LAYOUT_QUERY = "(max-width: 1023px)";

export type SourceDeleteTarget = { id: string; title: string } | null;

export function useSourcesPanelData(notebookId: string) {
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

export function useSourcesPanelTree(
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

export function useSourcesPanelDrag(handleMove: (itemId: string, folderId: string | null) => void) {
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

export function useSourcesPanelKeyboard({
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

export function useSourcesPanelController(notebookId: string, onSelectSource: (id: string) => void) {
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
