import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertTriangle, Loader2 } from "lucide-react";
import { memo, useMemo } from "react";
import type React from "react";
import { useTranslation } from "react-i18next";
import type { Source } from "../../api/sources";
import type { SourceFolder } from "../../types/source-folder.types";
import {
  buildSourcesTree,
  flattenVisibleTreeWithDepth,
  type SourcesTreeNode,
} from "../../model/sources-tree";
import { SourcesTreeBranch, SourcesTreeNodeRow } from "../sources-tree-branch";
import { treeVariants } from "@/components/ui/tree";
import { cn } from "@/shared/utils/cn";

const TREE_VIRTUALIZATION_THRESHOLD = 25;

export interface SourcesListProps {
  sources?: Source[];
  folders?: SourceFolder[];
  openFolderIds?: Set<string>;
  onToggleFolder?: (folderId: string) => void;
  onCreateFolder?: (parentId: string | null) => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  onMove?: (itemId: string, targetFolderId: string | null) => void;
  canMove?: (draggedItemId: string, targetFolderId: string | null) => boolean;
  setFolderOpen?: (folderId: string, open: boolean) => void;
  isPending: boolean;
  isError: boolean;
  hasNoSources: boolean;
  scrollElement?: HTMLDivElement | null;
  onSelectSource: (id: string) => void;
  onDelete: (source: Source) => void;
  onRetry: (source: Source) => void;
  onCancel: (source: Source) => void;
  deletingId?: string;
  retryingId?: string;
  cancellingId?: string;
  editingItemId?: string | null;
  onBeginRename?: (id: string) => void;
  onRenameCommit?: (id: string, nextName: string) => void;
  onRenameCancel?: () => void;
  onDeleteFolder?: (id: string) => void;
  onRetryLoad?: () => void;
  focusedItemId?: string | null;
  treeHasFocus?: boolean;
  registerNode?: (id: string, el: HTMLElement | null) => void;
  registerTreeSurface?: (el: HTMLDivElement | null) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLElement>, node: SourcesTreeNode) => void;
  onFocusItem?: (id: string) => void;
  isMultiselectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleItemSelect?: (id: string) => void;
  onToggleFolderSelect?: (descendantIds: string[]) => void;
  isFolderSelected?: (descendantIds: string[]) => boolean | "indeterminate";
  searchQuery?: string;
  isItemVisible?: (itemId: string, folderId?: string | null) => boolean;
  isFolderVisible?: (folderId: string) => boolean;
}

export const SourcesList = memo(function SourcesList({
  sources,
  folders,
  openFolderIds = new Set(),
  onToggleFolder = () => {},
  onCreateFolder = () => {},
  onExpandAll,
  onCollapseAll,
  onMove,
  canMove,
  setFolderOpen,
  isPending,
  isError,
  hasNoSources,
  scrollElement,
  onSelectSource,
  onDelete,
  onRetry,
  onCancel,
  deletingId,
  retryingId,
  cancellingId,
  editingItemId,
  onBeginRename,
  onRenameCommit,
  onRenameCancel,
  onDeleteFolder,
  onRetryLoad,
  focusedItemId = null,
  treeHasFocus,
  registerNode,
  registerTreeSurface,
  onKeyDown,
  onFocusItem,
  isMultiselectMode = false,
  selectedIds,
  onToggleItemSelect,
  onToggleFolderSelect,
  isFolderSelected,
  searchQuery,
  isItemVisible,
  isFolderVisible,
}: SourcesListProps) {
  const { t } = useTranslation("sources");

  const tree = useMemo(
    () =>
      buildSourcesTree({
        folders: folders ?? [],
        sources: sources ?? [],
      }),
    [folders, sources],
  );

  const filteredTree = useMemo(() => {
    if (!searchQuery) return tree;

    const filterNodes = (nodes: readonly SourcesTreeNode[]): SourcesTreeNode[] => {
      const result: SourcesTreeNode[] = [];
      for (const node of nodes) {
        if (node.type === "folder") {
          if (isFolderVisible ? isFolderVisible(node.id) : true) {
            const filteredChildren = filterNodes(node.children);
            result.push({
              ...node,
              children: filteredChildren,
            });
          }
        } else if (node.type === "source" && node.source) {
          if (isItemVisible ? isItemVisible(node.source.id, node.source.folderId) : true) {
            result.push(node);
          }
        }
      }
      return result;
    };

    return filterNodes(tree);
  }, [tree, searchQuery, isFolderVisible, isItemVisible]);

  const flatRows = useMemo(
    () => flattenVisibleTreeWithDepth(filteredTree, openFolderIds),
    [filteredTree, openFolderIds],
  );

  const isVirtualized =
    flatRows.length > TREE_VIRTUALIZATION_THRESHOLD && Boolean(scrollElement);

  // eslint-disable-next-line react/incompatible-library -- third-party virtualizer API
  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => scrollElement ?? null,
    estimateSize: () => 24,
    overscan: 5,
    getItemKey: (idx) => flatRows[idx]?.node.id ?? idx,
    enabled: isVirtualized,
    initialRect: { width: 800, height: 600 },
  });

  if (isPending)
    return <Loader2 className="mx-auto my-10 size-4 animate-spin text-muted-foreground" />;

  if (isError) {
    return (
      <div
        role="alert"
        className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive"
      >
        <AlertTriangle className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1">{t("sourcesList.failedToLoad")}</span>
        {onRetryLoad && (
          <button
            type="button"
            onClick={onRetryLoad}
            className="shrink-0 cursor-pointer rounded-md px-2 py-1 font-medium text-destructive underline-offset-2 hover:underline"
          >
            {t("sourcesList.retry", "Retry")}
          </button>
        )}
      </div>
    );
  }

  if (hasNoSources && (!folders || folders.length === 0)) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm font-medium text-foreground">{t("sourcesList.emptyTitle")}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {t("sourcesList.emptyDescription")}
        </p>
      </div>
    );
  }

  if (Boolean(searchQuery) && filteredTree.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-xs text-muted-foreground">
        <p className="font-medium text-foreground">No matching sources</p>
        <p className="mt-1">Try another search term.</p>
      </div>
    );
  }

  const branchProps = {
    allFolders: folders,
    openFolderIds,
    onToggleFolder,
    onCreateFolder,
    onMove,
    canMove,
    setFolderOpen,
    onExpandAll,
    onCollapseAll,
    onSelectSource,
    onDeleteSource: onDelete,
    onRetrySource: onRetry,
    onCancelSource: onCancel,
    deletingId,
    retryingId,
    cancellingId,
    editingItemId,
    onBeginRename,
    onRenameCommit,
    onRenameCancel,
    onDeleteFolder,
    focusedItemId,
    treeHasFocus,
    registerNode,
    onKeyDown,
    onFocusItem,
    isMultiselectMode,
    selectedIds,
    onToggleItemSelect,
    onToggleFolderSelect,
    isFolderSelected,
    searchQuery,
  };

  if (isVirtualized) {
    return (
      <div
        role="tree"
        ref={registerTreeSurface}
        aria-label={t("panels.sources", "Sources")}
        data-size="sm"
        className={cn(treeVariants({ size: "sm" }), "flex flex-col gap-0.5")}
      >
        <div
          data-slot="sources-tree-virtual-window"
          className="w-full relative min-w-full h-(--virtual-total)"
          style={{ "--virtual-total": `${virtualizer.getTotalSize()}px` } as React.CSSProperties}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = flatRows[virtualRow.index];
            if (!row) return null;

            return (
              <div
                key={row.node.id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className="absolute top-0 left-0 w-full translate-y-(--virtual-start)"
                style={{ "--virtual-start": `${virtualRow.start}px` } as React.CSSProperties}
              >
                <SourcesTreeNodeRow node={row.node} depth={row.depth} {...branchProps} />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      role="tree"
      ref={registerTreeSurface}
      aria-label={t("panels.sources", "Sources")}
      data-size="sm"
      className={cn(treeVariants({ size: "sm" }), "flex flex-col gap-0.5")}
    >
      {filteredTree.map((node) => (
        <SourcesTreeBranch key={node.id} node={node} depth={0} {...branchProps} />
      ))}
    </div>
  );
}, areSourcesListPropsEqual);

function areSourcesListPropsEqual(prev: SourcesListProps, next: SourcesListProps): boolean {
  return (
    prev.sources === next.sources &&
    prev.folders === next.folders &&
    prev.openFolderIds === next.openFolderIds &&
    prev.editingItemId === next.editingItemId &&
    prev.focusedItemId === next.focusedItemId &&
    prev.treeHasFocus === next.treeHasFocus &&
    prev.isPending === next.isPending &&
    prev.isError === next.isError &&
    prev.hasNoSources === next.hasNoSources &&
    prev.deletingId === next.deletingId &&
    prev.retryingId === next.retryingId &&
    prev.cancellingId === next.cancellingId &&
    prev.scrollElement === next.scrollElement &&
    prev.isMultiselectMode === next.isMultiselectMode &&
    prev.selectedIds === next.selectedIds &&
    prev.searchQuery === next.searchQuery
  );
}
