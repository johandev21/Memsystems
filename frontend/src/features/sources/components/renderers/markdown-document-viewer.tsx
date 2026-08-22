import { type ReactNode, useMemo } from "react";
import { cn } from "@/shared/lib/utils";
import { MarkdownRenderer } from "@/shared/ui/markdown";
import { MarkdownCodeBlock } from "@/features/ai";
import { splitTextIntoChunks } from "./document-type-detector";
import { VirtualizedDocumentContainer } from "./virtualized-document-container";

interface MarkdownDocumentViewerProps {
  content: string;
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
      className={cn(
        "font-bold text-foreground tracking-tight scroll-mt-6 pt-4 my-3 wrap-break-words",
        level === 1 && "text-lg sm:text-2xl pt-4 sm:pt-6 my-3 sm:my-4",
        level === 2 && "text-base sm:text-xl pt-4 sm:pt-5 my-3 sm:my-3.5",
        level === 3 && "text-[15px] sm:text-lg pt-3 sm:pt-4 my-2.5 sm:my-3",
        level >= 4 && "text-sm sm:text-base font-semibold pt-3 my-2",
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
    <p className="text-foreground/90 leading-relaxed font-sans my-2.5 wrap-break-words">
      {children}
    </p>
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
  table: ({ children }: { children?: ReactNode }) => (
    <div className="my-4 overflow-x-auto overscroll-x-contain -mx-3 sm:mx-0 px-3 sm:px-0">
      <table className="w-full text-left text-sm border-collapse min-w-[480px] sm:min-w-0">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: { children?: ReactNode }) => (
    <thead className="border-b border-border/40 bg-muted/20 font-semibold text-foreground">
      {children}
    </thead>
  ),
  th: ({ children }: { children?: ReactNode }) => (
    <th className="px-4 py-2 text-xs font-semibold text-foreground/90 border-b border-border/30">
      {children}
    </th>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="px-4 py-2 text-xs text-foreground/80 border-b border-border/20">{children}</td>
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

export function MarkdownDocumentViewer({ content, scrollElement }: MarkdownDocumentViewerProps) {
  const chunks = useMemo(() => splitTextIntoChunks(content || ""), [content]);

  if (!content?.trim()) {
    return (
      <div className="py-12 text-center text-xs text-muted-foreground">
        Empty markdown document.
      </div>
    );
  }

  if (chunks.length > 20 && scrollElement !== undefined) {
    return (
      <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed font-sans">
        <VirtualizedDocumentContainer
          items={chunks}
          scrollElement={scrollElement}
          estimateSize={() => 80}
          overscan={5}
          getItemKey={(_, idx) => idx}
          renderItem={(chunk) => (
            <MarkdownRenderer components={markdownComponents}>{chunk}</MarkdownRenderer>
          )}
        />
      </div>
    );
  }

  return (
    <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed font-sans">
      <MarkdownRenderer components={markdownComponents}>{content}</MarkdownRenderer>
    </div>
  );
}
