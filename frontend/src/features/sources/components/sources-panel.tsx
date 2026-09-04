import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Code,
  File,
  FileText,
  Headphones,
  ImageIcon,
  Link2,
  Loader2,
  Presentation,
  RotateCcw,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  cancelSource,
  deleteSource,
  retrySource,
  type Source,
  sourcesQueryOptions,
} from "../api/sources";
import { cn } from "@/shared/utils/cn";
import { useUploadStore } from "../hooks/use-upload-store";
import { AddSourceDialog } from "./add-source-dialog";
import { PendingUploadRow } from "./pending-upload-row";
import {
  isSourceProcessing,
  processingStageLabel,
  sourceProcessingError,
  sourceProcessingStatus,
} from "../utils/source-processing";
import { SOURCE_POLL_INTERVAL_MS } from "../utils/source-processing";
import { isYouTubeUrl } from "../utils/detect-document-type";

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
    onError: (error: Error) => toast.error(error.message),
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => retrySource(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources", notebookId] });
      toast.info("Source processing restarted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelSource(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources", notebookId] });
      toast.info("Source processing cancelled");
    },
    onError: (error: Error) => toast.error(error.message),
  });

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

function SourcesList({
  sources,
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
}: {
  sources?: Source[];
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
}) {
  const isVirtualized = (sources?.length ?? 0) > 25 && scrollElement !== undefined;

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
        <span>Failed to load sources</span>
      </div>
    );
  }
  if (hasNoSources)
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm font-medium text-foreground">No sources yet</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Add material to ground your chats and study materials.
        </p>
      </div>
    );

  if (isVirtualized && sources) {
    return (
      <div
        className="w-full relative min-w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const source = sources[virtualRow.index];
          if (!source) return null;

          return (
            <div
              key={source.id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <SourceRow
                source={source}
                onClick={() => onSelectSource(source.id)}
                onDelete={() => onDelete(source)}
                onRetry={() => onRetry(source)}
                onCancel={() => onCancel(source)}
                deleting={deletingId === source.id}
                retrying={retryingId === source.id}
                cancelling={cancellingId === source.id}
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
      onClick={() => onSelectSource(source.id)}
      onDelete={() => onDelete(source)}
      onRetry={() => onRetry(source)}
      onCancel={() => onCancel(source)}
      deleting={deletingId === source.id}
      retrying={retryingId === source.id}
      cancelling={cancellingId === source.id}
    />
  ));
}

function SourceRow({
  source,
  onClick,
  onDelete,
  onRetry,
  onCancel,
  deleting,
  retrying,
  cancelling,
}: {
  source: Source;
  onClick: () => void;
  onDelete: () => void;
  onRetry: () => void;
  onCancel: () => void;
  deleting: boolean;
  retrying: boolean;
  cancelling: boolean;
}) {
  const Icon = getIcon(source);
  const status = sourceProcessingStatus(source);
  const active = isSourceProcessing(source);
  const failed = status === "failed";
  const statusLabel = processingStageLabel(status, source.processingStage, source.modality);
  const error = sourceProcessingError(source);

  return (
    <div className="group relative w-max min-w-full">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "group/row relative flex w-max min-w-full cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl py-2 pl-2 pr-16 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:text-foreground",
          failed
            ? "text-destructive hover:bg-destructive/5"
            : active
              ? "text-primary hover:bg-primary/5"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        title={error ?? statusLabel}
      >
        <span className="w-3.5 shrink-0" />
        {active ? (
          <Loader2 className="size-4 shrink-0 animate-spin" />
        ) : failed ? (
          <AlertCircle className="size-4 shrink-0" />
        ) : (
          <Icon className="size-4 shrink-0" />
        )}
        <span className="truncate">{source.title}</span>
        {status !== "ready" && (
          <span className="max-w-36 truncate text-xs opacity-75">{statusLabel}</span>
        )}
      </button>

      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {failed && (
          <button
            type="button"
            aria-label="Retry source processing"
            title="Retry source processing"
            onClick={(event) => {
              event.stopPropagation();
              onRetry();
            }}
            className="flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {retrying ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RotateCcw className="size-3.5" />
            )}
          </button>
        )}
        {active && (
          <button
            type="button"
            aria-label="Cancel source processing"
            title="Cancel source processing"
            onClick={(event) => {
              event.stopPropagation();
              onCancel();
            }}
            className="flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {cancelling ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <X className="size-3.5" />
            )}
          </button>
        )}
        <button
          type="button"
          aria-label="Delete source"
          title="Delete source"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className="flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-destructive"
        >
          {deleting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

function getIcon(source: Source) {
  if (
    source.modality === "video" ||
    source.contentType?.startsWith("video/") ||
    /\.(mp4|mov|mkv)$/i.test(source.title) ||
    (source.kind === "url" && isYouTubeUrl(source.url || ""))
  ) {
    return Video;
  }
  if (
    source.modality === "audio" ||
    source.contentType?.startsWith("audio/") ||
    /\.(mp3|m4a|wav|webm|aac|ogg)$/i.test(source.title)
  ) {
    return Headphones;
  }
  if (
    source.modality === "image" ||
    source.contentType?.startsWith("image/") ||
    /\.(png|jpe?g|webp|heic|heif|gif|svg|bmp)$/i.test(source.title)
  ) {
    return ImageIcon;
  }
  if (
    source.modality === "slides" ||
    source.contentType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    /\.pptx$/i.test(source.title)
  ) {
    return Presentation;
  }
  if (
    source.modality === "ebook" ||
    source.contentType === "application/epub+zip" ||
    /\.epub$/i.test(source.title)
  ) {
    return BookOpen;
  }
  if (
    source.contentType === "application/x-tex" ||
    /\.tex$/i.test(source.title)
  ) {
    return Code;
  }
  if (
    source.contentType === "text/x-bibtex" ||
    source.contentType === "application/x-bibtex" ||
    /\.bib$/i.test(source.title)
  ) {
    return FileText;
  }
  switch (source.kind) {
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
