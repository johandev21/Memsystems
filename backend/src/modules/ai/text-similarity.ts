/**
 * Text-similarity helpers shared by the retrieval stages that remove
 * duplicates. Both the candidate-level near-duplicate check and the Evidence
 * assembly's overlap check measure the same thing — how much of one passage
 * another already contains — so they share one tokenizer and one containment
 * measure instead of drifting apart.
 *
 * Containment is order-sensitive: a passage whose words all appear in another
 * passage in a different arrangement is not an overlap. The comparison uses
 * token bigrams, falling back to unigrams for passages too short to have any.
 */

/** Unicode-aware word tokens, lowercased, in text order. */
export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** A passage's token set and its ordered token bigrams. */
export interface TextSignature {
  tokens: Set<string>;
  bigrams: Set<string>;
}

export function textSignature(text: string): TextSignature {
  const tokens = tokenize(text);
  const bigrams = new Set<string>();
  for (let index = 0; index + 1 < tokens.length; index++) {
    bigrams.add(`${tokens[index]} ${tokens[index + 1]}`);
  }
  return { tokens: new Set(tokens), bigrams };
}

/**
 * The share of the candidate's content that the earlier passage already
 * contains, in [0, 1]. Bigram containment keeps word order significant; a
 * candidate without bigrams (a single word) falls back to its token.
 */
export function containedShare(
  candidate: TextSignature,
  kept: TextSignature,
): number {
  if (candidate.bigrams.size > 0) {
    let shared = 0;
    for (const bigram of candidate.bigrams) {
      if (kept.bigrams.has(bigram)) shared++;
    }
    return shared / candidate.bigrams.size;
  }
  if (candidate.tokens.size === 0) return 0;
  let shared = 0;
  for (const token of candidate.tokens) {
    if (kept.tokens.has(token)) shared++;
  }
  return shared / candidate.tokens.size;
}

/** Token-set Jaccard similarity for near-duplicate detection. */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
