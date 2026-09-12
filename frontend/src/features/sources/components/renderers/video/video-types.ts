import type { SourceSegmentLocator, SourceWithContent } from "../../../types";
import type { ParsedVideoSegment } from "../../../utils/video-transcript-parser";

export interface VideoDocumentViewerProps {
  source: SourceWithContent;
  selectedLocator?: SourceSegmentLocator | null;
  scrollElement?: HTMLDivElement | null;
}

export type { ParsedVideoSegment };
