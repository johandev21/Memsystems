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
 * Helper to split cloze text into pre-blank, post-blank segments and the expected answer.
 */
export function parseClozeCard(front: string, back: string) {
  const blankRegex = /_{2,}|\[\s*blank\s*\]|\[\s*\.\.\.\s*\]|___+/i;
  const match = front.match(blankRegex);

  if (match && match.index !== undefined) {
    const prefix = front.slice(0, match.index);
    const suffix = front.slice(match.index + match[0].length);
    return {
      isCloze: true,
      prefix,
      suffix,
      expected: back.trim(),
    };
  }

  return {
    isCloze: false,
    prefix: front,
    suffix: "",
    expected: back.trim(),
  };
}
