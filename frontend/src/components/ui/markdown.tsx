import {
  type ComponentProps,
  type ReactNode,
  memo,
  useMemo,
} from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import {
  MarkdownBlockContext,
  repairTrailingBlock,
  splitMarkdownIntoBlocks,
} from "./markdown-blocks";

export type { MarkdownBlockContextValue } from "./markdown-blocks";

export type MarkdownComponents = Components;

const markdownSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), ["className", "math-inline", "math-display"]],
  },
};

type RemarkPlugins = NonNullable<ComponentProps<typeof ReactMarkdown>["remarkPlugins"]>;
type RehypePlugins = NonNullable<ComponentProps<typeof ReactMarkdown>["rehypePlugins"]>;

const defaultRemarkPlugins: RemarkPlugins = [remarkGfm, remarkMath];
const defaultRehypePlugins: RehypePlugins = [[rehypeSanitize, markdownSanitizeSchema], rehypeKatex];

function shallowEqual<T extends Record<string, unknown> | undefined>(a: T, b: T): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

export interface MemoizedMarkdownBlockProps {
  content: string;
  index: number;
  isTrailing: boolean;
  isStreaming: boolean;
  components?: MarkdownComponents;
  remarkPlugins: RemarkPlugins;
  rehypePlugins: RehypePlugins;
}

export const MemoizedMarkdownBlock = memo(
  ({
    content,
    isTrailing,
    isStreaming,
    components,
    remarkPlugins,
    rehypePlugins,
  }: MemoizedMarkdownBlockProps) => {
    const { processed, isFenceUnclosed } = useMemo(() => {
      if (isTrailing && isStreaming) {
        return repairTrailingBlock(content);
      }
      return { processed: content, isFenceUnclosed: false };
    }, [content, isTrailing, isStreaming]);

    const contextValue = useMemo(
      () => ({ isFenceUnclosed, isStreaming: isTrailing ? isStreaming : false }),
      [isFenceUnclosed, isTrailing, isStreaming],
    );

    return (
      <MarkdownBlockContext.Provider value={contextValue}>
        <ReactMarkdown
          components={components}
          remarkPlugins={remarkPlugins}
          rehypePlugins={rehypePlugins}
        >
          {processed}
        </ReactMarkdown>
      </MarkdownBlockContext.Provider>
    );
  },
  (prevProps, nextProps) => {
    if (prevProps.content !== nextProps.content) return false;
    if (prevProps.isTrailing !== nextProps.isTrailing) return false;
    if (
      (prevProps.isTrailing || nextProps.isTrailing) &&
      prevProps.isStreaming !== nextProps.isStreaming
    ) {
      return false;
    }
    return shallowEqual(
      prevProps.components as Record<string, unknown>,
      nextProps.components as Record<string, unknown>,
    );
  },
);

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock";

export type MarkdownRendererProps = Omit<
  ComponentProps<typeof ReactMarkdown>,
  "className" | "components"
> & {
  className?: string;
  components?: MarkdownComponents;
  isStreaming?: boolean;
  trailingContent?: ReactNode;
};

export function MarkdownRenderer({
  className,
  components,
  isStreaming = false,
  children,
  remarkPlugins,
  rehypePlugins,
  trailingContent,
  ...props
}: MarkdownRendererProps) {
  const effectiveRemarkPlugins = useMemo(
    () =>
      remarkPlugins?.length ? [...defaultRemarkPlugins, ...remarkPlugins] : defaultRemarkPlugins,
    [remarkPlugins],
  );

  const effectiveRehypePlugins = useMemo(
    () =>
      rehypePlugins?.length ? [...defaultRehypePlugins, ...rehypePlugins] : defaultRehypePlugins,
    [rehypePlugins],
  );

  const textContent =
    typeof children === "string" ? children : children != null ? String(children) : "";

  const blocks = useMemo(() => {
    if (!textContent) return [];
    return splitMarkdownIntoBlocks(textContent);
  }, [textContent]);

  if (!textContent && !trailingContent) {
    return null;
  }

  return (
    <div className={className} {...props}>
      {blocks.map((block, index) => (
        <MemoizedMarkdownBlock
          key={index}
          content={block}
          index={index}
          isTrailing={index === blocks.length - 1}
          isStreaming={isStreaming}
          components={components}
          remarkPlugins={effectiveRemarkPlugins}
          rehypePlugins={effectiveRehypePlugins}
        />
      ))}
      {trailingContent}
    </div>
  );
}
