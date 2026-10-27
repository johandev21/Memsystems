import { createContext, useContext } from "react";
import { lexer } from "marked";
import remend from "remend";

export interface MarkdownBlockContextValue {
  isFenceUnclosed?: boolean;
  isStreaming?: boolean;
}

export const MarkdownBlockContext = createContext<MarkdownBlockContextValue>({
  isFenceUnclosed: false,
  isStreaming: false,
});

export const useMarkdownBlockContext = () => useContext(MarkdownBlockContext);

const MAX_BLOCK_CHARS = 25_000;

export function isUnclosedFence(raw: string): boolean {
  const trimmed = raw.trimStart();
  const match = /^(```+|~~~+)/.exec(trimmed);
  if (!match) return false;
  const fence = match[1];
  const fenceChar = fence[0];
  const fenceLen = fence.length;
  const rest = trimmed.slice(fence.length);
  const firstNewline = rest.indexOf("\n");
  if (firstNewline === -1) return true;
  const codeContent = rest.slice(firstNewline + 1);
  const closingRegex = new RegExp(`(^|\\n)${fenceChar}{${fenceLen},}\\s*$`);
  return !closingRegex.test(codeContent);
}

export function repairTrailingBlock(raw: string): {
  processed: string;
  isFenceUnclosed: boolean;
} {
  const isFenceUnclosed = isUnclosedFence(raw);
  let processed = remend(raw, {
    linkMode: "protocol",
    inlineKatex: false,
    katex: false, // KaTeX only for complete math
  });

  if (isFenceUnclosed) {
    const trimmed = raw.trimStart();
    const match = /^(```+|~~~+)/.exec(trimmed);
    const fence = match ? match[1] : "```";
    processed = `${processed}\n${fence}`;
  }

  return { processed, isFenceUnclosed };
}

export function splitMarkdownIntoBlocks(markdown: string): string[] {
  if (!markdown) return [];
  try {
    const tokens = lexer(markdown);
    const blocks: string[] = [];
    for (const token of tokens) {
      if (token.type === "space") continue;
      if (token.raw) {
        if (token.raw.length > MAX_BLOCK_CHARS) {
          blocks.push(token.raw.slice(0, MAX_BLOCK_CHARS));
        } else {
          blocks.push(token.raw);
        }
      }
    }
    return blocks;
  } catch {
    return [markdown];
  }
}
