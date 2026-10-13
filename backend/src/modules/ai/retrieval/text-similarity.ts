export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

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

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
