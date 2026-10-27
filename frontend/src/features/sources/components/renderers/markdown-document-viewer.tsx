import { type ReactNode, memo, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { MarkdownRenderer, type MarkdownComponents } from "@/shared/components/ui/markdown";
import { cn } from "@/shared/utils/cn";
import { MarkdownTable } from "@/features/ai";
import type { SourceSegment, SourceSegmentLocator } from "../../types/source.types";
import { splitTextIntoChunks } from "../../utils/detect-document-type";
import { VirtualizedDocumentContainer } from "./virtualized-document-container";
import {
  createSlug,
  useMarkdownLocatorHighlight,
} from "../../hooks/use-markdown-locator-highlight";

export interface MarkdownDocumentViewerProps {
  content: string;
  segments?: SourceSegment[];
  selectedLocator?: SourceSegmentLocator | null;
  scrollElement?: HTMLDivElement | null;
}

export function MarkdownDocumentViewer({
  content,
  segments,
  selectedLocator,
  scrollElement,
}: MarkdownDocumentViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chunks = useMemo(() => splitTextIntoChunks(content || ""), [content]);
  const isVirtualized = chunks.length > 25 && scrollElement !== undefined;

  const { targetChunkIndex, highlightedIndex } = useMarkdownLocatorHighlight({
    content,
    chunks,
    segments,
    selectedLocator,
    scrollElement,
    containerRef,
    isVirtualized,
  });

  if (!content?.trim()) {
    return <EmptyMarkdownState />;
  }

  if (isVirtualized) {
    return (
      <div ref={containerRef} className="w-full">
        <VirtualizedMarkdownDocument
          chunks={chunks}
          content={content}
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

function VirtualizedMarkdownDocument({
  chunks,
  content,
  scrollElement,
  targetIndex,
  highlightedIndex,
}: {
  chunks: string[];
  content: string;
  scrollElement: HTMLDivElement | null;
  targetIndex?: number | null;
  highlightedIndex?: number | null;
}) {
  const keyedChunks = useMemo(() => getKeyedChunks(chunks, content), [chunks, content]);

  return (
    <MarkdownDocumentShell>
      <VirtualizedDocumentContainer
        items={keyedChunks}
        scrollElement={scrollElement}
        estimateSize={(index) => estimateChunkSize(keyedChunks[index]?.content || "")}
        overscan={8}
        targetIndex={targetIndex}
        highlightedIndex={highlightedIndex}
        getItemKey={(chunk) => chunk.id}
        renderItem={(chunk, _index, isHighlighted) => (
          <MarkdownChunk chunk={chunk.content} isHighlighted={isHighlighted} />
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

function getKeyedChunks(chunks: string[], content: string) {
  const normalizedContent = content.replace(/\r\n?/g, "\n");
  const keyedChunks: { id: string; content: string }[] = [];
  let searchFrom = 0;

  for (const chunk of chunks) {
    const start = normalizedContent.indexOf(chunk, searchFrom);
    const offset = start < 0 ? searchFrom : start;
    keyedChunks.push({ id: `markdown-chunk-${offset}`, content: chunk });
    searchFrom = offset + chunk.length;
  }

  return keyedChunks;
}
