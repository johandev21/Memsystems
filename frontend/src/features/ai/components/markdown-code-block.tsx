import type { ReactNode } from "react";
import type { BundledLanguage } from "shiki";
import { cn } from "@/shared/utils/cn";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockHeader,
  CodeBlockTitle,
} from "./code-block";

export interface MarkdownCodeBlockProps {
  className?: string;
  containerClassName?: string;
  children?: ReactNode;
  showLineNumbers?: boolean;
}

export function MarkdownCodeBlock({
  className,
  containerClassName,
  children,
  showLineNumbers = false,
}: MarkdownCodeBlockProps) {
  const match = /language-([\w-]+)/.exec(className || "");
  const language = (match ? match[1] : "text") as BundledLanguage;
  const rawCode = getRawText(children).replace(/\n$/, "");

  if (!className && !rawCode.includes("\n")) {
    return <MarkdownInlineCode>{rawCode}</MarkdownInlineCode>;
  }

  return (
    <MarkdownBlockCode
      code={rawCode}
      language={language}
      containerClassName={containerClassName}
      showLineNumbers={showLineNumbers}
    />
  );
}

function MarkdownInlineCode({ children }: { children: string }) {
  return (
    <code className="rounded border border-border/40 bg-muted px-1.5 py-0.5 font-mono text-sm font-medium text-foreground">
      {children}
    </code>
  );
}

function MarkdownBlockCode({
  code,
  language,
  containerClassName,
  showLineNumbers,
}: {
  code: string;
  language: BundledLanguage;
  containerClassName?: string;
  showLineNumbers: boolean;
}) {
  return (
    <CodeBlock
      className={cn("my-4", containerClassName)}
      code={code}
      language={language}
      showLineNumbers={showLineNumbers}
    >
      <CodeBlockHeader>
        <CodeBlockTitle>
          <CodeBlockFilename>{language}</CodeBlockFilename>
        </CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton />
        </CodeBlockActions>
      </CodeBlockHeader>
    </CodeBlock>
  );
}

function getRawText(node: ReactNode): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getRawText).join("");
  if (typeof node === "object" && node && "props" in node)
    return getRawText((node.props as { children?: ReactNode }).children);
  return "";
}
