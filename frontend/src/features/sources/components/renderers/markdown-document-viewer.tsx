import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { cn } from "@/shared/utils/cn";
import { MarkdownRenderer } from "@/components/ui/markdown";
import { MarkdownCodeBlock } from "@/features/ai";
import type { SourceSegmentLocator } from "../../types";
import { splitTextIntoChunks } from "./document-type-detector";
import { VirtualizedDocumentContainer } from "./virtualized-document-container";

export interface MarkdownDocumentViewerProps {
  content: string;
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
        "font-bold text-foreground tracking-tight scroll-mt-6 wrap-break-words",
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

const markdownComponents = {
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
    <p className="text-foreground/90 leading-relaxed font-sans my-3 wrap-break-words text-sm sm:text-base select-text">
      {children}
    </p>
  ),
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="border-l-4 border-primary/60 bg-muted/30 px-4 py-2.5 my-4 rounded-r-lg text-foreground/85 italic">
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
    <li className="leading-relaxed font-sans pl-1">{children}</li>
  ),
  hr: () => <hr className="my-6 border-t border-border/40" />,
  table: ({ children }: { children?: ReactNode }) => (
    <div className="my-4 overflow-x-auto overscroll-x-contain rounded-lg border border-border/40 shadow-xs">
      <table className="w-full text-left text-sm border-collapse min-w-[500px]">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: { children?: ReactNode }) => (
    <thead className="border-b border-border/40 bg-muted/40 font-semibold text-foreground">
      {children}
    </thead>
  ),
  th: ({ children }: { children?: ReactNode }) => (
    <th className="px-4 py-2.5 text-xs font-semibold text-foreground border-b border-border/30">
      {children}
    </th>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="px-4 py-2 text-xs text-foreground/85 border-b border-border/20 last:border-b-0">
      {children}
    </td>
  ),
  code: ({ className, children }: { className?: string; children?: ReactNode }) => (
    <MarkdownCodeBlock
      className={cn("max-w-full overflow-x-auto", className)}
      containerClassName="rounded-xl border border-border/60 max-w-full overflow-x-auto"
      showLineNumbers
    >
      {children}
    </MarkdownCodeBlock>
  ),
};

export function MarkdownDocumentViewer({
  content,
  selectedLocator,
  scrollElement,
}: MarkdownDocumentViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chunks = useMemo(() => splitTextIntoChunks(content || ""), [content]);

  // Handle citation scrolling and highlighting
  useEffect(() => {
    if (!selectedLocator) return;

    const root = scrollElement || containerRef.current;
    if (!root) return;

    // 1. Try finding heading by symbol
    let targetElement: HTMLElement | null = null;
    if (selectedLocator.symbol) {
      const slug = createSlug(selectedLocator.symbol);
      targetElement =
        root.querySelector(`#heading-${slug}`) ||
        root.querySelector(`[id*="${slug}"]`);
    }

    // 2. If not found by symbol, search text paragraphs
    if (!targetElement && selectedLocator.pageNumber) {
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
  }, [selectedLocator, scrollElement]);

  if (!content?.trim()) {
    return <EmptyMarkdownState />;
  }

  if (chunks.length > 25 && scrollElement !== undefined) {
    return (
      <div ref={containerRef} className="w-full">
        <VirtualizedMarkdownDocument chunks={chunks} scrollElement={scrollElement} />
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
  return (
    <div className="py-12 text-center text-xs text-muted-foreground">
      No text content available.
    </div>
  );
}

function VirtualizedMarkdownDocument({
  chunks,
  scrollElement,
}: {
  chunks: string[];
  scrollElement: HTMLDivElement | null;
}) {
  return (
    <MarkdownDocumentShell>
      <VirtualizedDocumentContainer
        items={chunks}
        scrollElement={scrollElement}
        estimateSize={() => 80}
        overscan={5}
        getItemKey={(_, index) => index}
        renderItem={(chunk) => <MarkdownChunk chunk={chunk} />}
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

function MarkdownChunk({ chunk }: { chunk: string }) {
  return <MarkdownRenderer components={markdownComponents}>{chunk}</MarkdownRenderer>;
}

function MarkdownDocumentShell({ children }: { children: ReactNode }) {
  return (
    <div className="prose dark:prose-invert max-w-none text-sm sm:text-base leading-relaxed font-sans text-foreground">
      {children}
    </div>
  );
}
