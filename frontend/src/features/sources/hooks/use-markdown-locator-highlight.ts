import { useEffect, useMemo, useState, type RefObject } from "react";
import type { SourceSegment, SourceSegmentLocator } from "../types/source.types";
import { splitTextIntoChunks } from "../utils/detect-document-type";

export function createSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function findSegmentTarget(
  locator: SourceSegmentLocator,
  segments: SourceSegment[] | undefined,
  content: string,
  chunks: string[],
): { chunkIndex: number; content: string } | null {
  const locatorKeys = [
    "slideNumber",
    "startOffsetMs",
    "endOffsetMs",
    "speaker",
    "sheetName",
    "cellRange",
    "lineStart",
    "lineEnd",
    "imageRegion",
  ] as const;
  const selectedKeys = locatorKeys.filter((key) => locator[key] !== undefined);
  if (!segments || selectedKeys.length === 0) return null;

  const matches = segments.filter((segment) =>
    selectedKeys.every((key) => {
      const selectedValue = locator[key];
      const segmentValue = segment.locator?.[key];
      if (key === "imageRegion") {
        const selectedRegion = locator.imageRegion;
        const segmentRegion = segment.locator?.imageRegion;
        return Boolean(
          selectedRegion &&
            segmentRegion &&
            selectedRegion.x === segmentRegion.x &&
            selectedRegion.y === segmentRegion.y &&
            selectedRegion.width === segmentRegion.width &&
            selectedRegion.height === segmentRegion.height,
        );
      }
      return selectedValue === segmentValue;
    }),
  );
  if (matches.length !== 1 || !matches[0].content) return null;

  const segmentContent = matches[0].content;
  const contentIndex = content.indexOf(segmentContent);
  if (contentIndex < 0 || content.indexOf(segmentContent, contentIndex + 1) >= 0) return null;

  const segmentChunks = splitTextIntoChunks(segmentContent);
  const chunkMatches = chunks.flatMap((_, index) => {
    const matches = segmentChunks.every((chunk, offset) => chunks[index + offset] === chunk);
    return matches ? [index] : [];
  });
  return segmentChunks.length > 0 && chunkMatches.length === 1
    ? { chunkIndex: chunkMatches[0], content: segmentContent }
    : null;
}

export interface UseMarkdownLocatorHighlightOptions {
  content: string;
  chunks: string[];
  segments?: SourceSegment[];
  selectedLocator?: SourceSegmentLocator | null;
  scrollElement?: HTMLDivElement | null;
  containerRef: RefObject<HTMLDivElement | null>;
  isVirtualized: boolean;
}

export function useMarkdownLocatorHighlight({
  content,
  chunks,
  segments,
  selectedLocator,
  scrollElement,
  containerRef,
  isVirtualized,
}: UseMarkdownLocatorHighlightOptions) {
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

  const segmentTarget = useMemo(() => {
    if (
      !selectedLocator ||
      selectedLocator.symbol ||
      (typeof selectedLocator.pageNumber === "number" && selectedLocator.pageNumber > 0)
    ) {
      return null;
    }
    return findSegmentTarget(selectedLocator, segments, content, chunks);
  }, [selectedLocator, segments, content, chunks]);

  const targetChunkIndex = useMemo(() => {
    if (!selectedLocator || chunks.length === 0) return null;

    if (selectedLocator.symbol) {
      const slug = createSlug(selectedLocator.symbol);
      const symLower = selectedLocator.symbol.toLowerCase().trim();
      const foundIdx = chunks.findIndex((c) => {
        const cSlug = createSlug(c);
        return cSlug.includes(slug) || c.toLowerCase().includes(symLower);
      });
      if (foundIdx !== -1) return foundIdx;
    }

    if (typeof selectedLocator.pageNumber === "number" && selectedLocator.pageNumber > 0) {
      return Math.min(selectedLocator.pageNumber - 1, chunks.length - 1);
    }

    return selectedLocator.symbol ? null : segmentTarget?.chunkIndex ?? null;
  }, [selectedLocator, chunks, segmentTarget]);

  const [prevTargetChunkIndex, setPrevTargetChunkIndex] = useState<
    typeof targetChunkIndex | undefined
  >(undefined);
  if (prevTargetChunkIndex !== targetChunkIndex) {
    setPrevTargetChunkIndex(targetChunkIndex);
    if (targetChunkIndex !== null) setHighlightedIndex(targetChunkIndex);
  }

  useEffect(() => {
    if (targetChunkIndex === null) return;

    if (!isVirtualized) {
      const root = scrollElement || containerRef.current;
      if (root) {
        let targetElement: HTMLElement | null = null;
        if (selectedLocator?.symbol) {
          const slug = createSlug(selectedLocator.symbol);
          targetElement =
            root.querySelector(`#heading-${slug}`) || root.querySelector(`[id*="${slug}"]`);
        }
        if (
          !targetElement &&
          !selectedLocator?.symbol &&
          !(typeof selectedLocator?.pageNumber === "number" && selectedLocator.pageNumber > 0)
        ) {
          const matchingElements = Array.from(
            root.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, td, pre"),
          ).filter((element) => element.textContent === segmentTarget?.content);
          if (matchingElements.length === 1) {
            targetElement = matchingElements[0] as HTMLElement;
          }
        }
        if (!targetElement && selectedLocator?.pageNumber) {
          const paragraphs = root.querySelectorAll("p, h1, h2, h3, h4, blockquote");
          const targetIdx = Math.min(selectedLocator.pageNumber - 1, paragraphs.length - 1);
          if (targetIdx >= 0 && paragraphs[targetIdx]) {
            targetElement = paragraphs[targetIdx] as HTMLElement;
          }
        }
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
          targetElement.classList.add(
            "bg-primary/15",
            "ring-2",
            "ring-primary/30",
            "rounded-md",
            "p-1",
            "transition-all",
            "duration-500",
          );
          const timer = setTimeout(() => {
            targetElement?.classList.remove(
              "bg-primary/15",
              "ring-2",
              "ring-primary/30",
              "rounded-md",
              "p-1",
            );
          }, 3000);
          return () => clearTimeout(timer);
        }
      }
    }

    const timer = setTimeout(() => {
      setHighlightedIndex(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [targetChunkIndex, isVirtualized, selectedLocator, scrollElement, segmentTarget, containerRef]);

  return { targetChunkIndex, highlightedIndex };
}
