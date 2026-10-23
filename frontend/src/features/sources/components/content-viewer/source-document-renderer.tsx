import { cn } from "@/shared/utils/cn";
import type { SourceSegmentLocator, SourceWithContent } from "../../types";
import { MarkdownDocumentViewer } from "../renderers/markdown-document-viewer";
import type { ReaderControls } from "./source-content-types";

function ScrollableDocumentContainer({
  controls,
  children,
}: {
  controls: ReaderControls;
  children: React.ReactNode;
}) {
  const { setScrollElement, isEffectivelyFullscreen } = controls;
  return (
    <div ref={setScrollElement} className="h-full w-full overflow-y-auto overscroll-contain">
      <div
        className={cn(
          "w-full flex flex-col",
          isEffectivelyFullscreen
            ? "px-4 sm:px-8 py-4 sm:py-6 max-w-4xl mx-auto gap-4"
            : "p-3 sm:p-4",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export interface SourceDocumentProps {
  source: SourceWithContent;
  controls: ReaderControls;
  selectedLocator?: SourceSegmentLocator | null;
}

export function SourceDocument({ source, controls, selectedLocator }: SourceDocumentProps) {
  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      <ScrollableDocumentContainer controls={controls}>
        <MarkdownDocumentViewer
          content={source.rawText}
          segments={source.segments}
          selectedLocator={selectedLocator}
          scrollElement={controls.scrollElement}
        />
      </ScrollableDocumentContainer>
    </div>
  );
}
