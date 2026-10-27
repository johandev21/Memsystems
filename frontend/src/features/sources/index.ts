import type {
  SourceKind,
  SourceProcessingStatus,
  SourceSegmentLocator,
} from "./types/source.types";
import { sourceProcessingStatus } from "./utils/source-processing";

// Components
export { SourcesPanel } from "./components/sources-panel";
export type { SourcesPanelProps } from "./components/sources-panel";
export { SourcesPanelHeader } from "./components/sources-panel-header";
export type { SourcesPanelHeaderProps } from "./components/sources-panel-header";
export const loadSourceContentViewer = () =>
  import("./components/source-content-viewer").then((m) => ({
    default: m.SourceContentViewer,
  }));
export type { SourceContentViewerProps } from "./components/source-content-viewer";
export { SourceReaderSkeleton } from "./components/skeletons/source-reader-skeleton";
export type { SourceReaderSkeletonProps } from "./components/skeletons/source-reader-skeleton";
export { AddSourceDialog } from "./components/add-source-dialog";
export type { AddSourceDialogProps } from "./components/add-source-dialog";
export { SourceFavicon, SourceIcon } from "./components/sources-list/source-icon";
export type { SourceFaviconProps, SourceIconProps } from "./components/sources-list/source-icon";
export { PendingUploadRow } from "./components/pending-upload-row";
export type { PendingUploadRowProps } from "./components/pending-upload-row";
export { WebSearchComposer } from "./components/web-search-composer";

// API
export {
  SOURCE_LIMIT,
  cancelSource,
  createFileSource,
  createTextSource,
  createUrlSource,
  deleteSource,
  moveSource,
  reindexAllSources,
  reindexSource,
  retrySource,
  sourceQueryOptions,
  sourcesQueryOptions,
  submitSourceTranscript,
  updateSource,
} from "./api/sources";

export {
  createSourceFolder,
  deleteSourceFolder,
  sourceFoldersQueryOptions,
  updateSourceFolder,
} from "./api/source-folders";
export type {
  CreateSourceFolderInput,
  UpdateSourceFolderInput,
} from "./api/source-folders";

export {
  POLL_INTERVAL_MS as WEB_SEARCH_POLL_INTERVAL_MS,
  dismissWebSearchJob,
  importWebSources,
  startWebSearchJob,
  webSearchJobQueryOptions,
} from "./api/web-search";
export type {
  WebSearchCandidate,
  WebSearchImportResponse,
  WebSearchImportResultItem,
  WebSearchImportResultStatus,
  WebSearchJob,
  WebSearchJobStatus,
} from "./api/web-search";

// Hooks
export {
  useSourcesPanelController,
  useSourcesPanelController as useSourcesPanel,
  useSourcesPanelData,
  useSourcesPanelDrag,
  useSourcesPanelKeyboard,
  useSourcesPanelTree,
} from "./hooks/use-sources-panel-controller";
export type { SourceDeleteTarget } from "./hooks/use-sources-panel-controller";

export { useUploadStore } from "./hooks/upload-store";
export type { PendingSourceUpload } from "./hooks/upload-store";

export { useSourceDetail } from "./hooks/use-source-detail";
export { useRetrySource } from "./hooks/use-retry-source";
export { useSubmitSourceTranscript } from "./hooks/use-submit-source-transcript";
export { useWebSearch } from "./hooks/use-web-search";
export type { WebSearchPhase, WebSearchState } from "./hooks/use-web-search";
export { useAddSourceDialogState } from "./hooks/use-add-source-dialog-state";
export type { AddSourceMode } from "./hooks/use-add-source-dialog-state";
export { useSourcesTreeMutations } from "./hooks/use-sources-tree-mutations";
export { useMarkdownLocatorHighlight } from "./hooks/use-markdown-locator-highlight";

// Model
export {
  buildSourcesTree,
  canMoveSourcesItem,
  deleteSourcesFolder,
  filterSourcesTree,
  flattenVisibleTreeWithDepth,
  getDescendantFolderIds,
  moveSourcesItem,
  renameSourcesItem,
} from "./model/sources-tree";
export type {
  SourcesTreeFlatRow,
  SourcesTreeFolder,
  SourcesTreeNode,
  SourcesTreeSource,
  SourcesTreeState,
} from "./model/sources-tree";

// Utilities & Helpers
export {
  sourceDisplayTitle,
  sourceDisplayTitle as getSourceDisplayTitle,
} from "./utils/source-display-title";

export {
  SOURCE_POLL_INTERVAL_MS,
  isSourceDegraded,
  isSourceProcessing,
  processingStageLabel,
  sourceProcessingError,
  sourceProcessingErrorCode,
  sourceProcessingStatus,
  sourceQualityCorrectiveAction,
  sourceQualityReason,
  sourceQualityReasonLabel,
} from "./utils/source-processing";

export {
  extractArXivId,
  extractDoi,
  extractYouTubeId,
  getLanguageFromTitle,
  isArXivUrl,
  isDoi,
  isYouTubeUrl,
  splitTextIntoChunks,
} from "./utils/detect-document-type";

export {
  ACCEPTED_SOURCE_EXTENSIONS,
  ACCEPTED_SOURCE_EXTENSIONS as ACCEPTED_SOURCE_FILE_EXTENSIONS,
  ACCEPTED_SOURCE_MIME_TYPES,
  ACCEPTED_SOURCE_MIME_TYPES as SUPPORTED_SOURCE_MIME_TYPES,
  isClientSupportedSourceFile,
  startFileUpload,
  startTextUpload,
  startUrlUpload,
  updateUploadProgress,
} from "./utils/source-upload-actions";

export {
  formatTime as formatVideoTime,
  hasTimestampPatterns,
  parseRawTextToVideoSegments,
  parseTimestampToMs as parseVideoTimestampToMs,
} from "./utils/video-transcript-parser";
export type { ParsedVideoSegment } from "./utils/video-transcript-parser";

export {
  formatTime as formatAudioTime,
  parseRawTextToAudioSegments,
  parseTimestampToMs as parseAudioTimestampToMs,
} from "./utils/audio-transcript-parser";
export type { ParsedAudioSegment } from "./utils/audio-transcript-parser";

export { parseRawTextToSlideSegments } from "./utils/slide-segment-parser";
export type { ParsedSlideSegment } from "./utils/slide-segment-parser";

// Types
export type {
  ImageRegion,
  Source,
  SourceKind,
  SourceModality,
  SourceProcessingStage,
  SourceProcessingStatus,
  SourceQualityReason,
  SourceSegment,
  SourceSegmentKind,
  SourceSegmentLocator,
  SourceWithContent,
} from "./types/source.types";

export type { SourceFolder } from "./types/source-folder.types";

// Type Aliases
export type SourceCitationTarget = SourceSegmentLocator;
export type SourceType = SourceKind;
export type SourceStatus = SourceProcessingStatus;

// Pure Helpers
export function isSourceReadyForUse(source: {
  status?: SourceProcessingStatus;
  processingStatus?: SourceProcessingStatus;
}): boolean {
  return (
    sourceProcessingStatus(source as Parameters<typeof sourceProcessingStatus>[0]) === "ready"
  );
}

export function getSourceIconType(source: { modality?: string | null; kind?: string }): string {
  return source.modality ?? source.kind ?? "text";
}
