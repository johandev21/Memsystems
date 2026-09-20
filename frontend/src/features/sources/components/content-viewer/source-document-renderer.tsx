import { cn } from "@/shared/utils/cn";
import type { SourceSegmentLocator, SourceWithContent } from "../../types";
import { detectDocumentType } from "../../utils/detect-document-type";
import { ArticleDocumentViewer } from "../renderers/article-document-viewer";
import { AudioDocumentViewer } from "../renderers/audio-document-viewer";
import { ImageDocumentViewer } from "../renderers/image-document-viewer";
import { MarkdownDocumentViewer } from "../renderers/markdown-document-viewer";
import { PlainTextDocumentViewer } from "../renderers/plain-text-document-viewer";
import { PptxDocumentViewer } from "../renderers/pptx-document-viewer";
import { TabularDocumentViewer } from "../renderers/tabular-document-viewer";
import { VideoDocumentViewer } from "../renderers/video-document-viewer";
import type { ReaderControls } from "./source-content-types";

function ScrollableDocumentContainer({
  controls,
  maxWidth = "max-w-4xl",
  children,
}: {
  controls: ReaderControls;
  maxWidth?: string;
  children: React.ReactNode;
}) {
  const { setScrollElement, isEffectivelyFullscreen } = controls;
  return (
    <div
      ref={setScrollElement}
      className="h-full w-full overflow-y-auto overscroll-contain"
    >
      <div
        className={cn(
          "w-full flex flex-col",
          isEffectivelyFullscreen
            ? `px-4 sm:px-8 py-4 sm:py-6 ${maxWidth} mx-auto gap-4`
            : "p-3 sm:p-4",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function renderDocumentContent(
  documentType: ReturnType<typeof detectDocumentType>,
  source: SourceWithContent,
  controls: ReaderControls,
  selectedLocator?: SourceSegmentLocator | null,
) {
  switch (documentType) {
    case "image":
      return (
        <ImageDocumentViewer
          source={source}
          selectedLocator={selectedLocator}
          scrollElement={controls.scrollElement}
        />
      );
    case "audio":
      return (
        <AudioDocumentViewer
          source={source}
          selectedLocator={selectedLocator}
          scrollElement={controls.scrollElement}
        />
      );
    case "video":
      return (
        <VideoDocumentViewer
          source={source}
          selectedLocator={selectedLocator}
          scrollElement={controls.scrollElement}
        />
      );
    case "slides":
      return (
        <PptxDocumentViewer
          source={source}
          selectedLocator={selectedLocator}
          scrollElement={controls.scrollElement}
        />
      );
    case "dataset":
      return (
        <ScrollableDocumentContainer controls={controls} maxWidth="max-w-5xl">
          <TabularDocumentViewer
            source={source}
            selectedLocator={selectedLocator}
            scrollElement={controls.scrollElement}
          />
        </ScrollableDocumentContainer>
      );
    case "plaintext":
      return (
        <ScrollableDocumentContainer controls={controls}>
          <PlainTextDocumentViewer
            content={source.rawText}
            selectedLocator={selectedLocator}
            scrollElement={controls.scrollElement}
          />
        </ScrollableDocumentContainer>
      );
    case "article":
      return (
        <ScrollableDocumentContainer controls={controls}>
          <ArticleDocumentViewer
            content={source.rawText}
            scrollElement={controls.scrollElement}
          />
        </ScrollableDocumentContainer>
      );
    default:
      return (
        <ScrollableDocumentContainer controls={controls}>
          <MarkdownDocumentViewer
            content={source.rawText}
            selectedLocator={selectedLocator}
            scrollElement={controls.scrollElement}
          />
        </ScrollableDocumentContainer>
      );
  }
}

export interface SourceDocumentProps {
  source: SourceWithContent;
  controls: ReaderControls;
  selectedLocator?: SourceSegmentLocator | null;
}

export function SourceDocument({ source, controls, selectedLocator }: SourceDocumentProps) {
  const documentType = detectDocumentType(source);
  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      {renderDocumentContent(documentType, source, controls, selectedLocator)}
    </div>
  );
}
