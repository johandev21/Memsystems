export type SourceKind = "text" | "url" | "file";

export type SourceModality =
  | "document"
  | "image"
  | "audio"
  | "video"
  | "code"
  | "dataset"
  | "slides"
  | "ebook";

export type SourceProcessingStatus = "pending" | "processing" | "ready" | "failed" | "cancelled";

export type SourceProcessingStage =
  | "uploading"
  | "extracting"
  | "transcribing"
  | "analyzing_visuals"
  | "indexing";

export interface ImageRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SourceSegmentLocator {
  pageNumber?: number;
  slideNumber?: number;
  startOffsetMs?: number;
  endOffsetMs?: number;
  speaker?: string;
  sheetName?: string;
  cellRange?: string;
  symbol?: string;
  lineStart?: number;
  lineEnd?: number;
  imageRegion?: ImageRegion;
}

export type SourceSegmentKind =
  | "text"
  | "heading"
  | "code"
  | "table"
  | "formula"
  | "visual_description"
  | "transcript";

export interface SourceSegment {
  id?: string;
  ordinal?: number;
  kind?: SourceSegmentKind | string;
  content: string;
  locator?: SourceSegmentLocator;
  metadata?: Record<string, unknown>;
}

export interface Source {
  id: string;
  notebookId: string;
  kind: SourceKind;
  title: string;
  url: string | null;
  contentType: string | null;
  fileSize: number | null;
  createdAt: string;
  modality?: SourceModality | null;
  processingStatus?: SourceProcessingStatus | null;
  processingStage?: SourceProcessingStage | null;
  processingErrorCode?: string | null;
  processingErrorMessage?: string | null;
  processingError?: { code?: string | null; message?: string | null } | null;
  /** Compatibility aliases used by early processing-status responses. */
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface SourceWithContent extends Source {
  rawText: string;
  s3Key: string | null;
  sha256: string | null;
  segments?: SourceSegment[];
}

