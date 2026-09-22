/**
 * The structured record of one retrieval call. Traces are persisted for
 * every Chat turn and Study Material Generation so a poor answer can be
 * diagnosed as an ingestion, retrieval, or generation failure.
 *
 * A trace never carries provider keys, the query embedding, or chunk text:
 * it stores the query, the ranking evidence (ids, scores, ranks), the
 * threshold that was applied, and the latency and token cost.
 */

/** Why retrieval produced no Evidence. */
export type RetrievalAbstentionReason = 'no_indexed_chunks' | 'below_threshold';

export interface RetrievalTraceCandidate {
  chunkId: string;
  sourceId: string;
  chunkIndex: number;
  score: number;
  /** 1-based position within the list that contains it. */
  rank: number;
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
  version: 1;
  query: string;
  topK: number;
  scope: RetrievalTraceScope;
  /** The relevance floor applied to select final Evidence. */
  relevanceFloor: number;
  embedding: {
    model: string;
    dimensions: number;
  };
  legs: RetrievalTraceLeg[];
  /** Candidate order fed to the threshold after fusion. */
  fusedOrder: RetrievalTraceCandidate[];
  /** Candidates that cleared the floor, in final Evidence order. */
  chosen: RetrievalTraceCandidate[];
  abstained: boolean;
  abstentionReason: RetrievalAbstentionReason | null;
  /** Wall-clock duration of the retrieval call, in milliseconds. */
  latencyMs: number;
  cost: {
    /** Estimated tokens sent to the embedding provider for the query. */
    embeddingInputTokens: number;
  };
}
