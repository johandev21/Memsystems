import type {
  QueryRewriteTrigger,
  RetrievalRewriteReason,
} from './query-understanding';

export type { QueryRewriteTrigger, RetrievalRewriteReason };

export type RetrievalTraceKind = 'chat' | 'generation';

export type RetrievalAbstentionReason = 'no_indexed_chunks' | 'below_threshold';

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
  score: number;
  rank: number;
}

export interface RetrievalTraceRerankedCandidate extends RetrievalTraceCandidate {
  rerankScore: number;
}

export interface RetrievalTraceRerank {
  model: string;
  applied: boolean;
  skippedReason: RetrievalRerankSkippedReason | null;
  threshold: number;
  candidates: RetrievalTraceRerankedCandidate[];
  inputTokens: number;
}

export interface RetrievalTraceLeg {
  kind: 'dense' | 'lexical';
  variant: number;
  candidates: RetrievalTraceCandidate[];
}

export interface RetrievalTraceFusion {
  k: number;
  weights: { dense: number; lexical: number };
  depths: { dense: number; lexical: number };
  variants: number;
}

export const MAX_TRACE_HYPOTHETICAL_CHARS = 500;

export interface RetrievalTraceEvidenceItem {
  chunkId: string;
  sourceId: string;
  chunkIndex: number;
  tokens: number;
  sectionExpanded: boolean;
}

export interface RetrievalTraceEvidence {
  overlapThreshold: number;
  maxPerSource: number;
  tokenBudget: number;
  sectionExpansion: boolean;
  tokens: number;
  budgetExhausted: boolean;
  items: RetrievalTraceEvidenceItem[];
  droppedOverlap: RetrievalTraceCandidate[];
  droppedDiversity: RetrievalTraceCandidate[];
  droppedBudget: RetrievalTraceCandidate[];
}

export interface RetrievalTraceRewrite {
  enabled: boolean;
  original: string;
  query: string;
  variants: string[];
  hypotheticalAnswer: string | null;
  trigger: QueryRewriteTrigger | null;
  strategy: 'model' | 'heuristic' | null;
  reason: RetrievalRewriteReason | null;
  model: string;
}

export interface RetrievalTraceScope {
  kind: 'notebook' | 'selected_sources';
  sourceIds: string[] | null;
}

export interface RetrievalTrace {
  version: 5;
  query: string;
  topK: number;
  scope: RetrievalTraceScope;
  relevanceFloor: number;
  embedding: {
    model: string;
    dimensions: number;
  };
  rewrite: RetrievalTraceRewrite | null;
  legs: RetrievalTraceLeg[];
  fusion: RetrievalTraceFusion;
  fusedOrder: RetrievalTraceCandidate[];
  rerank: RetrievalTraceRerank;
  evidence: RetrievalTraceEvidence;
  chosen: RetrievalTraceCandidate[];
  abstained: boolean;
  abstentionReason: RetrievalAbstentionReason | null;
  latencyMs: number;
  cost: {
    embeddingInputTokens: number;
    rerankInputTokens: number;
    rewriteInputTokens: number;
    rewriteOutputTokens: number;
  };
}
