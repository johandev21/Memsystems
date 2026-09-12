import type { SourceSegmentLocator, SourceWithContent } from "../../../types";

export type ViewMode = "split" | "image" | "notes";

export interface ParsedImageSection {
  id: string;
  ordinal: number;
  kind: "heading" | "text" | "formula" | "visual_description" | "warning";
  content: string;
  headingLevel?: number;
  locator?: SourceSegmentLocator;
  warning?: string;
}

export interface ImageDocumentViewerProps {
  source: SourceWithContent;
  selectedLocator?: SourceSegmentLocator | null;
  scrollElement?: HTMLDivElement | null;
}
