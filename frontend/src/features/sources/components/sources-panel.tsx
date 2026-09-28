import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown, FolderOpen, FolderPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { usePersistentExpandedFolders } from "@/components/ui/tree";
import {
  type Source,
  sourcesQueryOptions,
} from "../api/sources";
import {
  createSourceFolder,
  sourceFoldersQueryOptions,
} from "../api/source-folders";
import { useUploadStore } from "../hooks/use-upload-store";
import { AddSourceDialog } from "./add-source-dialog";
import { PendingUploadRow } from "./pending-upload-row";
import {
  isSourceProcessing,
  SOURCE_POLL_INTERVAL_MS,
} from "../utils/source-processing";
import { SourcesList } from "./sources-list/sources-list";
import { useSourceMutations } from "./sources-list/use-source-mutations";

export function SourcesPanel({
  notebookId,
  collapsed,
  onSelectSource,
}: {
  notebookId: string;
  collapsed?: boolean;
  onSelectSource: (id: string) => void;
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

  const createFolderMutation = useMutation({
    mutationFn: (input: { name: string; parentId?: string | null }) =>
      createSourceFolder(notebookId, input),
    onSuccess: (newFolder) => {
      queryClient.invalidateQueries({ queryKey: ["source-folders", notebookId] });
      if (newFolder.parentId) {
        setExpandedIds((prev) => new Set([...prev, newFolder.parentId!]));
      }
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

  if (collapsed) return null;

  const hasNoSources =
    !isPending &&
    !isError &&
    (sources?.length ?? 0) === 0 &&
    (folders?.length ?? 0) === 0 &&
    pendingUploads.length === 0;

  return (
    <div className="flex h-full min-w-0 flex-col">
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
  );
}
