import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  File,
  Loader2,
  Maximize2,
  Minimize2,
  MoreVertical,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sourceQueryOptions } from "../api/sources";
import type { Source, SourceWithContent } from "../types";
import { SourceReaderSkeleton } from "./skeletons";
import {
  isSourceProcessing,
  processingStageLabel,
  sourceProcessingError,
  sourceProcessingStatus,
  SOURCE_POLL_INTERVAL_MS,
} from "../utils/source-processing";
import { cn } from "@/shared/utils/cn";
import { fetchApi } from "@/shared/api";
import {
  ArticleDocumentViewer,
  AudioDocumentViewer,
  detectDocumentType,
  ImageDocumentViewer,
  MarkdownDocumentViewer,
  PlainTextDocumentViewer,
  PptxDocumentViewer,
  TabularDocumentViewer,
  VideoDocumentViewer,
} from "./renderers";
import type { SourceSegmentLocator } from "../types";

interface SourceContentViewerProps {
  sourceId: string;
  onClose: () => void;
  defaultFullscreen?: boolean;
  forceFullscreen?: boolean;
  selectedLocator?: SourceSegmentLocator | null;
}

function ReaderMoreMenu({
  source,
  downloading,
  onDownload,
  isFullscreen,
}: {
  source: SourceWithContent;
  downloading: boolean;
  onDownload: () => void;
  isFullscreen: boolean;
}) {
  const showWebpage = source.kind === "url" && !!source.url;
  const showDownload = source.kind === "file";

  if (!showWebpage && !showDownload) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label="More actions"
          />
        }
      >
        <MoreVertical className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        layerClassName={isFullscreen ? "z-viewer-popover" : undefined}
        className="w-48"
      >
        {showWebpage && (
          <DropdownMenuItem
            render={
              <a
                href={source.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer"
              />
            }
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open Webpage
          </DropdownMenuItem>
        )}
        {showDownload && (
          <DropdownMenuItem onClick={onDownload} disabled={downloading} className="cursor-pointer">
            {downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Download File
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function useCachedSourceSummary(sourceId: string): Source | undefined {
  const queryClient = useQueryClient();
  const allSources = queryClient.getQueriesData<Source[]>({ queryKey: ["sources"] });
  for (const [, list] of allSources) {
    const match = list?.find((s) => s.id === sourceId);
    if (match) return match;
  }
  return undefined;
}

export function SourceContentViewer({
  sourceId,
  onClose,
  defaultFullscreen,
  forceFullscreen,
  selectedLocator,
}: SourceContentViewerProps) {
  const cachedSource = useCachedSourceSummary(sourceId);
  const {
    data: source,
    isPending,
    isError,
  } = useQuery({
    ...sourceQueryOptions(sourceId),
    staleTime: 0,
    refetchInterval: (query) => {
      const current = query.state.data as SourceWithContent | undefined;
      return current && isSourceProcessing(current) ? SOURCE_POLL_INTERVAL_MS : false;
    },
  });
  const readerControls = useSourceReaderControls({
    defaultFullscreen,
    forceFullscreen,
    onClose,
    source,
  });

  if (isPending) {
    const detectedType = cachedSource ? detectDocumentType(cachedSource) : null;
    return (
      <SourceReaderSkeleton
        detectedType={detectedType}
        title={cachedSource?.title}
        isFullscreen={readerControls.isFullscreen}
        forceFullscreen={forceFullscreen}
        onClose={onClose}
      />
    );
  }

  if (isError || !source) {
    return <SourceReaderError onClose={onClose} />;
  }

  const status = sourceProcessingStatus(source);
  if (status !== "ready") {
    return <SourceProcessingState source={source} onClose={onClose} />;
  }

  return (
    <div
      className={
        readerControls.isEffectivelyFullscreen
          ? "fixed inset-0 z-viewer flex h-[100dvh] w-screen flex-col bg-panel-bg text-foreground overflow-hidden animate-in fade-in duration-150"
          : "flex h-full flex-col bg-panel-bg text-foreground overflow-hidden animate-in fade-in duration-150"
      }
    >
      <SourceReaderHeader
        source={source}
        controls={readerControls}
        forceFullscreen={forceFullscreen}
        onClose={onClose}
      />
      <SourceDocument
        source={source}
        controls={readerControls}
        selectedLocator={selectedLocator}
      />
    </div>
  );
}

function SourceProcessingState({
  source,
  onClose,
}: {
  source: SourceWithContent;
  onClose: () => void;
}) {
  const status = sourceProcessingStatus(source);
  const active = isSourceProcessing(source);
  const error = sourceProcessingError(source);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        {active ? <Loader2 className="size-6 animate-spin" /> : <File className="size-6" />}
      </div>
      <h2 className="text-lg font-bold">
        {active
          ? processingStageLabel(status, source.processingStage)
          : processingStageLabel(status)}
      </h2>
      <p className="max-w-sm text-xs text-muted-foreground">
        {active
          ? "This source will become available here when processing finishes."
          : error || "This source is not available for reading."}
      </p>
      <Button variant="outline" size="sm" onClick={onClose} className="mt-2 cursor-pointer text-xs">
        Back to Sources
      </Button>
    </div>
  );
}

function useSourceReaderControls({
  defaultFullscreen,
  forceFullscreen,
  onClose,
  source,
}: {
  defaultFullscreen?: boolean;
  forceFullscreen?: boolean;
  onClose: () => void;
  source?: SourceWithContent;
}) {
  const [downloading, setDownloading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(() =>
    Boolean(defaultFullscreen || forceFullscreen),
  );
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const isEffectivelyFullscreen = Boolean(forceFullscreen || isFullscreen);

  useEffect(() => {
    if (!isEffectivelyFullscreen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (forceFullscreen) onClose();
      else setIsFullscreen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEffectivelyFullscreen, forceFullscreen, onClose]);

  const handleDownload = async () => {
    if (!source || source.kind !== "file") return;
    setDownloading(true);
    try {
      const response = await fetchApi(`/api/sources/${source.id}/download`);
      if (!response.ok) throw new Error("Failed to retrieve download link");
      const { url } = await response.json();
      window.open(url, "_blank");
      toast.success("Download started");
    } catch {
      toast.error("Download failed");
    } finally {
      setDownloading(false);
    }
  };

  return {
    downloading,
    handleDownload,
    isEffectivelyFullscreen,
    isFullscreen,
    scrollElement,
    setScrollElement,
    toggleFullscreen: () => setIsFullscreen((value) => !value),
  };
}


function SourceReaderError({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
        <File className="size-6" />
      </div>
      <h2 className="text-lg font-bold">Failed to load document</h2>
      <p className="max-w-xs text-xs text-muted-foreground">
        Unable to load source details. Please try again.
      </p>
      <Button variant="outline" size="sm" onClick={onClose} className="mt-2 cursor-pointer text-xs">
        Back to Sources
      </Button>
    </div>
  );
}

type ReaderControls = ReturnType<typeof useSourceReaderControls>;

function SourceReaderHeader({
  source,
  controls,
  forceFullscreen,
  onClose,
}: {
  source: SourceWithContent;
  controls: ReaderControls;
  forceFullscreen?: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 p-1.5 bg-panel-header-bg min-h-[44px] shrink-0 select-none">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg shrink-0"
          aria-label="Back to sources"
          title="Back to sources"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-sm font-semibold truncate text-foreground min-w-0 flex-1">
          {source.title}
        </h3>
      </div>
      <div className="flex items-center gap-1">
        <ReaderMoreMenu
          source={source}
          downloading={controls.downloading}
          onDownload={controls.handleDownload}
          isFullscreen={controls.isEffectivelyFullscreen}
        />
        {!forceFullscreen && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={controls.toggleFullscreen}
            className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg"
            title={controls.isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen Mode"}
          >
            {controls.isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        )}
        {controls.isEffectivelyFullscreen && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg"
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function SourceDocument({
  source,
  controls,
  selectedLocator,
}: {
  source: SourceWithContent;
  controls: ReaderControls;
  selectedLocator?: SourceSegmentLocator | null;
}) {
  const documentType = detectDocumentType(source);
  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      {documentType === "image" ? (
        <ImageDocumentViewer
          source={source}
          selectedLocator={selectedLocator}
          scrollElement={controls.scrollElement}
        />
      ) : documentType === "audio" ? (
        <AudioDocumentViewer
          source={source}
          selectedLocator={selectedLocator}
          scrollElement={controls.scrollElement}
        />
      ) : documentType === "video" ? (
        <VideoDocumentViewer
          source={source}
          selectedLocator={selectedLocator}
          scrollElement={controls.scrollElement}
        />
      ) : documentType === "slides" ? (
        <PptxDocumentViewer
          source={source}
          selectedLocator={selectedLocator}
          scrollElement={controls.scrollElement}
        />
      ) : documentType === "dataset" ? (
        <div
          ref={controls.setScrollElement}
          className="h-full w-full overflow-y-auto overscroll-contain"
        >
          <div
            className={cn(
              "w-full flex flex-col",
              controls.isEffectivelyFullscreen
                ? "px-4 sm:px-8 py-4 sm:py-6 max-w-5xl mx-auto gap-4"
                : "p-3 sm:p-4",
            )}
          >
            <TabularDocumentViewer
              source={source}
              selectedLocator={selectedLocator}
              scrollElement={controls.scrollElement}
            />
          </div>
        </div>
      ) : documentType === "plaintext" ? (
        <div
          ref={controls.setScrollElement}
          className="h-full w-full overflow-y-auto overscroll-contain"
        >
          <div
            className={cn(
              "w-full flex flex-col",
              controls.isEffectivelyFullscreen
                ? "px-4 sm:px-8 py-4 sm:py-6 max-w-4xl mx-auto gap-4"
                : "p-3 sm:p-4",
            )}
          >
            <PlainTextDocumentViewer
              content={source.rawText}
              selectedLocator={selectedLocator}
              scrollElement={controls.scrollElement}
            />
          </div>
        </div>
      ) : documentType === "article" ? (
        <div
          ref={controls.setScrollElement}
          className="h-full w-full overflow-y-auto overscroll-contain"
        >
          <div
            className={cn(
              "w-full flex flex-col",
              controls.isEffectivelyFullscreen
                ? "px-4 sm:px-8 py-4 sm:py-6 max-w-4xl mx-auto gap-4"
                : "p-3 sm:p-4",
            )}
          >
            <ArticleDocumentViewer
              content={source.rawText}
              scrollElement={controls.scrollElement}
            />
          </div>
        </div>
      ) : (
        <div
          ref={controls.setScrollElement}
          className="h-full w-full overflow-y-auto overscroll-contain"
        >
          <div
            className={cn(
              "w-full flex flex-col",
              controls.isEffectivelyFullscreen
                ? "px-4 sm:px-8 py-4 sm:py-6 max-w-4xl mx-auto gap-4"
                : "p-3 sm:p-4",
            )}
          >
            <MarkdownDocumentViewer
              content={source.rawText}
              selectedLocator={selectedLocator}
              scrollElement={controls.scrollElement}
            />
          </div>
        </div>
      )}
    </div>
  );
}
