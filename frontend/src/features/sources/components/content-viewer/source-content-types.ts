import type { SourceSegmentLocator } from "../../types";

export interface SourceContentViewerProps {
  sourceId: string;
  onClose: () => void;
  defaultFullscreen?: boolean;
  forceFullscreen?: boolean;
  selectedLocator?: SourceSegmentLocator | null;
}

export interface ReaderControls {
  downloading: boolean;
  handleDownload: () => Promise<void>;
  isEffectivelyFullscreen: boolean;
  isFullscreen: boolean;
  scrollElement: HTMLDivElement | null;
  setScrollElement: (el: HTMLDivElement | null) => void;
  toggleFullscreen: () => void;
}
