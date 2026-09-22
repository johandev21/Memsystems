/**
 * The structured record of one retrieval call. Chat turns that query text and
 * Study Material Generations that select sources persist it, so a poor answer
 * can be diagnosed as an ingestion, retrieval, or generation failure. A turn
 * or generation that performs no retrieval has no trace.
 *
 * A trace never carries provider keys, the query embedding, or chunk text:
 * it stores the query, the ranking evidence (ids, scores, ranks), the
 * thresholds that were applied, and the latency and token cost.
 */

/** Who a trace belongs to. */
export type RetrievalTraceKind = 'chat' | 'generation';

/** Why retrieval produced no Evidence. */
export type RetrievalAbstentionReason = 'no_indexed_chunks' | 'below_threshold';

/** Why the fused order was not reranked. */
export type RetrievalRerankSkippedReason =
  | 'disabled'
  | 'unavailable'
  | 'failed'
  | 'no_candidates'
  | 'too_many_candidates';

export interface RetrievalTraceCandidate {
  chunkId: string;
  sourceId: string;
  chunkIndex: number;
  /** The retrieval (fused) score, never the reranker score. */
  score: number;
  /** 1-based position within the list that contains it. */
  rank: number;
}

/** A candidate scored by the cross-encoder, in reranked order. */
export interface RetrievalTraceRerankedCandidate extends RetrievalTraceCandidate {
  /** Cross-encoder relevance score from the reranker. */
  rerankScore: number;
}

/**
 * The reranking stage: what model was asked, whether it produced an order,
 * and the cross-encoder scores when it did. `candidates` is empty when
 * `applied` is false, and the fused order stands as the Evidence order.
 */
export interface RetrievalTraceRerank {
  model: string;
  applied: boolean;
  skippedReason: RetrievalRerankSkippedReason | null;
  /**
   * The threshold applied to `rerankScore` when reranking is applied. When
   * it is not, `relevanceFloor` is the threshold that was applied instead.
   */
  threshold: number;
  /** Reranked candidates in cross-encoder order; empty when not applied. */
  candidates: RetrievalTraceRerankedCandidate[];
  /** Provider-reported tokens spent reranking; 0 when not applied. */
  inputTokens: number;
}

/**
 * The ranked output of one retrieval leg. Today there is a single dense leg;
 * the hybrid ticket adds a lexical leg behind the same pipeline.
 */
export interface RetrievalTraceLeg {
  kind: 'dense' | 'lexical';
  candidates: RetrievalTraceCandidate[];
}

/** What the call was allowed to search. */
export interface RetrievalTraceScope {
  kind: 'notebook' | 'selected_sources';
  /** The selected source ids when the scope is `selected_sources`. */
  sourceIds: string[] | null;
}

export interface RetrievalTrace {
  /** A stable shape version for traces persisted across schema changes. */
  version: 2;
  query: string;
  topK: number;
  scope: RetrievalTraceScope;
  /**
   * The retrieval-score floor applied to select final Evidence when
   * reranking is unavailable.
   */
  relevanceFloor: number;
  embedding: {
    model: string;
    dimensions: number;
  };
  legs: RetrievalTraceLeg[];
  /**
   * The deduplicated fusion order that feeds reranking. When reranking is not
   * applied, this order is also the order the threshold selects Evidence from.
   */
  fusedOrder: RetrievalTraceCandidate[];
  rerank: RetrievalTraceRerank;
  /** Candidates that cleared the threshold, in final Evidence order. */
  chosen: RetrievalTraceCandidate[];
  abstained: boolean;
  abstentionReason: RetrievalAbstentionReason | null;
  /** Wall-clock duration of the retrieval call, in milliseconds. */
  latencyMs: number;
  cost: {
    /** Estimated tokens sent to the embedding provider for the query. */
    embeddingInputTokens: number;
    /** Tokens reported by the reranker; 0 when reranking did not run. */
    rerankInputTokens: number;
  };
}
