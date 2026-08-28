import type { BundledLanguage } from "shiki";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockHeader,
  CodeBlockTitle,
} from "@/features/ai";
import { getLanguageFromTitle } from "./document-type-detector";

interface CodeDocumentViewerProps {
  title: string;
  content: string;
}

export function CodeDocumentViewer({ title, content }: CodeDocumentViewerProps) {
  const language = getLanguageFromTitle(title) as BundledLanguage;

  return (
    <div className="w-full my-2">
      <CodeBlock
        code={content || ""}
        language={language}
        showLineNumbers
        className="rounded-xl border border-border/60 bg-card shadow-sm"
      >
        <CodeBlockHeader className="bg-muted/40 px-4 py-2 border-b border-border/40">
          <CodeBlockTitle>
            <CodeBlockFilename className="font-mono text-xs font-medium text-foreground">
              {title} ({language})
            </CodeBlockFilename>
          </CodeBlockTitle>
          <CodeBlockActions>
            <CodeBlockCopyButton />
          </CodeBlockActions>
        </CodeBlockHeader>
      </CodeBlock>
    </div>
  );
}
