import type { SourceSegmentLocator, SourceWithContent } from "../../../types";

export interface PptxDocumentViewerProps {
  source: SourceWithContent;
  selectedLocator?: SourceSegmentLocator | null;
  scrollElement?: HTMLDivElement | null;
}
