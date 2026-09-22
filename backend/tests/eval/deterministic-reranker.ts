/**
 * Deterministic reranker for the retrieval evaluation harness.
 *
 * The continuous integration gate has no Voyage API key, so the cross-encoder
 * is replaced by a lexical stand-in that is shaped like one: it scores each
 * query-document pair jointly into [0, 1]. The score is the share of the
 * query's IDF mass the document contains, reduced for fragments too short to
 * carry an answer.
 *
 * That is deliberately different from the dense leg, whose TF-IDF cosine
 * normalization lets a short chunk sharing one term outrank a longer passage
 * that actually answers the query. The golden corpus contains glossary
 * entries that create exactly that trap, so the gate can tell reranked from
 * unreranked retrieval. This is a test double, not a relevance model.
 */

import type {
  RerankRequest,
  RerankResponse,
  Reranker,
} from '../../src/modules/ai/reranker.service';
import { estimateVoyageTokens } from '../../src/modules/ai/providers/voyage.client';
import { buildIdfWeights, tokenizeForEval } from './deterministic-embedder';

/**
 * Content-word floor for a fragment to be treated as a substantive passage.
 * Glossary stubs, captions, and navigation labels fall below it, and the
 * double down-weights them: a passage of a handful of words rarely answers a
 * question, which is exactly what a trained cross-encoder captures.
 */
const SUBSTANTIVE_TOKEN_FLOOR = 12;

export class DeterministicReranker implements Reranker {
  private readonly idf: Map<string, number>;

  constructor(corpus: string[]) {
    this.idf = buildIdfWeights(corpus);
  }

  async rerank(request: RerankRequest): Promise<RerankResponse> {
    return {
      candidates: request.documents.map((document, index) => ({
        index,
        relevanceScore: this.score(request.query, document),
      })),
      inputTokens:
        estimateVoyageTokens(request.query) +
        request.documents.reduce(
          (sum, document) => sum + estimateVoyageTokens(document),
          0,
        ),
    };
  }

  private score(query: string, document: string): number {
    const documentTokens = new Set(tokenizeForEval(document));
    const coverage = this.coverage(query, documentTokens);
    const lengthFactor = Math.min(
      1,
      documentTokens.size / SUBSTANTIVE_TOKEN_FLOOR,
    );
    return coverage * lengthFactor;
  }

  private coverage(query: string, documentTokens: Set<string>): number {
    let total = 0;
    let hit = 0;
    for (const token of new Set(tokenizeForEval(query))) {
      const weight = this.idf.get(token);
      // Tokens absent from the corpus cannot match any chunk; ignoring them
      // keeps an unknown word from diluting the query's shared signal.
      if (weight === undefined) continue;
      total += weight;
      if (documentTokens.has(token)) hit += weight;
    }
    return total === 0 ? 0 : hit / total;
  }
}
