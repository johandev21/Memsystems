import type { VisionExtractionResult } from '../vision-extraction.port';
import type { VideoKeyframe } from '../video-inspector.service';

export type ExtractionMethod =
  | 'text'
  | 'file'
  | 'readability'
  | 'playwright'
  | 'firecrawl'
  | 'vision'
  | 'audio'
  | 'transcription'
  | 'video'
  | 'youtube'
  | 'tabular'
  | 'parser';

export type DocumentSectionKind =
  | 'text'
  | 'heading'
  | 'code'
  | 'table'
  | 'formula'
  | 'visual_description'
  | 'transcript';

export interface DocumentSectionLocator {
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
  imageRegion?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  [key: string]: unknown;
}

export interface DocumentSection {
  headingPath: string[];
  content: string;
  ordinal: number;
  pageNumber?: number;
  kind?: DocumentSectionKind;
  locator?: DocumentSectionLocator;
  metadata?: Record<string, unknown>;
}

export interface NormalizedDocument {
  title: string;
  text: string;
  markdown?: string;
  sourceUrl?: string;
  canonicalUrl?: string;
  fetchedUrl?: string;
  language?: string;
  author?: string;
  pageCount?: number;
  siteName?: string;
  publishedAt?: string;
  modifiedAt?: string;
  extractionMethod: ExtractionMethod;
  contentType?: string;
  contentHash: string;
  sections: DocumentSection[];
  linkDensity?: number;
}

export interface FileDocumentInput {
  text: string;
  contentType: string;
  fileName?: string;
  title?: string;
  pageCount?: number;
}

export const NORMALIZATION_VERSION = 1;
export const EXTRACTOR_VERSION = '2-firecrawl';

export interface TabularDocumentOptions {
  title?: string;
}

export interface ImageDocumentOptions {
  title?: string;
  fileName?: string;
  filename?: string;
  contentType?: string;
  sourceUrl?: string;
}

export interface AudioDocumentOptions {
  title?: string;
  fileName?: string;
  filename?: string;
  contentType?: string;
  sourceUrl?: string;
  language?: string;
}

export interface VideoDocumentOptions {
  title?: string;
  fileName?: string;
  filename?: string;
  contentType?: string;
  sourceUrl?: string;
  language?: string;
  visualResults?: Array<{
    keyframe: VideoKeyframe;
    result: VisionExtractionResult;
  }>;
}

export interface YouTubeDocumentOptions {
  title?: string;
  author?: string;
  sourceUrl?: string;
  canonicalUrl?: string;
  contentType?: string;
}

export interface PptxDocumentOptions {
  title?: string;
  filename?: string;
  fileName?: string;
}

export interface EpubDocumentOptions {
  title?: string;
  filename?: string;
  fileName?: string;
}
