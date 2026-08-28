import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, File, FileText, Link2, Loader2, Trash2 } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/shared/ui/confirm-delete-dialog";
import {
  deleteSource,
  type Source,
  type SourceKind,
  sourcesQueryOptions,
} from "@/shared/api";
import { cn } from "@/shared/lib/utils";
import { useUploadStore } from "../model/upload-store";
import { AddSourceDialog } from "./add-source-dialog";
import { PendingUploadRow } from "./pending-upload-row";
import { WebSearchComposer } from "./web-search-composer";

export function SourcesPanel({
  notebookId,
  collapsed,
  onSelectSource,
}: {
  notebookId: string;
  collapsed?: boolean;
  onSelectSource: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const { data: sources, isPending, isError } = useQuery(sourcesQueryOptions(notebookId));

  const allPendingUploads = useUploadStore((state) => state.pendingUploads);
  const pendingUploads = useMemo(
    () => allPendingUploads.filter((u) => u.notebookId === notebookId),
    [allPendingUploads, notebookId],
  );

  const cancelPendingUpload = useUploadStore((state) => state.cancelPendingUpload);

  const [sourceToDelete, setSourceToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSource(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources", notebookId] });
      toast.success("Source removed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (collapsed) return null;

  const hasNoSources =
    !isPending && !isError && (sources?.length ?? 0) === 0 && pendingUploads.length === 0;

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 overflow-auto p-2">
        <WebSearchComposer notebookId={notebookId} />

        {pendingUploads.map((upload) => (
          <PendingUploadRow key={upload.id} upload={upload} onCancel={cancelPendingUpload} />
        ))}

        <SourcesList
          sources={sources}
          isPending={isPending}
          isError={isError}
          hasNoSources={hasNoSources}
          onSelectSource={onSelectSource}
          onDelete={(source) => setSourceToDelete({ id: source.id, title: source.title })}
          deletingId={deleteMutation.isPending ? deleteMutation.variables : undefined}
        />
      </div>

      <div className="p-2">
        <AddSourceDialog notebookId={notebookId}>
          <div className="border-2 border-dashed border-border p-4 text-center text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 cursor-pointer rounded-2xl">
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

function SourcesList({
  sources,
  isPending,
  isError,
  hasNoSources,
  onSelectSource,
  onDelete,
  deletingId,
}: {
  sources?: Source[];
  isPending: boolean;
  isError: boolean;
  hasNoSources: boolean;
  onSelectSource: (id: string) => void;
  onDelete: (source: Source) => void;
  deletingId?: string;
}) {
  if (isPending)
    return <Loader2 className="mx-auto my-10 size-4 animate-spin text-muted-foreground" />;
  if (isError) {
    return (
      <div
        role="alert"
        className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive"
      >
        <AlertTriangle className="size-3.5 shrink-0" />
        <span>Failed to load sources</span>
      </div>
    );
  }
  if (hasNoSources)
    return (
      <p className="px-2 py-10 text-center text-xs text-muted-foreground">No sources added yet</p>
    );
  return sources?.map((source) => (
    <SourceRow
      key={source.id}
      source={source}
      onClick={() => onSelectSource(source.id)}
      onDelete={() => onDelete(source)}
      deleting={deletingId === source.id}
    />
  ));
}

function SourceRow({
  source,
  onClick,
  onDelete,
  deleting,
}: {
  source: Source;
  onClick: () => void;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const Icon = getIcon(source.kind);

  return (
    <div className="group relative w-max min-w-full">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "group/row relative flex w-max min-w-full items-center gap-2 whitespace-nowrap py-2 pl-2 pr-8 text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl cursor-pointer",
          "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:text-foreground",
        )}
      >
        <span className="w-3.5 shrink-0" />
        <Icon className="size-4 shrink-0" />
        <span>{source.title}</span>
      </button>
      <button
        type="button"
        aria-label="Delete source"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(source.id);
        }}
        className={cn(
          "absolute right-2 top-1/2 -translate-y-1/2 flex size-5 items-center justify-center text-muted-foreground hover:text-destructive transition-opacity opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto cursor-pointer",
        )}
      >
        {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
      </button>
    </div>
  );
}

function getIcon(kind: SourceKind) {
  switch (kind) {
    case "file":
      return FileText;
    case "url":
      return Link2;
    case "text":
      return File;
    default:
      return File;
  }
}
