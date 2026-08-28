import type { BundledLanguage, BundledTheme, HighlighterGeneric, ThemedToken } from "shiki";
import { createHighlighter } from "shiki";

export interface TokenizedCode {
  tokens: ThemedToken[][];
  fg: string;
  bg: string;
}

interface KeyedToken {
  token: ThemedToken;
  key: string;
}

export interface KeyedLine {
  tokens: KeyedToken[];
  key: string;
}

export const addKeysToTokens = (lines: ThemedToken[][]): KeyedLine[] =>
  lines.map((line, lineIdx) => ({
    key: `line-${lineIdx}`,
    tokens: line.map((token, tokenIdx) => ({
      key: `line-${lineIdx}-${tokenIdx}`,
      token,
    })),
  }));

let highlighterPromise: Promise<HighlighterGeneric<BundledLanguage, BundledTheme>> | null = null;
const tokensCache = new Map<string, TokenizedCode>();
const subscribers = new Map<string, Set<(result: TokenizedCode) => void>>();

const getTokensCacheKey = (code: string, language: BundledLanguage) => {
  const start = code.slice(0, 100);
  const end = code.length > 100 ? code.slice(-100) : "";
  return `${language}:${code.length}:${start}:${end}`;
};

const getHighlighter = (): Promise<HighlighterGeneric<BundledLanguage, BundledTheme>> => {
  if (highlighterPromise) return highlighterPromise;
  highlighterPromise = createHighlighter({
    langs: ["text"],
    themes: ["github-light", "github-dark"],
  });
  return highlighterPromise;
};

export const createRawTokens = (code: string): TokenizedCode => ({
  bg: "transparent",
  fg: "inherit",
  tokens: code
    .split("\n")
    .map((line) => (line === "" ? [] : [{ color: "inherit", content: line } as ThemedToken])),
});

export const highlightCode = (
  code: string,
  language: BundledLanguage,
  callback?: (result: TokenizedCode) => void,
): TokenizedCode | null => {
  const cacheKey = getTokensCacheKey(code, language);
  const cached = tokensCache.get(cacheKey);
  if (cached) return cached;

  if (callback) {
    if (!subscribers.has(cacheKey)) subscribers.set(cacheKey, new Set());
    subscribers.get(cacheKey)?.add(callback);
  }

  getHighlighter()
    .then(async (highlighter) => {
      let langToUse: BundledLanguage | "text" = "text";
      try {
        await highlighter.loadLanguage(language);
        langToUse = language;
      } catch {
        // Unknown language identifiers intentionally fall back to plain text.
      }

      const result = highlighter.codeToTokens(code, {
        lang: langToUse,
        themes: { dark: "github-dark", light: "github-light" },
      });
      const tokenized = {
        bg: result.bg ?? "transparent",
        fg: result.fg ?? "inherit",
        tokens: result.tokens,
      } satisfies TokenizedCode;
      tokensCache.set(cacheKey, tokenized);
      const pending = subscribers.get(cacheKey);
      if (pending) {
        pending.forEach((subscriber) => subscriber(tokenized));
        subscribers.delete(cacheKey);
      }
    })
    .catch((error) => {
      console.error("Failed to highlight code:", error);
      subscribers.delete(cacheKey);
    });

  return null;
};
