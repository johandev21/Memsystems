import { type ReactNode, memo, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/cn";
import { MarkdownRenderer, type MarkdownComponents } from "@/components/ui/markdown";
import { MarkdownTable } from "@/features/ai/components/markdown-table";
import type { SourceSegment, SourceSegmentLocator } from "../../types";
import { splitTextIntoChunks } from "../../utils/detect-document-type";
import { VirtualizedDocumentContainer } from "./virtualized-document-container";

export interface MarkdownDocumentViewerProps {
  content: string;
  segments?: SourceSegment[];
  selectedLocator?: SourceSegmentLocator | null;
  scrollElement?: HTMLDivElement | null;
}

function getRawText(node: ReactNode): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getRawText).join("");
  if (typeof node === "object" && node && "props" in node) {
    const props = node.props as { children?: ReactNode };
    return getRawText(props.children);
  }
  return "";
}

function createSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const HeadingWithId = ({
  level,
  children,
}: {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children?: ReactNode;
}) => {
  const titleText = getRawText(children);
  const cleanTitle = titleText.replace(/[*_`]/g, "").trim();
  const id = `heading-${createSlug(cleanTitle)}`;

  const HeadingTag = `h${level}` as keyof React.JSX.IntrinsicElements;

  return (
    <HeadingTag
      id={id}
      data-heading-level={level}
      className={cn(
        "font-bold text-foreground tracking-tight scroll-mt-6 wrap-break-word",
        level === 1 && "text-xl sm:text-2xl pt-6 pb-2 my-3 border-b border-border/30",
        level === 2 && "text-lg sm:text-xl pt-5 pb-1.5 my-3 border-b border-border/20",
        level === 3 && "text-base sm:text-lg pt-4 my-2.5",
        level === 4 && "text-sm sm:text-base font-semibold pt-3 my-2",
        level >= 5 && "text-sm font-semibold pt-2 my-1.5 text-foreground/80",
      )}
    >
      {children}
    </HeadingTag>
  );
};

const markdownComponents: MarkdownComponents = {
  h1: ({ children }: { children?: ReactNode }) => (
    <HeadingWithId level={1}>{children}</HeadingWithId>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <HeadingWithId level={2}>{children}</HeadingWithId>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <HeadingWithId level={3}>{children}</HeadingWithId>
  ),
  h4: ({ children }: { children?: ReactNode }) => (
    <HeadingWithId level={4}>{children}</HeadingWithId>
  ),
  h5: ({ children }: { children?: ReactNode }) => (
    <HeadingWithId level={5}>{children}</HeadingWithId>
  ),
  h6: ({ children }: { children?: ReactNode }) => (
    <HeadingWithId level={6}>{children}</HeadingWithId>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="my-3 wrap-break-word select-text">
      {children}
    </p>
  ),
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="border-l-2 border-border pl-4 my-4 text-foreground/85 italic">
      {children}
    </blockquote>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="list-disc pl-6 my-3 space-y-1.5 text-foreground/90">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="list-decimal pl-6 my-3 space-y-1.5 text-foreground/90">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="pl-1">{children}</li>
  ),
  hr: () => <hr className="my-6 border-t border-border/40" />,
  table: MarkdownTable,
  thead: ({ children, node }) => {
    const cells = node?.children
      .filter((row) => row.type === "element")
      .flatMap((row) => row.children.filter((cell) => cell.type === "element"));
    const isEmpty = cells?.every((cell) =>
      cell.children.every((child) => child.type === "text" && !child.value.trim()),
    );
    return isEmpty ? null : <thead>{children}</thead>;
  },
  code: ({ className, children }: { className?: string; children?: ReactNode }) => (
    <code
      className={cn(
        "font-mono",
        className,
        !className && "rounded bg-muted px-1 py-0.5 text-sm",
      )}
    >
      {children}
    </code>
  ),
  img: ({ alt }: { alt?: string | undefined }) => (
    <span className="text-muted-foreground">{alt || ""}</span>
  ),
};

export function MarkdownDocumentViewer({
  content,
  segments,
  selectedLocator,
  scrollElement,
}: MarkdownDocumentViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const chunks = useMemo(() => splitTextIntoChunks(content || ""), [content]);
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

  const isVirtualized = chunks.length > 25 && scrollElement !== undefined;

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
  }, [targetChunkIndex, isVirtualized, selectedLocator, scrollElement, segmentTarget]);

  if (!content?.trim()) {
    return <EmptyMarkdownState />;
  }

  if (isVirtualized) {
    return (
      <div ref={containerRef} className="w-full">
        <VirtualizedMarkdownDocument
          chunks={chunks}
          scrollElement={scrollElement}
          targetIndex={targetChunkIndex}
          highlightedIndex={highlightedIndex}
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      <StaticMarkdownDocument content={content} />
    </div>
  );
}

function EmptyMarkdownState() {
  const { t } = useTranslation("sourceRenderers");
  return (
    <div className="py-12 text-center text-xs text-muted-foreground">
      {t("markdownViewer.noContent")}
    </div>
  );
}

function estimateChunkSize(chunk: string): number {
  if (!chunk) return 40;
  const trimmed = chunk.trim();
  if (/^[-*_]{3,}$/.test(trimmed)) return 24;
  if (/^#{1,6}\s/.test(trimmed)) return 44;
  const lineCount = chunk.split("\n").length;
  if (trimmed.startsWith("```") || trimmed.startsWith("~~~") || trimmed.includes("|")) {
    return Math.max(60, lineCount * 22 + 30);
  }
  return Math.max(36, Math.min(600, lineCount * 20 + Math.ceil(trimmed.length / 80) * 16));
}

function VirtualizedMarkdownDocument({
  chunks,
  scrollElement,
  targetIndex,
  highlightedIndex,
}: {
  chunks: string[];
  scrollElement: HTMLDivElement | null;
  targetIndex?: number | null;
  highlightedIndex?: number | null;
}) {
  return (
    <MarkdownDocumentShell>
      <VirtualizedDocumentContainer
        items={chunks}
        scrollElement={scrollElement}
        estimateSize={(index) => estimateChunkSize(chunks[index] || "")}
        overscan={8}
        targetIndex={targetIndex}
        highlightedIndex={highlightedIndex}
        getItemKey={(_chunk, index) => `md-chunk-${index}`}
        renderItem={(chunk, index, isHighlighted) => (
          <MarkdownChunk key={`md-chunk-${index}`} chunk={chunk} isHighlighted={isHighlighted} />
        )}
      />
    </MarkdownDocumentShell>
  );
}

function StaticMarkdownDocument({ content }: { content: string }) {
  return (
    <MarkdownDocumentShell>
      <MarkdownRenderer components={markdownComponents}>{content}</MarkdownRenderer>
    </MarkdownDocumentShell>
  );
}

function findSegmentTarget(
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

const MarkdownChunk = memo(function MarkdownChunk({
  chunk,
  isHighlighted,
}: {
  chunk: string;
  isHighlighted?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md p-1 transition-all duration-300",
        isHighlighted && "bg-primary/15 ring-2 ring-primary/30",
      )}
    >
      <MarkdownRenderer components={markdownComponents}>{chunk}</MarkdownRenderer>
    </div>
  );
});

function MarkdownDocumentShell({ children }: { children: ReactNode }) {
  return (
    <div className="typeset typeset-chat typeset-compact max-w-none">
      {children}
    </div>
  );
}
