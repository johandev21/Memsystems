/**
 * Deterministic rewrite model for the retrieval evaluation harness.
 *
 * It is a corpus-vocabulary stand-in, not a language model: to exercise the
 * rewrite seam keylessly it maps colloquial terms to the golden corpus's own
 * words (for example "respiration" to "mitochondria triphosphate", because
 * the corpus spells ATP out) and borrows the most distinctive terms of the
 * chunk that best matches the query. The gate it feeds therefore proves the
 * rewrite seam and the paraphrase-fusion path, not model quality.
 *
 * The chains that matter for the gate: the study guide's degraded chunks
 * supply the words "chapter" and "summary" to the corpus's IDF, so a message
 * that wraps its subject in those words dilutes its own embedding; a
 * follow-up that only points at the previous turn has no subject words at
 * all; and a short question whose one corpus term lives in a glossary stub
 * needs the material's vocabulary. Those queries miss without a rewrite and
 * hit with one.
 */

import { estimateVoyageTokens } from '../../src/modules/ai/providers/voyage.client';
import {
  buildHeuristicRewrite,
  type QueryRewriteRequest,
  type QueryRewriteResult,
  type QueryRewriter,
} from '../../src/modules/ai/query-understanding';
import { buildIdfWeights, tokenizeForEval } from './deterministic-embedder';

/**
 * Colloquial terms mapped to the vocabulary of the golden corpus. A real
 * rewrite model knows these equivalences; the double needs a table for them.
 */
const COLLOQUIAL_ALIASES: Record<string, string[]> = {
  powerhouse: ['mitochondria'],
  // The corpus spells ATP out; the alias table maps the abbreviation (and the
  // everyday word) to the material's own vocabulary.
  respiration: ['mitochondria', 'triphosphate'],
  atp: ['triphosphate'],
};

/** How many distinctive terms a paraphrase may borrow from one chunk. */
const PARAPHRASE_TERMS = 3;

export class DeterministicRewriter implements QueryRewriter {
  private readonly idf: Map<string, number>;

  constructor(private readonly corpus: string[]) {
    this.idf = buildIdfWeights(corpus);
  }

  async rewrite(request: QueryRewriteRequest): Promise<QueryRewriteResult> {
    const base = buildHeuristicRewrite(request.message, request.history);
    const query = this.expandAliases(base);
    // Built once and reused: multi-query asks for it, a hypothetical answer
    // borrows it when requested.
    const paraphrase = this.paraphrase(query);
    const variants = request.variantCount > 0 && paraphrase ? [paraphrase] : [];

    const input = [
      request.message,
      ...request.history.map((turn) => turn.content),
    ].join(' ');
    const output = [query, ...variants].join(' ');

    return {
      query,
      variants,
      hypotheticalAnswer: request.hypotheticalAnswer
        ? (paraphrase ?? query)
        : null,
      inputTokens: estimateVoyageTokens(input),
      outputTokens: estimateVoyageTokens(output),
    };
  }

  /** Appends the corpus vocabulary a colloquial term stands for. */
  private expandAliases(query: string): string {
    const additions = new Set<string>();
    for (const term of tokenizeForEval(query)) {
      for (const alias of COLLOQUIAL_ALIASES[term] ?? []) additions.add(alias);
    }
    if (additions.size === 0) return query;
    return `${query} ${[...additions].join(' ')}`;
  }

  /**
   * A paraphrase that names the query's subject in the material's own words:
   * the most distinctive terms of the chunk that best matches the query and
   * that the query itself does not mention.
   */
  private paraphrase(query: string): string | null {
    const queryTerms = new Set(tokenizeForEval(query));
    let best: { terms: string[]; covered: number } | null = null;

    for (const document of this.corpus) {
      const novel = new Map<string, number>();
      let covered = 0;
      for (const term of new Set(tokenizeForEval(document))) {
        const weight = this.idf.get(term) ?? 0;
        if (queryTerms.has(term)) covered += weight;
        else if (weight > 0) novel.set(term, weight);
      }
      if (covered === 0 || novel.size === 0) continue;
      if (!best || covered > best.covered) {
        best = {
          terms: [...novel.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, PARAPHRASE_TERMS)
            .map(([term]) => term),
          covered,
        };
      }
    }

    return best ? `${query} ${best.terms.join(' ')}` : null;
  }
}
