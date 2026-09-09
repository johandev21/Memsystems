import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef } from "react";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  type Source,
  sourcesQueryOptions,
} from "../api/sources";
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const {
    data: sources,
    isPending,
    isError,
  } = useQuery({
    ...sourcesQueryOptions(notebookId),
    staleTime: 0,
    refetchInterval: (query) => {
      const current = query.state.data as Source[] | undefined;
      return current?.some(isSourceProcessing) ? SOURCE_POLL_INTERVAL_MS : false;
    },
  });

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
    !isPending && !isError && (sources?.length ?? 0) === 0 && pendingUploads.length === 0;

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div
        ref={scrollContainerRef}
        className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 overflow-auto p-2"
      >
        {pendingUploads.map((upload) => (
          <PendingUploadRow key={upload.id} upload={upload} onCancel={cancelPendingUpload} />
        ))}

        <SourcesList
          sources={sources}
          isPending={isPending}
          isError={isError}
          hasNoSources={hasNoSources}
          scrollElement={scrollContainerRef.current}
          onSelectSource={onSelectSource}
          onDelete={(source) => setSourceToDelete({ id: source.id, title: source.title })}
          onRetry={(source) => retryMutation.mutate(source.id)}
          onCancel={(source) => cancelMutation.mutate(source.id)}
          deletingId={deleteMutation.isPending ? deleteMutation.variables : undefined}
          retryingId={retryMutation.isPending ? retryMutation.variables : undefined}
          cancellingId={cancelMutation.isPending ? cancelMutation.variables : undefined}
        />
      </div>

      <div className="p-2">
        <AddSourceDialog notebookId={notebookId}>
          <div className="cursor-pointer rounded-2xl border-2 border-dashed border-border p-4 text-center text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5">
            Add sources (PDF, Web, Text) to inform your AI study assistant
          </div>
        </AddSourceDialog>
      </div>

      <ConfirmDeleteDialog
        open={sourceToDelete !== null}
        onOpenChange={(open) => !open && setSourceToDelete(null)}
        title="Delete Source"
        description={`Are you sure you want to delete "${sourceToDelete?.title ?? ""}"?`}
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
