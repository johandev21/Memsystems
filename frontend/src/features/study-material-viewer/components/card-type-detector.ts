export type CardFormat = "qa" | "definition" | "cloze";

export interface FlashcardItem {
  front: string;
  back: string;
  format?: CardFormat;
}

/**
 * Detects the flashcard format based on its text structure.
 */
export function detectCardFormat(card: { front: string; back: string }): CardFormat {
  const front = card.front.trim();

  // Check for Cloze / Fill-in-the-blank patterns: ___, [...], [blank], etc.
  if (/_{2,}|\[\s*blank\s*\]|\[\s*\.\.\.\s*\]|___+/i.test(front)) {
    return "cloze";
  }

  // Check for Definition format: short front without question mark
  const isQuestion =
    front.endsWith("?") ||
    /^(what|how|why|where|who|when|which|explain|compare|describe|is|are|can|do|does)\b/i.test(
      front,
    );
  const wordCount = front.split(/\s+/).length;

  if (!isQuestion && (wordCount <= 6 || front.length <= 45)) {
    return "definition";
  }

  return "qa";
}

/**
 * Shared blank pattern for cloze / fill-in-the-blank cards.
 * Matches `___` (2+ underscores), `[blank]`, and `[...]`.
 */
export const CLOZE_BLANK_PATTERN = /_{2,}|\[\s*blank\s*\]|\[\s*\.\.\.\s*\]|___+/i;
export const CLOZE_BLANK_GLOBAL_PATTERN = /_{2,}|\[\s*blank\s*\]|\[\s*\.\.\.\s*\]|___+/gi;

export interface ParsedClozeBlanks {
  isCloze: boolean;
  /** Text between blanks. Length is always blankCount + 1. */
  segments: string[];
  /** Expected answer per blank, aligned to blankCount (see heuristic below). */
  expectedAnswers: string[];
  blankCount: number;
}

/**
 * Back-parsing heuristic (frontend-only, no DB migration — backend still
 * stores `{ front with ___ , back }`).
 *
 * 1. If `back` contains `|` split on `|`.
 * 2. Else if it contains `;` split on `;`.
 * 3. Else if it contains a newline split on newlines.
 * 4. Else if there is more than one blank and it contains `,` split on `,`
 *    (this also covers `,,` as a delimiter — empty parts are filtered out).
 * 5. Otherwise the whole `back` is a single answer.
 *
 * Each part is trimmed and empty parts are dropped.
 *
 * Length-mismatch policy: the result is always padded/truncated to exactly
 * `blankCount` entries. Missing entries are padded with `""`, which the UI
 * treats as "accept any non-empty input" so extra blanks stay answerable.
 * Surplus entries are truncated.
 */
export function parseExpectedAnswers(back: string, blankCount: number): string[] {
  const trimmed = back.trim();
  if (blankCount <= 0) return [];
  if (!trimmed) return Array(blankCount).fill("");

  let parts: string[];
  if (trimmed.includes("|")) {
    parts = trimmed.split("|");
  } else if (trimmed.includes(";")) {
    parts = trimmed.split(";");
  } else if (/\r?\n/.test(trimmed)) {
    parts = trimmed.split(/\r?\n/);
  } else if (blankCount > 1 && trimmed.includes(",")) {
    parts = trimmed.split(",");
  } else {
    parts = [trimmed];
  }

  const cleaned = parts.map((part) => part.trim()).filter((part) => part.length > 0);
  if (cleaned.length === 0) return Array(blankCount).fill("");
  if (cleaned.length >= blankCount) return cleaned.slice(0, blankCount);
  return [...cleaned, ...Array(blankCount - cleaned.length).fill("")];
}

/**
 * Splits `front` on the global blank regex into N+1 segments and parses
 * `back` into N expected answers (see {@link parseExpectedAnswers}).
 */
export function parseClozeBlanks(front: string, back: string): ParsedClozeBlanks {
  const segments = front.split(new RegExp(CLOZE_BLANK_GLOBAL_PATTERN.source, "gi"));
  const blankCount = segments.length - 1;
  if (blankCount <= 0) {
    return { isCloze: false, segments: [front], expectedAnswers: [], blankCount: 0 };
  }
  return {
    isCloze: true,
    segments,
    expectedAnswers: parseExpectedAnswers(back, blankCount),
    blankCount,
  };
}

/**
 * Helper to split cloze text into pre-blank, post-blank segments and the expected answer.
 *
 * Extended for multi-blank cards: `segments` has length N+1 and
 * `expectedAnswers` has length N. Legacy `prefix`/`suffix`/`expected`
 * fields are kept for backward compatibility (first/last segment and first
 * answer).
 */
export function parseClozeCard(front: string, back: string) {
  const parsed = parseClozeBlanks(front, back);

  if (parsed.isCloze) {
    return {
      isCloze: true as const,
      prefix: parsed.segments[0] ?? "",
      suffix: parsed.segments[parsed.segments.length - 1] ?? "",
      expected: parsed.expectedAnswers[0] ?? back.trim(),
      segments: parsed.segments,
      expectedAnswers: parsed.expectedAnswers,
      blankCount: parsed.blankCount,
    };
  }

  return {
    isCloze: false as const,
    prefix: front,
    suffix: "",
    expected: back.trim(),
    segments: [front],
    expectedAnswers: [] as string[],
    blankCount: 0,
  };
}

/**
 * Fills every blank in `front` with its corresponding expected answer.
 * Used for read-only "full sentence" previews. Missing answers fall back
 * to the raw `back` string (single-blank legacy) or "" (accept-any blank).
 */
export function fillClozeBlanks(front: string, back: string): string {
  const parsed = parseClozeBlanks(front, back);
  if (!parsed.isCloze) return front;
  let index = 0;
  return front.replace(
    new RegExp(CLOZE_BLANK_GLOBAL_PATTERN.source, "gi"),
    () => parsed.expectedAnswers[index++] ?? back.trim(),
  );
}
