/**
 * Deterministic lexical embedder for the retrieval evaluation harness.
 *
 * The continuous integration gate has no Voyage API key, so the golden-set
 * evaluation cannot call the real embedding provider. This embedder maps a
 * text to a 1024-dimension vector by hashing TF-IDF weighted tokens, which
 * preserves the property the retrieval metrics depend on: a query is close to
 * chunks that share its distinctive vocabulary. It is intentionally simple
 * and deterministic, not a replacement for the provider.
 */

export const EVAL_EMBEDDING_DIMENSIONS = 1024;

const STOP_WORDS = new Set([
  'a',
  'about',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'been',
  'being',
  'but',
  'by',
  'can',
  'did',
  'do',
  'does',
  'explain',
  'for',
  'from',
  'give',
  'he',
  'her',
  'here',
  'his',
  'how',
  'i',
  'if',
  'in',
  'into',
  'is',
  'it',
  'its',
  'me',
  'my',
  'no',
  'not',
  'now',
  'of',
  'on',
  'only',
  'or',
  'our',
  'over',
  'own',
  'same',
  'she',
  'should',
  'so',
  'such',
  'tell',
  'than',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'to',
  'too',
  'under',
  'use',
  'using',
  'very',
  'was',
  'we',
  'were',
  'what',
  'when',
  'where',
  'which',
  'who',
  'whom',
  'why',
  'will',
  'with',
  'you',
  'your',
]);

/** The single method the pipeline's embedding service exposes to retrieval. */
export interface EvalEmbedder {
  embed(text: string): number[];
}

export function tokenizeForEval(text: string): string[] {
  const matches = text.toLowerCase().match(/[a-z0-9]+/g);
  if (!matches) return [];
  return matches.filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

/**
 * Inverse document frequency per token, shared by the deterministic embedder
 * and the deterministic reranker so both weight the same terms the same way.
 */
export function buildIdfWeights(corpus: string[]): Map<string, number> {
  const documentFrequency = new Map<string, number>();
  for (const document of corpus) {
    for (const token of new Set(tokenizeForEval(document))) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  for (const [token, frequency] of documentFrequency) {
    idf.set(token, Math.log((corpus.length + 1) / (frequency + 1)) + 1);
  }
  return idf;
}

export class DeterministicEmbedder implements EvalEmbedder {
  private readonly idf: Map<string, number>;

  constructor(
    corpus: string[],
    private readonly dimensions = EVAL_EMBEDDING_DIMENSIONS,
  ) {
    this.idf = buildIdfWeights(corpus);
  }

  embed(text: string): number[] {
    const vector = new Array<number>(this.dimensions).fill(0);
    for (const token of tokenizeForEval(text)) {
      const idf = this.idf.get(token);
      // Tokens absent from the corpus cannot match any chunk; ignoring them
      // keeps an unknown word from diluting the query's shared signal.
      if (idf === undefined) continue;
      const index = fnv1a(token) % this.dimensions;
      vector[index] += idf;
    }

    const norm = Math.sqrt(
      vector.reduce((sum, value) => sum + value * value, 0),
    );
    if (norm === 0) return vector;
    return vector.map((value) => value / norm);
  }
}

/** FNV-1a: a small stable hash so vectors are identical across runs. */
function fnv1a(token: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < token.length; index++) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}
