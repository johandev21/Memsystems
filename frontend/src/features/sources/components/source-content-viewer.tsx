import { useQuery } from "@tanstack/react-query";
import { sourceQueryOptions } from "../api/sources";
import type { SourceWithContent } from "../types";
import { SourceReaderSkeleton } from "./skeletons/source-reader-skeleton";
import {
  isSourceProcessing,
  sourceProcessingStatus,
  SOURCE_POLL_INTERVAL_MS,
} from "../utils/source-processing";
import { detectDocumentType } from "../utils/detect-document-type";
import type { SourceContentViewerProps } from "./content-viewer/source-content-types";
import {
  useCachedSourceSummary,
  useSourceReaderControls,
} from "./content-viewer/use-source-reader-controls";
import { SourceReaderHeader } from "./content-viewer/source-reader-header";
import { SourceProcessingState, SourceReaderError } from "./content-viewer/source-reader-states";
import { SourceDocument } from "./content-viewer/source-document-renderer";

export type { SourceContentViewerProps };

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
          ? "fixed inset-0 z-viewer flex h-dvh w-screen flex-col bg-panel-bg text-foreground overflow-hidden animate-in fade-in duration-150"
          : "flex h-full flex-col bg-panel-bg text-foreground overflow-hidden animate-in fade-in duration-150"
      }
    >
      <SourceReaderHeader
        source={source}
        controls={readerControls}
        forceFullscreen={forceFullscreen}
        onClose={onClose}
      />
      <SourceDocument source={source} controls={readerControls} selectedLocator={selectedLocator} />
    </div>
  );
}
