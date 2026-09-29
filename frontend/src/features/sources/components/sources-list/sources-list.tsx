import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Source } from "../../api/sources";
import type { SourceFolder } from "../../types/source-folder.types";
import { buildSourcesTree } from "../../model/sources-tree";
import { SourcesTreeBranch } from "../sources-tree-branch";
import { SourceRow } from "./source-row";
import { cn } from "@/shared/utils/cn";

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
}

export function SourcesList({
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
}: SourcesListProps) {
  const { t } = useTranslation("sources");
  const hasFolders = Boolean(folders && folders.length > 0);
  const isVirtualized =
    !hasFolders && (sources?.length ?? 0) > 25 && scrollElement !== undefined;

  const tree = useMemo(
    () =>
      buildSourcesTree({
        folders: folders ?? [],
        sources: sources ?? [],
      }),
    [folders, sources],
  );

  // TanStack Virtual returns functions that React Compiler cannot memoize; the
  // compiler already skips this component, which is the intended behavior.
  // eslint-disable-next-line react/incompatible-library -- third-party virtualizer API
  const virtualizer = useVirtualizer({
    count: sources?.length ?? 0,
    getScrollElement: () => scrollElement ?? null,
    estimateSize: () => 40,
    overscan: 5,
    getItemKey: (idx) => sources?.[idx]?.id ?? idx,
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
        <span>{t("sourcesList.failedToLoad")}</span>
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

  if (hasFolders) {
    return (
      <div role="tree" aria-label={t("panels.sources", "Sources")} className="flex flex-col gap-0.5">
        {tree.map((node) => (
          <SourcesTreeBranch
            key={node.id}
            node={node}
            allFolders={folders}
            depth={0}
            openFolderIds={openFolderIds}
            onToggleFolder={onToggleFolder}
            onCreateFolder={onCreateFolder}
            onMove={onMove}
            canMove={canMove}
            setFolderOpen={setFolderOpen}
            onExpandAll={onExpandAll}
            onCollapseAll={onCollapseAll}
            onSelectSource={onSelectSource}
            onDeleteSource={onDelete}
            onRetrySource={onRetry}
            onCancelSource={onCancel}
            deletingId={deletingId}
            retryingId={retryingId}
            cancellingId={cancellingId}
            editingItemId={editingItemId}
            onBeginRename={onBeginRename}
            onRenameCommit={onRenameCommit}
            onRenameCancel={onRenameCancel}
            onDeleteFolder={onDeleteFolder}
          />
        ))}
      </div>
    );
  }

  if (isVirtualized && sources) {
    return (
      <div
        className={cn("w-full relative min-w-full", "h-(--virtual-total)")}
        style={{ "--virtual-total": `${virtualizer.getTotalSize()}px` } as React.CSSProperties}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const source = sources[virtualRow.index];
          if (!source) return null;

          return (
            <div
              key={source.id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full translate-y-(--virtual-start)"
              style={{ "--virtual-start": `${virtualRow.start}px` } as React.CSSProperties}
            >
              <SourceRow
                source={source}
                allFolders={folders}
                onClick={() => onSelectSource(source.id)}
                onDelete={() => onDelete(source)}
                onRetry={() => onRetry(source)}
                onCancel={() => onCancel(source)}
                onMove={onMove}
                canMove={canMove}
                deleting={deletingId === source.id}
                retrying={retryingId === source.id}
                cancelling={cancellingId === source.id}
                isEditing={editingItemId === source.id}
                onBeginRename={onBeginRename}
                onRenameCommit={onRenameCommit}
                onRenameCancel={onRenameCancel}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return sources?.map((source) => (
    <SourceRow
      key={source.id}
      source={source}
      allFolders={folders}
      onClick={() => onSelectSource(source.id)}
      onDelete={() => onDelete(source)}
      onRetry={() => onRetry(source)}
      onCancel={() => onCancel(source)}
      onMove={onMove}
      canMove={canMove}
      deleting={deletingId === source.id}
      retrying={retryingId === source.id}
      cancelling={cancellingId === source.id}
      isEditing={editingItemId === source.id}
      onBeginRename={onBeginRename}
      onRenameCommit={onRenameCommit}
      onRenameCancel={onRenameCancel}
    />
  ));
}
