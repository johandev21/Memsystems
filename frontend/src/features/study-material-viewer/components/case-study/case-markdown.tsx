import { MarkdownRenderer } from "@/components/ui/markdown";

export function CaseMarkdown({ text }: { text: string }) {
  return (
    <MarkdownRenderer className="typeset typeset-chat break-words [&_pre]:overflow-x-auto [&_table]:block [&_table]:overflow-x-auto">
      {text}
    </MarkdownRenderer>
  );
}
