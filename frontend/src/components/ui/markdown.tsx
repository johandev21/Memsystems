import { type ComponentProps, type ReactNode, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

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

export type MarkdownRendererProps = Omit<
  ComponentProps<typeof ReactMarkdown>,
  "className" | "components"
> & {
  className?: string;
  components?: MarkdownComponents;
  isStreaming?: boolean;
  trailingContent?: ReactNode;
};

/**
 * The application Markdown boundary. Untrusted Markdown is sanitized before
 * trusted KaTeX rendering, and raw HTML remains disabled by react-markdown.
 */
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

  if (isStreaming) {
    return (
      <div className={className}>
        <div className="whitespace-pre-wrap wrap-break-word">{children}</div>
        {trailingContent}
      </div>
    );
  }

  const markdown = (
    <ReactMarkdown
      {...props}
      components={components}
      remarkPlugins={effectiveRemarkPlugins}
      rehypePlugins={effectiveRehypePlugins}
    >
      {children}
    </ReactMarkdown>
  );

  return className || trailingContent ? (
    <div className={className}>
      {markdown}
      {trailingContent}
    </div>
  ) : (
    markdown
  );
}
