/**
 * The structured record of one retrieval call. Chat turns that query text and
 * Study Material Generations that select sources persist it, so a poor answer
 * can be diagnosed as an ingestion, retrieval, or generation failure. A turn
 * or generation that performs no retrieval has no trace.
 *
 * A trace never carries provider keys, the query embedding, or chunk text:
 * it stores the query, the query-understanding decision and the bounded
 * hypothetical answer a short query may have embedded, the ranking evidence
 * (ids, scores, ranks), the thresholds that were applied, and the latency and
 * token cost.
 */

import type {
  QueryRewriteTrigger,
  RetrievalRewriteReason,
} from './query-understanding';

export type { QueryRewriteTrigger, RetrievalRewriteReason };

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
  /**
   * The score of the list that contains it: a leg's own score (cosine
   * similarity or lexical rank) inside `legs`, and the Reciprocal Rank Fusion
   * score inside `fusedOrder` and `chosen`. Never the reranker score.
   */
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
 * The ranked output of one retrieval leg: the dense nearest-neighbor search
 * and the lexical full-text search, for one query variant.
 */
export interface RetrievalTraceLeg {
  kind: 'dense' | 'lexical';
  /**
   * Index into the queries the pipeline ran: 0 is the primary query and
   * `i + 1` is `rewrite.variants[i]`. Always 0 when query understanding is
   * disabled or skipped.
   */
  variant: number;
  candidates: RetrievalTraceCandidate[];
}

/** The Reciprocal Rank Fusion stage that merged the legs. */
export interface RetrievalTraceFusion {
  /** The RRF smoothing constant applied to the leg ranks. */
  k: number;
  /** The weight each leg contributed to the fusion. */
  weights: { dense: number; lexical: number };
  /** Candidates each leg over-fetched; the lexical depth is 0 when off. */
  depths: { dense: number; lexical: number };
  /**
   * How many query variants were fused. 1 means only the original or
   * rewritten message was searched; higher values mean each variant's legs
   * contributed `weight / variants` to the fusion.
   */
  variants: number;
}

/**
 * How much of a hypothetical answer the trace keeps. The passage is
 * model-generated prose, not chunk text or a secret, and storing it verbatim
 * makes the turn replayable.
 */
export const MAX_TRACE_HYPOTHETICAL_CHARS = 500;

/**
 * One assembled Evidence passage: what it cost in the model's context and
 * whether its section context was carried into it.
 */
export interface RetrievalTraceEvidenceItem {
  chunkId: string;
  sourceId: string;
  chunkIndex: number;
  /** Estimated tokens of the assembled passage. */
  tokens: number;
  /** True when the passage carries its section heading path. */
  sectionExpanded: boolean;
}

/**
 * The Evidence-assembly stage: the knobs it applied, the assembled passages
 * in final order, and the candidates it dropped and why. `chosen` in the
 * trace is the same order expressed as ranked candidates.
 */
export interface RetrievalTraceEvidence {
  /** Share of a passage's tokens a better-ranked passage contained. */
  overlapThreshold: number;
  /** The per-Source cap before backfill; 0 means unlimited. */
  maxPerSource: number;
  /** The estimated-token ceiling applied to the assembled passages. */
  tokenBudget: number;
  /** Whether selected passages could carry their section heading path. */
  sectionExpansion: boolean;
  /** Estimated tokens of all assembled passages. */
  tokens: number;
  /**
   * True when the budget bit: a passage was dropped, or the first passage
   * alone already exceeded it.
   */
  budgetExhausted: boolean;
  /** Assembled passages in final Evidence order; same order as `chosen`. */
  items: RetrievalTraceEvidenceItem[];
  /** Passages a better-ranked passage contained, in rank order. */
  droppedOverlap: RetrievalTraceCandidate[];
  /** Passages the diversity cap and top-k left out, in rank order. */
  droppedDiversity: RetrievalTraceCandidate[];
  /** Passages dropped once the token budget was exhausted, in rank order. */
  droppedBudget: RetrievalTraceCandidate[];
}

/**
 * Query understanding's record of one call: what the caller asked, what the
 * legs actually searched, and how that query was produced. `reason` records
 * the skip decision when rewriting did not run and the degradation when the
 * model was unavailable, slow, or broken.
 */
export interface RetrievalTraceRewrite {
  /** Whether the rewrite stage was enabled for the call. */
  enabled: boolean;
  /** The message the caller sent. */
  original: string;
  /** The primary query the legs and the reranker ran. */
  query: string;
  /** Paraphrases fused as extra candidate lists, excluding `query`. */
  variants: string[];
  /**
   * The hypothetical answer the primary dense leg embedded instead of the
   * query, bounded to `MAX_TRACE_HYPOTHETICAL_CHARS`; null when none ran.
   */
  hypotheticalAnswer: string | null;
  /** Why the message was rewritten; null when it was searched unchanged. */
  trigger: QueryRewriteTrigger | null;
  /** How `query` was produced; null when the original message was searched. */
  strategy: 'model' | 'heuristic' | null;
  /** Why the model did not produce `query`; null when it did. */
  reason: RetrievalRewriteReason | null;
  /** The configured rewrite model. */
  model: string;
}

/** What the call was allowed to search. */
export interface RetrievalTraceScope {
  kind: 'notebook' | 'selected_sources';
  /** The selected source ids when the scope is `selected_sources`. */
  sourceIds: string[] | null;
}

export interface RetrievalTrace {
  /** A stable shape version for traces persisted across schema changes. */
  version: 5;
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
  /**
   * The query-understanding decision and its output. Null when the call
   * short-circuited before the stage ran, such as an empty source selection.
   */
  rewrite: RetrievalTraceRewrite | null;
  legs: RetrievalTraceLeg[];
  /** The fusion knobs applied to the legs. */
  fusion: RetrievalTraceFusion;
  /**
   * The deduplicated fusion order that feeds reranking. When reranking is not
   * applied, this order is also the order the threshold selects Evidence from.
   */
  fusedOrder: RetrievalTraceCandidate[];
  rerank: RetrievalTraceRerank;
  /** The Evidence-assembly decisions and the passages they produced. */
  evidence: RetrievalTraceEvidence;
  /** Assembled Evidence in final order, expressed as ranked candidates. */
  chosen: RetrievalTraceCandidate[];
  abstained: boolean;
  abstentionReason: RetrievalAbstentionReason | null;
  /** Wall-clock duration of the retrieval call, in milliseconds. */
  latencyMs: number;
  cost: {
    /** Estimated tokens sent to the embedding provider for the queries. */
    embeddingInputTokens: number;
    /** Tokens reported by the reranker; 0 when reranking did not run. */
    rerankInputTokens: number;
    /** Tokens the rewrite model consumed; 0 when it did not run. */
    rewriteInputTokens: number;
    /** Tokens the rewrite model produced; 0 when it did not run. */
    rewriteOutputTokens: number;
  };
}
