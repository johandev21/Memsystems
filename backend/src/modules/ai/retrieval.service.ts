import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { DRIZZLE } from '../database/database.module';
import { EMBEDDING_DIMENSIONS, EmbeddingService } from './embedding.service';
import {
  MAX_RERANK_DOCUMENTS,
  estimateVoyageTokens,
} from './providers/voyage.client';
import { reciprocalRankFusion, type FusedCandidate } from './rank-fusion';
import { RerankerService, type Reranker } from './reranker.service';
import type {
  RetrievalAbstentionReason,
  RetrievalRerankSkippedReason,
  RetrievalTrace,
  RetrievalTraceCandidate,
  RetrievalTraceFusion,
  RetrievalTraceLeg,
  RetrievalTraceRerankedCandidate,
} from './retrieval-trace';

export type { RetrievalAbstentionReason } from './retrieval-trace';

/** Sources named in a no-evidence reply, capped to keep the reply readable. */
const MAX_UNHELPFUL_SOURCES = 5;

/**
 * Cap on the lexemes OR-ed into one lexical query, so a long message cannot
 * build an unbounded tsquery. Lexemes come from the parser in lexicographic
 * order, which keeps the selection deterministic; ordinary questions stay
 * well below the cap.
 */
const MAX_LEXICAL_TERMS = 64;

/** Location metadata carried from a source segment into an index chunk. */
export interface CitationLocator {
  pageNumber?: number;
  slideNumber?: number;
  startOffsetMs?: number;
  endOffsetMs?: number;
  speaker?: string;
  sheetName?: string;
  cellRange?: string;
  symbol?: string;
  lineStart?: number;
  lineEnd?: number;
  imageRegion?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface RetrievedChunk {
  chunkId: string;
  chunkIndex: number;
  sourceId: string;
  title: string;
  content: string;
  /**
   * The dense retrieval score (cosine similarity). Reranking reorders chunks
   * but never overwrites this value, so the score shown in the Evidence block
   * is not the reranker score.
   */
  score: number;
  url: string | null;
  kind: string;
  sourceVersionId: string | null;
  locator: CitationLocator | null;
}

export const DEFAULT_TOP_K = 8;

/** The distinct source behind candidates that did not clear the threshold. */
export interface UnhelpfulSource {
  id: string;
  title: string;
  kind: string;
  url: string | null;
}

/**
 * The retrieval outcome. A normal result carries the Evidence chunks; an
 * abstention carries no chunks, a reason, and the sources whose candidates
 * failed the applied threshold so the Chat can name them. Every outcome
 * carries the structured trace that callers persist for diagnosis.
 */
export interface RetrievalResult {
  chunks: RetrievedChunk[];
  abstained: boolean;
  abstentionReason: RetrievalAbstentionReason | null;
  unhelpfulSources: UnhelpfulSource[];
}

export interface RetrievalOutcome extends RetrievalResult {
  trace: RetrievalTrace;
}

/**
 * One call through the retrieval pipeline. Chat searches the whole Notebook;
 * Study Material Generation restricts the search to the selected sources,
 * where `topK` bounds each source independently so every selected source
 * contributes its best chunks.
 */
export interface RetrievalRequest {
  notebookId: string;
  query: string;
  topK?: number;
  sourceIds?: string[];
  /** Overrides the configured floor for this call (grounding may pass 0). */
  relevanceFloor?: number;
  /** Overrides the configured rerank threshold (grounding may pass 0). */
  rerankThreshold?: number;
}

/** Minimum cosine similarity for a chunk to serve as Evidence. */
export interface RetrievalRelevanceConfig {
  relevanceFloor: number;
}

/**
 * Documented default for the relevance floor. Cosine similarity below this
 * value is treated as unrelated material, not as weak Evidence. It is the
 * threshold applied when reranking is unavailable; a reranked Evidence set
 * is gated by the rerank threshold instead.
 */
export const DEFAULT_RELEVANCE_FLOOR = 0.3;

export const RETRIEVAL_RELEVANCE_CONFIG = 'RETRIEVAL_RELEVANCE_CONFIG';

/**
 * Documented default for how many candidates each retrieval leg over-fetches
 * before the legs are fused, near-duplicates are removed, and the survivors
 * are reranked. Four times the default top-k is deep enough for the reranker
 * to promote a passage a leg ranked low, without paying for hundreds of
 * documents.
 */
export const DEFAULT_CANDIDATE_DEPTH = 32;

/**
 * Documented default for the Reciprocal Rank Fusion smoothing constant. The
 * original RRF paper's k = 60 is deliberately high: it flattens the
 * contribution of the very top ranks so one leg's first place cannot dominate
 * the fused order.
 */
export const DEFAULT_FUSION_K = 60;

/**
 * Documented default reranker. `rerank-2.5` is the provider's recommended
 * quality model; `rerank-2.5-lite` is the cheaper alternative.
 */
export const DEFAULT_RERANK_MODEL = 'rerank-2.5';

/**
 * Documented default for the rerank threshold. The provider scores
 * relevance from 0 to 1; its published examples place clearly relevant
 * passages well above 0.4 and unrelated passages around 0.25–0.3, so 0.4
 * drops unrelated material while keeping borderline passages. Tune it on
 * the evaluation set (see docs/retrieval-evaluation.md).
 */
export const DEFAULT_RERANK_THRESHOLD = 0.4;

/** The reranking stage's knobs and the Evidence bound it selects. */
export interface RetrievalRerankConfig {
  enabled: boolean;
  model: string;
  candidateDepth: number;
  threshold: number;
  /** Final Evidence depth; per source when the scope is selected sources. */
  topK: number;
}

export const RETRIEVAL_RERANK_CONFIG = 'RETRIEVAL_RERANK_CONFIG';

export const DEFAULT_RERANK_CONFIG: RetrievalRerankConfig = {
  enabled: true,
  model: DEFAULT_RERANK_MODEL,
  candidateDepth: DEFAULT_CANDIDATE_DEPTH,
  threshold: DEFAULT_RERANK_THRESHOLD,
  topK: DEFAULT_TOP_K,
};

/**
 * Hybrid retrieval's knobs: the lexical leg and the Reciprocal Rank Fusion it
 * feeds. The lexical leg runs over the chunk's generated `search_vector`,
 * which uses the `simple` configuration — no stemming and no stop words — so
 * identifiers and mixed-language terms are matched exactly.
 */
export interface RetrievalHybridConfig {
  /** Whether the lexical leg runs and contributes to the fusion. */
  enabled: boolean;
  /** RRF smoothing constant; higher values flatten the rank contribution. */
  fusionK: number;
  /** The dense leg's fusion weight in [0, 1]. */
  denseWeight: number;
  /** The lexical leg's fusion weight in [0, 1]. */
  lexicalWeight: number;
  /** Dense-leg over-fetch override; null uses the configured candidate depth. */
  denseCandidateDepth: number | null;
  /** Lexical-leg over-fetch override; null uses the configured candidate depth. */
  lexicalCandidateDepth: number | null;
}

export const RETRIEVAL_HYBRID_CONFIG = 'RETRIEVAL_HYBRID_CONFIG';

export const DEFAULT_HYBRID_CONFIG: RetrievalHybridConfig = {
  enabled: true,
  fusionK: DEFAULT_FUSION_K,
  denseWeight: 1,
  lexicalWeight: 1,
  denseCandidateDepth: null,
  lexicalCandidateDepth: null,
};

/** Reads the relevance floor from the environment, falling back to the default. */
export function loadRetrievalRelevanceConfig(
  env: NodeJS.ProcessEnv = process.env,
): RetrievalRelevanceConfig {
  return {
    relevanceFloor: clamp(
      parseRatio(env.RETRIEVAL_RELEVANCE_FLOOR, DEFAULT_RELEVANCE_FLOOR),
      0,
      1,
    ),
  };
}

/**
 * Reads the reranking configuration from the environment, falling back to
 * the documented defaults for anything unset or invalid. Candidate depth is
 * clamped to the provider's per-request document limit; a candidate set that
 * still exceeds it (many selected sources over-fetch in parallel) skips
 * reranking rather than sending an over-limit request.
 */
export function loadRetrievalRerankConfig(
  env: NodeJS.ProcessEnv = process.env,
): RetrievalRerankConfig {
  return {
    enabled: parseBoolean(env.RETRIEVAL_RERANK_ENABLED, true),
    model: env.RETRIEVAL_RERANK_MODEL?.trim() || DEFAULT_RERANK_MODEL,
    candidateDepth: clamp(
      parsePositiveInt(env.RETRIEVAL_CANDIDATE_DEPTH, DEFAULT_CANDIDATE_DEPTH),
      1,
      MAX_RERANK_DOCUMENTS,
    ),
    threshold: clamp(
      parseRatio(env.RETRIEVAL_RERANK_THRESHOLD, DEFAULT_RERANK_THRESHOLD),
      0,
      1,
    ),
    topK: Math.max(1, parsePositiveInt(env.RETRIEVAL_TOP_K, DEFAULT_TOP_K)),
  };
}

/**
 * Reads the hybrid retrieval configuration from the environment, falling
 * back to the documented defaults for anything unset or invalid. Weights are
 * ratios in [0, 1]; a weight of 0 removes that leg from the fusion. A per-leg
 * depth override is clamped to the provider's document limit; an unset
 * override keeps the shared candidate depth.
 */
export function loadRetrievalHybridConfig(
  env: NodeJS.ProcessEnv = process.env,
): RetrievalHybridConfig {
  return {
    enabled: parseBoolean(env.RETRIEVAL_HYBRID_ENABLED, true),
    fusionK: clamp(
      parsePositiveInt(env.RETRIEVAL_RRF_K, DEFAULT_FUSION_K),
      1,
      MAX_RERANK_DOCUMENTS,
    ),
    denseWeight: clamp(parseRatio(env.RETRIEVAL_RRF_DENSE_WEIGHT, 1), 0, 1),
    lexicalWeight: clamp(parseRatio(env.RETRIEVAL_RRF_LEXICAL_WEIGHT, 1), 0, 1),
    denseCandidateDepth: parseDepthOverride(
      env.RETRIEVAL_DENSE_CANDIDATE_DEPTH,
    ),
    lexicalCandidateDepth: parseDepthOverride(
      env.RETRIEVAL_LEXICAL_CANDIDATE_DEPTH,
    ),
  };
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  return fallback;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function parseRatio(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function parseDepthOverride(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return clamp(parsed, 1, MAX_RERANK_DOCUMENTS);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface RetrievalChunkRow {
  chunk_id: string;
  chunk_index: number;
  source_id: string;
  title: string;
  url: string | null;
  kind: string;
  source_version_id: string | null;
  locator: CitationLocator | null;
  content: string;
  /** Contextual searchable text; what the reranker scores. */
  searchable_text: string;
  /** The leg's own score: cosine similarity or `ts_rank_cd`. */
  score: number;
  /**
   * Cosine similarity, selected by the lexical leg too so a lexical-only
   * candidate still has a dense relevance signal for the floor and Evidence.
   */
  dense_score?: number | null;
}

/** One candidate after fusion, with its cross-encoder score when reranked. */
interface RankedCandidate {
  row: RetrievalChunkRow;
  /** The Reciprocal Rank Fusion score that ordered the candidate. */
  fusedScore: number;
  rerankScore: number | null;
}

/** The resolved knobs one `retrieve` call runs with. */
interface RetrievalPolicy {
  topK: number;
  sourceIds: string[] | null;
  relevanceFloor: number;
  rerankThreshold: number;
}

interface RerankOutcome {
  applied: boolean;
  skippedReason: RetrievalRerankSkippedReason | null;
  /** Candidates in final order; fused order when reranking did not apply. */
  candidates: RankedCandidate[];
  /** Cross-encoder scores in reranked order; empty when not applied. */
  traceCandidates: RetrievalTraceRerankedCandidate[];
  inputTokens: number;
}

/**
 * Token-set Jaccard similarity at or above which two candidates are treated
 * as near-duplicates. Re-ingesting the same content, or importing the same
 * page twice, produces chunks that share almost every token; the threshold
 * keeps genuinely overlapping chunks (partial repetition) in the candidate
 * set.
 */
const NEAR_DUPLICATE_SIMILARITY = 0.9;

/**
 * The single retrieval pipeline entry point. It composes the retrieval
 * stages (query embedding, dense and lexical search legs, reciprocal rank
 * fusion, near-duplicate removal, reranking, relevance threshold, top-k
 * selection) and returns both the Evidence and the trace that explains how
 * it was chosen. Chat and Study Material Generation both call this; later
 * retrieval tickets change the stages behind it rather than adding call
 * sites.
 */
@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);
  private readonly relevanceFloor: number;
  private readonly rerankConfig: RetrievalRerankConfig;
  private readonly hybridConfig: RetrievalHybridConfig;

  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly embeddingService: EmbeddingService,
    @Optional()
    @Inject(RETRIEVAL_RELEVANCE_CONFIG)
    relevanceConfig?: RetrievalRelevanceConfig,
    @Optional()
    @Inject(RETRIEVAL_RERANK_CONFIG)
    rerankConfig?: RetrievalRerankConfig,
    @Optional()
    @Inject(RerankerService)
    private readonly reranker?: Reranker,
    @Optional()
    @Inject(RETRIEVAL_HYBRID_CONFIG)
    hybridConfig?: RetrievalHybridConfig,
  ) {
    this.relevanceFloor =
      relevanceConfig?.relevanceFloor ?? DEFAULT_RELEVANCE_FLOOR;
    this.rerankConfig = rerankConfig ?? DEFAULT_RERANK_CONFIG;
    this.hybridConfig = hybridConfig ?? DEFAULT_HYBRID_CONFIG;
  }

  /** The model the query embedding used, for the retrieval trace. */
  private embeddingModelName(): string {
    return this.embeddingService.queryEmbeddingModel();
  }

  async retrieve(request: RetrievalRequest): Promise<RetrievalOutcome> {
    const startedAt = performance.now();
    const policy: RetrievalPolicy = {
      topK: request.topK ?? this.rerankConfig.topK,
      relevanceFloor: request.relevanceFloor ?? this.relevanceFloor,
      rerankThreshold: request.rerankThreshold ?? this.rerankConfig.threshold,
      sourceIds: request.sourceIds ? [...request.sourceIds] : null,
    };
    // The reranker needs candidates the legs ranked below the requested
    // top-k, so over-fetch at least the configured candidate depth. Each leg
    // can override that depth independently.
    const candidateDepth = Math.max(
      this.rerankConfig.candidateDepth,
      policy.topK,
    );
    const denseDepth = Math.max(
      this.hybridConfig.denseCandidateDepth ?? candidateDepth,
      policy.topK,
    );
    const lexicalDepth = Math.max(
      this.hybridConfig.lexicalCandidateDepth ?? candidateDepth,
      policy.topK,
    );
    const fusion: RetrievalTraceFusion = {
      k: this.hybridConfig.fusionK,
      weights: {
        dense: this.hybridConfig.denseWeight,
        lexical: this.hybridConfig.lexicalWeight,
      },
      depths: {
        dense: denseDepth,
        lexical: this.hybridConfig.enabled ? lexicalDepth : 0,
      },
    };

    // An explicitly empty selection can never match a chunk.
    if (policy.sourceIds && policy.sourceIds.length === 0) {
      return this.emptyOutcome(request, policy, {
        fusion,
        abstentionReason: 'no_indexed_chunks',
        skippedReason: 'no_candidates',
        elapsedMs: performance.now() - startedAt,
      });
    }

    const queryEmbedding = await this.embeddingService.embedQuery(
      request.query,
    );
    // The legs are separate candidate lists over the same scope; run them
    // together and fuse their ranks rather than their scores.
    const [denseRows, lexicalRows] = await Promise.all([
      this.searchDense(
        request.notebookId,
        queryEmbedding,
        denseDepth,
        policy.sourceIds,
      ),
      this.hybridConfig.enabled
        ? this.searchLexical(
            request.notebookId,
            request.query,
            queryEmbedding,
            lexicalDepth,
            policy.sourceIds,
          )
        : Promise.resolve<RetrievalChunkRow[]>([]),
    ]);

    const legs: {
      kind: RetrievalTraceLeg['kind'];
      weight: number;
      candidates: RetrievalChunkRow[];
    }[] = [
      {
        kind: 'dense',
        weight: this.hybridConfig.denseWeight,
        candidates: denseRows,
      },
    ];
    if (this.hybridConfig.enabled) {
      legs.push({
        kind: 'lexical',
        weight: this.hybridConfig.lexicalWeight,
        candidates: lexicalRows,
      });
    }
    const traceLegs: RetrievalTraceLeg[] = legs.map((leg) => ({
      kind: leg.kind,
      candidates: leg.candidates.map((row, index) =>
        traceCandidate(row, index + 1, Number(row.score)),
      ),
    }));

    const fused = reciprocalRankFusion(
      legs,
      (row) => row.chunk_id,
      this.hybridConfig.fusionK,
    );

    if (fused.length === 0) {
      return this.emptyOutcome(request, policy, {
        legs: traceLegs,
        fusion,
        abstentionReason: 'no_indexed_chunks',
        skippedReason: 'no_candidates',
        elapsedMs: performance.now() - startedAt,
        embeddingInputTokens: estimateVoyageTokens(request.query),
      });
    }

    // The fused order feeds reranking; near-duplicates are removed first so
    // the reranker never scores the same passage twice.
    const deduped = dedupeNearDuplicates(fused);
    const fusedOrder = deduped.map((candidate, index) =>
      traceCandidate(candidate.candidate, index + 1, candidate.score),
    );

    const rerank = await this.rerankCandidates(request.query, deduped);
    // Reranking gates Evidence on the cross-encoder score; without it, the
    // dense cosine floor is the gate, so a lexical-only candidate that is
    // semantically distant is dropped rather than padding the answer.
    const threshold = rerank.applied
      ? policy.rerankThreshold
      : policy.relevanceFloor;
    const above: RankedCandidate[] = [];
    const below: RetrievedChunk[] = [];
    for (const candidate of rerank.candidates) {
      if (candidateScore(candidate) >= threshold) above.push(candidate);
      else below.push(chunkFromRow(candidate.row));
    }

    const selected = selectEvidence(
      above,
      policy.topK,
      policy.sourceIds !== null,
    );
    const chunks = selected.map((candidate) => chunkFromRow(candidate.row));
    const chosen = selected.map((candidate, index) =>
      traceCandidate(candidate.row, index + 1, candidate.fusedScore),
    );
    const abstained = chunks.length === 0;
    const abstentionReason: RetrievalAbstentionReason | null = abstained
      ? 'below_threshold'
      : null;

    return {
      chunks,
      abstained,
      abstentionReason,
      unhelpfulSources: distinctSources(below),
      trace: buildTrace({
        query: request.query,
        topK: policy.topK,
        sourceIds: policy.sourceIds,
        relevanceFloor: policy.relevanceFloor,
        embeddingModel: this.embeddingModelName(),
        legs: traceLegs,
        fusion,
        fusedOrder,
        rerank: {
          model: this.rerankConfig.model,
          applied: rerank.applied,
          skippedReason: rerank.skippedReason,
          threshold: policy.rerankThreshold,
          candidates: rerank.traceCandidates,
          inputTokens: rerank.inputTokens,
        },
        chosen,
        abstained,
        abstentionReason,
        elapsedMs: performance.now() - startedAt,
        embeddingInputTokens: estimateVoyageTokens(request.query),
      }),
    };
  }

  /** An empty retrieval outcome: no chunks, an explicit reason, a full trace. */
  private emptyOutcome(
    request: RetrievalRequest,
    policy: RetrievalPolicy,
    input: {
      legs?: RetrievalTraceLeg[];
      fusion: RetrievalTraceFusion;
      abstentionReason: RetrievalAbstentionReason;
      skippedReason: RetrievalRerankSkippedReason;
      elapsedMs: number;
      embeddingInputTokens?: number;
    },
  ): RetrievalOutcome {
    return {
      chunks: [],
      abstained: true,
      abstentionReason: input.abstentionReason,
      unhelpfulSources: [],
      trace: buildTrace({
        query: request.query,
        topK: policy.topK,
        sourceIds: policy.sourceIds,
        relevanceFloor: policy.relevanceFloor,
        embeddingModel: this.embeddingModelName(),
        legs: input.legs ?? [],
        fusion: input.fusion,
        fusedOrder: [],
        rerank: {
          model: this.rerankConfig.model,
          applied: false,
          skippedReason: input.skippedReason,
          threshold: policy.rerankThreshold,
          candidates: [],
          inputTokens: 0,
        },
        chosen: [],
        abstained: true,
        abstentionReason: input.abstentionReason,
        elapsedMs: input.elapsedMs,
        embeddingInputTokens: input.embeddingInputTokens ?? 0,
      }),
    };
  }

  /**
   * Reranks the fused candidates with the cross-encoder. Any provider
   * failure — or an unconfigured key — degrades to the fused order so the
   * turn still answers; the trace records why.
   */
  private async rerankCandidates(
    query: string,
    fused: FusedCandidate<RetrievalChunkRow>[],
  ): Promise<RerankOutcome> {
    const fallback = (
      skippedReason: RetrievalRerankSkippedReason,
    ): RerankOutcome => ({
      applied: false,
      skippedReason,
      candidates: fused.map(({ candidate, score }) => ({
        row: candidate,
        fusedScore: score,
        rerankScore: null,
      })),
      traceCandidates: [],
      inputTokens: 0,
    });

    if (!this.rerankConfig.enabled) return fallback('disabled');
    if (!this.reranker) return fallback('unavailable');
    // The provider caps a request at 1,000 documents. Selected-source scopes
    // over-fetch per source, so many selected sources can exceed that even
    // with candidate depth clamped; degrade rather than send an invalid call.
    if (fused.length > MAX_RERANK_DOCUMENTS) {
      return fallback('too_many_candidates');
    }

    let response: Awaited<ReturnType<Reranker['rerank']>>;
    try {
      response = await this.reranker.rerank({
        query,
        // Score the contextual searchable text, not just the body: a chunk
        // that refers to "the second argument" is only judgeable with its
        // section and document context in view. The stored body still stays
        // the text shown to the model and used for citations.
        documents: fused.map(({ candidate }) => candidate.searchable_text),
        model: this.rerankConfig.model,
      });
    } catch (error) {
      this.logger.warn(
        `Reranker failed; falling back to fused order: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return fallback('failed');
    }

    if (!response) return fallback('unavailable');
    const scores = mapRerankScores(response.candidates, fused.length);
    if (!scores) {
      this.logger.warn(
        'Reranker returned an incomplete score set; falling back to fused order.',
      );
      return fallback('failed');
    }

    const candidates: RankedCandidate[] = fused
      .map(({ candidate, score }, index) => ({
        row: candidate,
        fusedScore: score,
        rerankScore: scores[index],
      }))
      .sort((a, b) => b.rerankScore - a.rerankScore);
    return {
      applied: true,
      skippedReason: null,
      candidates,
      traceCandidates: candidates.map((candidate, index) => ({
        ...traceCandidate(candidate.row, index + 1, candidate.fusedScore),
        rerankScore: candidate.rerankScore!,
      })),
      inputTokens: response.inputTokens,
    };
  }

  /** The dense leg: nearest neighbours by cosine similarity. */
  private async searchDense(
    notebookId: string,
    embedding: number[],
    depth: number,
    sourceIds: string[] | null,
  ): Promise<RetrievalChunkRow[]> {
    const vectorLiteral = `[${embedding.join(',')}]`;
    return this.runLegSearch(
      { notebookId, depth, sourceIds },
      {
        projection: sql`
          ${chunkColumns()},
          1 - (sc.embedding <=> ${vectorLiteral}::vector) AS score
        `,
        // Ordering on the distance keeps the HNSW index usable.
        rank: sql`sc.embedding <=> ${vectorLiteral}::vector`,
      },
    );
  }

  /**
   * The lexical leg: full-text candidates ranked by `ts_rank_cd`. The tsquery
   * is built by the database's own parser so a term is lexed exactly as it
   * was indexed — `RFC-2616` becomes the same lexemes on both sides — and the
   * terms are OR-ed. `ts_rank_cd` then orders by cover density: how many of
   * the query's lexemes a chunk contains and how close together they are. The
   * leg also selects the cosine similarity, so a lexical-only candidate still
   * carries a dense relevance signal.
   */
  private async searchLexical(
    notebookId: string,
    query: string,
    embedding: number[],
    depth: number,
    sourceIds: string[] | null,
  ): Promise<RetrievalChunkRow[]> {
    const vectorLiteral = `[${embedding.join(',')}]`;
    return this.runLegSearch(
      { notebookId, depth, sourceIds },
      {
        cte: sql`
          WITH lexemes AS (
            SELECT lexeme
            FROM unnest(
              tsvector_to_array(to_tsvector('simple', ${query}))
            ) AS lexeme
            ORDER BY lexeme
            LIMIT ${MAX_LEXICAL_TERMS}
          ), q AS (
            SELECT to_tsquery(
              'simple',
              string_agg(quote_literal(lexeme), ' | ')
            ) AS query
            FROM lexemes
          )
        `,
        join: sql`CROSS JOIN q`,
        predicate: sql`AND sc.search_vector @@ q.query`,
        projection: sql`
          ${chunkColumns()},
          ts_rank_cd(sc.search_vector, q.query) AS score,
          1 - (sc.embedding <=> ${vectorLiteral}::vector) AS dense_score
        `,
        rank: sql`ts_rank_cd(sc.search_vector, q.query) DESC`,
      },
    );
  }

  /**
   * Runs one leg over the resolved scope. Both legs share the same filters —
   * notebook, non-degraded sources, and the selected source ids — so a
   * filter can never apply to one candidate list but not the other. The
   * per-source scope bounds each selected source independently.
   */
  private async runLegSearch(
    search: { notebookId: string; depth: number; sourceIds: string[] | null },
    leg: {
      /** Leading CTE the projection and predicate reference, if any. */
      cte?: SQL;
      /** Extra FROM/JOIN fragment the projection depends on. */
      join?: SQL;
      /** Extra WHERE predicate, starting with AND, if any. */
      predicate?: SQL;
      /** The leg's SELECT columns, including its score columns. */
      projection: SQL;
      /** The leg's ordering expression, best first. */
      rank: SQL;
    },
  ): Promise<RetrievalChunkRow[]> {
    const sourceFilter = search.sourceIds
      ? sql`AND sc.source_id IN (${sql.join(
          search.sourceIds.map((id) => sql`${id}`),
          sql`, `,
        )})`
      : null;

    if (search.sourceIds) {
      const result = await this.db.execute(
        sql`
          ${leg.cte ?? sql``}
          SELECT * FROM (
            SELECT
              ${leg.projection},
              row_number() OVER (
                PARTITION BY sc.source_id
                ORDER BY ${leg.rank}, sc.id
              ) AS source_rank
            FROM source_chunks sc
            JOIN sources s ON s.id = sc.source_id
            ${leg.join ?? sql``}
            WHERE sc.notebook_id = ${search.notebookId}
              AND s.processing_status <> 'degraded'
              ${leg.predicate ?? sql``}
              ${sourceFilter}
          ) ranked
          WHERE ranked.source_rank <= ${search.depth}
          ORDER BY ranked.score DESC, ranked.chunk_id
        `,
      );
      return result.rows as unknown as RetrievalChunkRow[];
    }

    const result = await this.db.execute(
      sql`
        ${leg.cte ?? sql``}
        SELECT ${leg.projection}
        FROM source_chunks sc
        JOIN sources s ON s.id = sc.source_id
        ${leg.join ?? sql``}
        WHERE sc.notebook_id = ${search.notebookId}
          AND s.processing_status <> 'degraded'
          ${leg.predicate ?? sql``}
        ORDER BY ${leg.rank}, sc.id
        LIMIT ${search.depth}
      `,
    );
    return result.rows as unknown as RetrievalChunkRow[];
  }
}

/** The columns every leg selects; the leg appends its own score columns. */
function chunkColumns(): SQL {
  return sql`
    sc.id AS chunk_id,
    sc.chunk_index,
    sc.source_id,
    s.title,
    s.url,
    s.kind,
    sc.source_version_id,
    sc.locator,
    sc.content,
    sc.searchable_text
  `;
}

function buildTrace(input: {
  query: string;
  topK: number;
  sourceIds: string[] | null;
  relevanceFloor: number;
  embeddingModel: string;
  legs: RetrievalTraceLeg[];
  fusion: RetrievalTraceFusion;
  fusedOrder: RetrievalTraceCandidate[];
  rerank: RetrievalTrace['rerank'];
  chosen: RetrievalTraceCandidate[];
  abstained: boolean;
  abstentionReason: RetrievalAbstentionReason | null;
  elapsedMs: number;
  embeddingInputTokens: number;
}): RetrievalTrace {
  return {
    version: 3,
    query: input.query,
    topK: input.topK,
    scope: {
      kind: input.sourceIds ? 'selected_sources' : 'notebook',
      sourceIds: input.sourceIds,
    },
    relevanceFloor: input.relevanceFloor,
    embedding: {
      model: input.embeddingModel,
      dimensions: EMBEDDING_DIMENSIONS,
    },
    legs: input.legs,
    fusion: input.fusion,
    fusedOrder: input.fusedOrder,
    rerank: input.rerank,
    chosen: input.chosen,
    abstained: input.abstained,
    abstentionReason: input.abstentionReason,
    latencyMs: Math.max(0, Math.round(input.elapsedMs)),
    cost: {
      embeddingInputTokens: input.embeddingInputTokens,
      rerankInputTokens: input.rerank.inputTokens,
    },
  };
}

function traceCandidate(
  row: RetrievalChunkRow,
  rank: number,
  score: number,
): RetrievalTraceCandidate {
  return {
    chunkId: row.chunk_id,
    sourceId: row.source_id,
    chunkIndex: row.chunk_index,
    score,
    rank,
  };
}

function chunkFromRow(row: RetrievalChunkRow): RetrievedChunk {
  return {
    chunkId: row.chunk_id,
    chunkIndex: row.chunk_index,
    sourceId: row.source_id,
    title: row.title,
    url: row.url,
    kind: row.kind,
    sourceVersionId: row.source_version_id ?? null,
    locator: row.locator ?? null,
    content: row.content,
    score: denseScoreOf(row),
  };
}

/** The cosine similarity of a row, whether it came from the dense or lexical leg. */
function denseScoreOf(row: RetrievalChunkRow): number {
  return Number(row.dense_score ?? row.score);
}

function candidateScore(candidate: RankedCandidate): number {
  return candidate.rerankScore ?? denseScoreOf(candidate.row);
}

/**
 * Maps reranker results back onto the candidate list. Returns null when the
 * response does not score every candidate exactly once, which the pipeline
 * treats as a failed rerank.
 */
function mapRerankScores(
  candidates: { index: number; relevanceScore: number }[],
  count: number,
): number[] | null {
  if (candidates.length !== count) return null;
  const scores = new Array<number | undefined>(count).fill(undefined);
  for (const candidate of candidates) {
    if (
      !Number.isInteger(candidate.index) ||
      candidate.index < 0 ||
      candidate.index >= count ||
      !Number.isFinite(candidate.relevanceScore) ||
      scores[candidate.index] !== undefined
    ) {
      return null;
    }
    scores[candidate.index] = candidate.relevanceScore;
  }
  return scores as number[];
}

/**
 * Removes near-duplicate candidates from the fused order before reranking,
 * keeping the best-ranked representative of each duplicate group.
 */
function dedupeNearDuplicates(
  candidates: FusedCandidate<RetrievalChunkRow>[],
): FusedCandidate<RetrievalChunkRow>[] {
  const kept: {
    candidate: FusedCandidate<RetrievalChunkRow>;
    tokens: Set<string>;
  }[] = [];
  for (const candidate of candidates) {
    const tokens = tokenizeForSimilarity(candidate.candidate.content);
    const duplicate = kept.some(
      (entry) =>
        jaccardSimilarity(entry.tokens, tokens) >= NEAR_DUPLICATE_SIMILARITY,
    );
    if (!duplicate) kept.push({ candidate, tokens });
  }
  return kept.map((entry) => entry.candidate);
}

/**
 * Unicode-aware word tokens, so accented Spanish text is not mangled. Single
 * characters are kept: chunks that differ only by a number ("Chapter 1" vs
 * "Chapter 2") must not collapse into duplicates.
 */
function tokenizeForSimilarity(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Bounds the final Evidence set. Notebook-wide, the best `topK` candidates
 * are kept; for selected sources, `topK` bounds each source independently so
 * every selected source contributes its best chunks.
 */
function selectEvidence(
  above: RankedCandidate[],
  topK: number,
  perSource: boolean,
): RankedCandidate[] {
  if (!perSource) return above.slice(0, topK);

  const counts = new Map<string, number>();
  const selected: RankedCandidate[] = [];
  for (const candidate of above) {
    const sourceId = candidate.row.source_id;
    const count = counts.get(sourceId) ?? 0;
    if (count >= topK) continue;
    counts.set(sourceId, count + 1);
    selected.push(candidate);
  }
  return selected;
}

function distinctSources(chunks: RetrievedChunk[]): UnhelpfulSource[] {
  const byId = new Map<string, UnhelpfulSource>();
  for (const chunk of chunks) {
    if (byId.has(chunk.sourceId)) continue;
    byId.set(chunk.sourceId, {
      id: chunk.sourceId,
      title: chunk.title,
      kind: chunk.kind,
      url: chunk.url,
    });
  }
  return [...byId.values()].slice(0, MAX_UNHELPFUL_SOURCES);
}
