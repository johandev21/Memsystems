import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/shared/utils/cn";
import type { SourceSegmentLocator } from "../../types";

export interface PlainTextDocumentViewerProps {
  content: string;
  selectedLocator?: SourceSegmentLocator | null;
  scrollElement?: HTMLDivElement | null;
}

interface PlainTextBlock {
  id: string;
  index: number;
  text: string;
}

function parsePlainParagraphs(rawText: string): PlainTextBlock[] {
  if (!rawText || !rawText.trim()) return [];
  const rawParagraphs = rawText.split(/\n\n+/);
  return rawParagraphs.map((para, index) => ({
    id: `txt-block-${index}`,
    index,
    text: para,
  }));
}

export function PlainTextDocumentViewer({
  content,
  selectedLocator,
  scrollElement,
}: PlainTextDocumentViewerProps) {
  const { t } = useTranslation("sourceRenderers");
  const containerRef = useRef<HTMLDivElement>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

  const blocks = useMemo(() => parsePlainParagraphs(content || ""), [content]);

  // Find target block index based on selected locator
  const targetIndex = useMemo(() => {
    if (!selectedLocator || blocks.length === 0) return null;

    if (selectedLocator.symbol) {
      const sym = selectedLocator.symbol.toLowerCase().trim();
      const foundIdx = blocks.findIndex((b) => b.text.toLowerCase().includes(sym));
      if (foundIdx !== -1) return foundIdx;
    }

    if (typeof selectedLocator.pageNumber === "number" && selectedLocator.pageNumber > 0) {
      return Math.min(selectedLocator.pageNumber - 1, blocks.length - 1);
    }

    if (typeof selectedLocator.lineStart === "number" && selectedLocator.lineStart > 0) {
      let cumulativeLines = 0;
      for (let i = 0; i < blocks.length; i++) {
        const lineCount = blocks[i].text.split("\n").length;
        if (cumulativeLines + lineCount >= selectedLocator.lineStart) {
          return i;
        }
        cumulativeLines += lineCount + 1;
      }
      return blocks.length - 1;
    }

    return null;
  }, [selectedLocator, blocks]);

  const isVirtualized = blocks.length > 25 && scrollElement !== undefined && scrollElement !== null;

  const virtualizer = useVirtualizer({
    count: blocks.length,
    getScrollElement: () => scrollElement ?? null,
    estimateSize: () => 60,
    overscan: 6,
    getItemKey: (index) => blocks[index]?.id ?? index,
    enabled: isVirtualized,
    initialRect: { width: 800, height: 600 },
  });

  // Handle citation scrolling and highlighting
  useEffect(() => {
    if (typeof targetIndex !== "number" || targetIndex < 0) return;

    setHighlightedIndex(targetIndex);

    if (isVirtualized && scrollElement) {
      virtualizer.scrollToIndex(targetIndex, { align: "center", behavior: "smooth" });
    } else {
      const targetElement = containerRef.current?.querySelector(
        `[data-text-block-index="${targetIndex}"]`,
      );
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }

    const timer = setTimeout(() => {
      setHighlightedIndex(null);
    }, 3000);

    return () => clearTimeout(timer);
  }, [targetIndex, isVirtualized, virtualizer, scrollElement]);

  if (blocks.length === 0) {
    return (
      <div className="py-12 text-center text-xs text-muted-foreground">
        {t("plainTextViewer.noContent")}
      </div>
    );
  }

  if (isVirtualized) {
    const virtualItems = virtualizer.getVirtualItems();
    if (virtualItems.length > 0) {
      return (
        <div
          ref={containerRef}
          className="w-full relative font-mono text-xs sm:text-sm h-(--virtual-total)"
          style={{ "--virtual-total": `${virtualizer.getTotalSize()}px` } as React.CSSProperties}
        >
          {virtualItems.map((virtualRow) => {
            const block = blocks[virtualRow.index];
            if (!block) return null;
            const isHighlighted = highlightedIndex === block.index;

            return (
              <div
                key={block.id}
                data-index={virtualRow.index}
                data-text-block-index={block.index}
                ref={virtualizer.measureElement}
                className="absolute top-0 left-0 w-full translate-y-(--virtual-start) py-1.5"
                style={{ "--virtual-start": `${virtualRow.start}px` } as React.CSSProperties}
              >
                <div
                  className={cn(
                    "whitespace-pre-wrap leading-relaxed text-foreground/90 select-text break-words rounded-md p-1 transition-all duration-300",
                    isHighlighted && "bg-primary/15 ring-2 ring-primary/30",
                  )}
                >
                  {block.text}
                </div>
              </div>
            );
          })}
        </div>
      );
    }
  }

  return (
    <div ref={containerRef} className="w-full space-y-3 font-mono text-xs sm:text-sm">
      {blocks.map((block) => {
        const isHighlighted = highlightedIndex === block.index;
        return (
          <div
            key={block.id}
            data-text-block-index={block.index}
            className={cn(
              "whitespace-pre-wrap leading-relaxed text-foreground/90 select-text break-words rounded-md p-1 transition-all duration-300",
              isHighlighted && "bg-primary/15 ring-2 ring-primary/30",
            )}
          >
            {block.text}
          </div>
        );
      })}
    </div>
  );
}
