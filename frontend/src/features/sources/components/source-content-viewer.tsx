import { sourceDisplayTitle } from "../utils/source-display-title";
import { isYouTubeUrl } from "../utils/detect-document-type";
import { SourceReaderSkeleton } from "./skeletons/source-reader-skeleton";
import { sourceProcessingStatus } from "../utils/source-processing";
import type { SourceContentViewerProps } from "./content-viewer/source-content-types";
import {
  useCachedSourceSummary,
  useSourceReaderControls,
} from "./content-viewer/use-source-reader-controls";
import { SourceReaderHeader } from "./content-viewer/source-reader-header";
import { SourceProcessingState, SourceReaderError } from "./content-viewer/source-reader-states";
import { SourceDocument } from "./content-viewer/source-document-renderer";
import { useSourceDetail } from "../hooks/use-source-detail";

export type { SourceContentViewerProps };

export function SourceContentViewer({
  sourceId,
  onClose,
  defaultFullscreen,
  forceFullscreen,
  selectedLocator,
}: SourceContentViewerProps) {
  const cachedSource = useCachedSourceSummary(sourceId);
  const { data: source, isPending, isError } = useSourceDetail(sourceId);

  const readerControls = useSourceReaderControls({
    defaultFullscreen,
    forceFullscreen,
    onClose,
    source,
  });

  if (isPending) {
    return (
      <SourceReaderSkeleton
        title={cachedSource ? sourceDisplayTitle(cachedSource) : undefined}
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
  if (status !== "ready" && !isYouTubeUrl(source.url)) {
    return <SourceProcessingState source={source} onClose={onClose} />;
  }

  return (
    <div
      className={
        readerControls.isEffectivelyFullscreen
          ? "fixed inset-0 z-viewer flex h-dvh w-screen flex-col bg-panel-bg text-foreground overflow-hidden animate-in fade-in duration-150 pb-safe"
          : "flex h-full flex-col bg-panel-bg text-foreground overflow-hidden animate-in fade-in duration-150 pb-safe"
      }
    >
      <SourceReaderHeader
        source={source}
        controls={readerControls}
        forceFullscreen={forceFullscreen}
        onClose={onClose}
      />
      {status === "ready" ? (
        <SourceDocument
          source={source}
          controls={readerControls}
          selectedLocator={selectedLocator}
        />
      ) : (
        <SourceProcessingState source={source} onClose={onClose} />
      )}
    </div>
  );
}
