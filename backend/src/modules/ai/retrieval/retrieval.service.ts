import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../../database/schema';
import { DRIZZLE } from '../../database/database.module';
import {
  clamp,
  parseBoolean,
  parsePositiveInt,
  parseRatio,
} from '../config-parsing';
import {
  EMBEDDING_DIMENSIONS,
  EmbeddingService,
} from '../indexing/embedding.service';
import {
  DEFAULT_EVIDENCE_CONFIG,
  RETRIEVAL_EVIDENCE_CONFIG,
  assembleEvidence,
  type EvidenceAssembly,
  type EvidencePassage,
  type RetrievalEvidenceConfig,
} from './evidence-assembly';
import {
  MAX_RERANK_DOCUMENTS,
  estimateVoyageTokens,
} from '../providers/voyage.client';
import {
  QueryUnderstandingService,
  passthroughUnderstanding,
  traceRewrite,
  type RetrievalHistoryTurn,
} from './query-understanding';
import { reciprocalRankFusion, type FusedCandidate } from './rank-fusion';
import { RerankerService, type Reranker } from './reranker.service';
import { jaccardSimilarity, textSignature } from './text-similarity';
import type {
  RetrievalAbstentionReason,
  RetrievalRerankSkippedReason,
  RetrievalTrace,
  RetrievalTraceCandidate,
  RetrievalTraceEvidence,
  RetrievalTraceFusion,
  RetrievalTraceLeg,
  RetrievalTraceRerankedCandidate,
  RetrievalTraceRewrite,
} from './retrieval-trace';

export type { RetrievalAbstentionReason } from './retrieval-trace';

const MAX_UNHELPFUL_SOURCES = 5;

const MAX_LEXICAL_TERMS = 64;

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
  sectionPath: string[];
  score: number;
  url: string | null;
  kind: string;
  sourceVersionId: string | null;
  locator: CitationLocator | null;
}

export const DEFAULT_TOP_K = 8;

export interface UnhelpfulSource {
  id: string;
  title: string;
  kind: string;
  url: string | null;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  abstained: boolean;
  abstentionReason: RetrievalAbstentionReason | null;
  unhelpfulSources: UnhelpfulSource[];
}

export interface RetrievalOutcome extends RetrievalResult {
  trace: RetrievalTrace;
}

export interface RetrievalChunkIndexRange {
  minChunkIndex: number;
  maxChunkIndex: number;
}

export interface RetrievalRequest {
  notebookId: string;
  query: string;
  topK?: number;
  sourceIds?: string[];
  history?: RetrievalHistoryTurn[];
  relevanceFloor?: number;
  rerankThreshold?: number;
  tokenBudget?: number;
  skipQueryUnderstanding?: boolean;
  headingPaths?: string[][];
  chunkIndexRange?: RetrievalChunkIndexRange;
  excludeChunkIds?: string[];
}

export interface RetrievalRelevanceConfig {
  relevanceFloor: number;
}

export const DEFAULT_RELEVANCE_FLOOR = 0.3;

export const RETRIEVAL_RELEVANCE_CONFIG = 'RETRIEVAL_RELEVANCE_CONFIG';

export const DEFAULT_CANDIDATE_DEPTH = 32;

export const DEFAULT_FUSION_K = 60;

export const DEFAULT_RERANK_MODEL = 'rerank-2.5';

export const DEFAULT_RERANK_THRESHOLD = 0.4;

export interface RetrievalRerankConfig {
  enabled: boolean;
  model: string;
  candidateDepth: number;
  threshold: number;
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

export interface RetrievalHybridConfig {
  enabled: boolean;
  fusionK: number;
  denseWeight: number;
  lexicalWeight: number;
  denseCandidateDepth: number | null;
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

function parseDepthOverride(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return clamp(parsed, 1, MAX_RERANK_DOCUMENTS);
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
  heading_path: string[] | null;
  searchable_text: string;
  score: number;
  dense_score?: number | null;
}

interface RankedCandidate {
  row: RetrievalChunkRow;
  fusedScore: number;
  rerankScore: number | null;
}

interface RetrievalPolicy {
  topK: number;
  sourceIds: string[] | null;
  relevanceFloor: number;
  rerankThreshold: number;
}

interface RerankOutcome {
  applied: boolean;
  skippedReason: RetrievalRerankSkippedReason | null;
  candidates: RankedCandidate[];
  traceCandidates: RetrievalTraceRerankedCandidate[];
  inputTokens: number;
}

const NEAR_DUPLICATE_SIMILARITY = 0.9;

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);
  private readonly relevanceFloor: number;
  private readonly rerankConfig: RetrievalRerankConfig;
  private readonly hybridConfig: RetrievalHybridConfig;
  private readonly evidenceConfig: RetrievalEvidenceConfig;

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
    @Optional()
    @Inject(QueryUnderstandingService)
    private readonly queryUnderstanding?: QueryUnderstandingService,
    @Optional()
    @Inject(RETRIEVAL_EVIDENCE_CONFIG)
    evidenceConfig?: RetrievalEvidenceConfig,
  ) {
    this.relevanceFloor =
      relevanceConfig?.relevanceFloor ?? DEFAULT_RELEVANCE_FLOOR;
    this.rerankConfig = rerankConfig ?? DEFAULT_RERANK_CONFIG;
    this.hybridConfig = hybridConfig ?? DEFAULT_HYBRID_CONFIG;
    this.evidenceConfig = evidenceConfig ?? DEFAULT_EVIDENCE_CONFIG;
  }

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
    const buildFusion = (variants: number): RetrievalTraceFusion => ({
      k: this.hybridConfig.fusionK,
      weights: {
        dense: this.hybridConfig.denseWeight,
        lexical: this.hybridConfig.lexicalWeight,
      },
      depths: {
        dense: denseDepth,
        lexical: this.hybridConfig.enabled ? lexicalDepth : 0,
      },
      variants,
    });

    if (policy.sourceIds && policy.sourceIds.length === 0) {
      return this.emptyOutcome(request, policy, {
        fusion: buildFusion(1),
        rewrite: null,
        abstentionReason: 'no_indexed_chunks',
        skippedReason: 'no_candidates',
        elapsedMs: performance.now() - startedAt,
      });
    }

    const understanding =
      !request.skipQueryUnderstanding && this.queryUnderstanding
        ? await this.queryUnderstanding.understand({
            message: request.query,
            history: request.history,
          })
        : passthroughUnderstanding(request.query);
    const queries = understanding.queries;
    const rewrite = traceRewrite(understanding, request.query);
    const fusion = buildFusion(queries.length);
    const scopeFilter = buildScopeFilter(request);

    const legRuns = await Promise.all(
      queries.map(async (query, variant) => {
        const embedded =
          variant === 0 && understanding.hypotheticalAnswer
            ? understanding.hypotheticalAnswer
            : query;
        const queryEmbedding = await this.embeddingService.embedQuery(embedded);
        const [denseRows, lexicalRows] = await Promise.all([
          this.searchDense(
            request.notebookId,
            queryEmbedding,
            denseDepth,
            policy.sourceIds,
            scopeFilter,
          ),
          this.hybridConfig.enabled
            ? this.searchLexical(
                request.notebookId,
                query,
                queryEmbedding,
                lexicalDepth,
                policy.sourceIds,
                scopeFilter,
              )
            : Promise.resolve<RetrievalChunkRow[]>([]),
        ]);
        return { variant, embedded, denseRows, lexicalRows };
      }),
    );

    const variantWeight = 1 / legRuns.length;
    const legs: {
      kind: RetrievalTraceLeg['kind'];
      variant: number;
      weight: number;
      candidates: RetrievalChunkRow[];
    }[] = [];
    for (const run of legRuns) {
      legs.push({
        kind: 'dense',
        variant: run.variant,
        weight: this.hybridConfig.denseWeight * variantWeight,
        candidates: run.denseRows,
      });
      if (this.hybridConfig.enabled) {
        legs.push({
          kind: 'lexical',
          variant: run.variant,
          weight: this.hybridConfig.lexicalWeight * variantWeight,
          candidates: run.lexicalRows,
        });
      }
    }
    const traceLegs: RetrievalTraceLeg[] = legs.map((leg) => ({
      kind: leg.kind,
      variant: leg.variant,
      candidates: leg.candidates.map((row, index) =>
        traceCandidate(row, index + 1, Number(row.score)),
      ),
    }));

    const fused = reciprocalRankFusion(
      legs,
      (row) => row.chunk_id,
      this.hybridConfig.fusionK,
    );
    const embeddingInputTokens = legRuns.reduce(
      (sum, run) => sum + estimateVoyageTokens(run.embedded),
      0,
    );

    if (fused.length === 0) {
      return this.emptyOutcome(request, policy, {
        legs: traceLegs,
        fusion,
        rewrite,
        rewriteInputTokens: understanding.inputTokens,
        rewriteOutputTokens: understanding.outputTokens,
        abstentionReason: 'no_indexed_chunks',
        skippedReason: 'no_candidates',
        elapsedMs: performance.now() - startedAt,
        embeddingInputTokens,
      });
    }

    const deduped = dedupeNearDuplicates(fused);
    const fusedOrder = deduped.map((candidate, index) =>
      traceCandidate(candidate.candidate, index + 1, candidate.score),
    );

    const rerank = await this.rerankCandidates(queries[0], deduped);
    const threshold = rerank.applied
      ? policy.rerankThreshold
      : policy.relevanceFloor;
    const above: RankedCandidate[] = [];
    const below: RetrievedChunk[] = [];
    for (const candidate of rerank.candidates) {
      if (candidateScore(candidate) >= threshold) above.push(candidate);
      else below.push(chunkFromRow(candidate.row, []));
    }

    const evidenceConfig: RetrievalEvidenceConfig = {
      ...this.evidenceConfig,
      tokenBudget: request.tokenBudget ?? this.evidenceConfig.tokenBudget,
    };
    const assembly = assembleEvidence({
      candidates: above.map(passageFromCandidate),
      topK: policy.topK,
      perSource: policy.sourceIds !== null,
      config: evidenceConfig,
    });
    const candidateByChunkId = new Map(
      above.map((candidate) => [candidate.row.chunk_id, candidate]),
    );
    const rankByChunkId = new Map(
      above.map((candidate, index) => [candidate.row.chunk_id, index + 1]),
    );
    const selected = assembly.items.map((item) => ({
      candidate: candidateByChunkId.get(item.passage.chunkId)!,
      sectionExpanded: item.sectionExpanded,
    }));
    const chunks = selected.map(({ candidate, sectionExpanded }) =>
      chunkFromRow(
        candidate.row,
        sectionExpanded ? (candidate.row.heading_path ?? []) : [],
      ),
    );
    const chosen = selected.map(({ candidate }, index) =>
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
        rewrite,
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
        evidence: traceEvidence(
          assembly,
          evidenceConfig,
          candidateByChunkId,
          rankByChunkId,
        ),
        chosen,
        abstained,
        abstentionReason,
        elapsedMs: performance.now() - startedAt,
        embeddingInputTokens,
        rewriteInputTokens: understanding.inputTokens,
        rewriteOutputTokens: understanding.outputTokens,
      }),
    };
  }

  private emptyOutcome(
    request: RetrievalRequest,
    policy: RetrievalPolicy,
    input: {
      legs?: RetrievalTraceLeg[];
      fusion: RetrievalTraceFusion;
      rewrite: RetrievalTraceRewrite | null;
      rewriteInputTokens?: number;
      rewriteOutputTokens?: number;
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
        rewrite: input.rewrite,
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
        evidence: emptyTraceEvidence(this.evidenceConfig),
        chosen: [],
        abstained: true,
        abstentionReason: input.abstentionReason,
        elapsedMs: input.elapsedMs,
        embeddingInputTokens: input.embeddingInputTokens ?? 0,
        rewriteInputTokens: input.rewriteInputTokens ?? 0,
        rewriteOutputTokens: input.rewriteOutputTokens ?? 0,
      }),
    };
  }

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
    if (fused.length > MAX_RERANK_DOCUMENTS) {
      return fallback('too_many_candidates');
    }

    let response: Awaited<ReturnType<Reranker['rerank']>>;
    try {
      response = await this.reranker.rerank({
        query,
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

  private async searchDense(
    notebookId: string,
    embedding: number[],
    depth: number,
    sourceIds: string[] | null,
    scopeFilter?: SQL | null,
  ): Promise<RetrievalChunkRow[]> {
    const vectorLiteral = `[${embedding.join(',')}]`;
    return this.runLegSearch(
      { notebookId, depth, sourceIds, scopeFilter },
      {
        projection: sql`
          ${chunkColumns()},
          1 - (sc.embedding <=> ${vectorLiteral}::vector) AS score
        `,
        rank: sql`sc.embedding <=> ${vectorLiteral}::vector`,
      },
    );
  }

  private async searchLexical(
    notebookId: string,
    query: string,
    embedding: number[],
    depth: number,
    sourceIds: string[] | null,
    scopeFilter?: SQL | null,
  ): Promise<RetrievalChunkRow[]> {
    const vectorLiteral = `[${embedding.join(',')}]`;
    return this.runLegSearch(
      { notebookId, depth, sourceIds, scopeFilter },
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

  private async runLegSearch(
    search: {
      notebookId: string;
      depth: number;
      sourceIds: string[] | null;
      scopeFilter?: SQL | null;
    },
    leg: {
      cte?: SQL;
      join?: SQL;
      predicate?: SQL;
      projection: SQL;
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
              AND s.deleted_at IS NULL
              ${leg.predicate ?? sql``}
              ${sourceFilter}
              ${search.scopeFilter ?? sql``}
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
          AND s.deleted_at IS NULL
          ${leg.predicate ?? sql``}
          ${search.scopeFilter ?? sql``}
        ORDER BY ${leg.rank}, sc.id
        LIMIT ${search.depth}
      `,
    );
    return result.rows as unknown as RetrievalChunkRow[];
  }
}

function buildScopeFilter(request: RetrievalRequest): SQL | null {
  const filters: SQL[] = [];
  if (request.headingPaths && request.headingPaths.length > 0) {
    filters.push(
      sql`AND sc.heading_path IN (${sql.join(
        request.headingPaths.map((path) => sql`${JSON.stringify(path)}::jsonb`),
        sql`, `,
      )})`,
    );
  }
  if (request.chunkIndexRange) {
    filters.push(
      sql`AND sc.chunk_index >= ${request.chunkIndexRange.minChunkIndex} AND sc.chunk_index <= ${request.chunkIndexRange.maxChunkIndex}`,
    );
  }
  if (request.excludeChunkIds && request.excludeChunkIds.length > 0) {
    filters.push(
      sql`AND sc.id NOT IN (${sql.join(
        request.excludeChunkIds.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    );
  }
  return filters.length > 0 ? sql.join(filters, sql` `) : null;
}

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
    sc.heading_path,
    sc.searchable_text
  `;
}

function buildTrace(input: {
  query: string;
  topK: number;
  sourceIds: string[] | null;
  relevanceFloor: number;
  embeddingModel: string;
  rewrite: RetrievalTraceRewrite | null;
  legs: RetrievalTraceLeg[];
  fusion: RetrievalTraceFusion;
  fusedOrder: RetrievalTraceCandidate[];
  rerank: RetrievalTrace['rerank'];
  evidence: RetrievalTraceEvidence;
  chosen: RetrievalTraceCandidate[];
  abstained: boolean;
  abstentionReason: RetrievalAbstentionReason | null;
  elapsedMs: number;
  embeddingInputTokens: number;
  rewriteInputTokens: number;
  rewriteOutputTokens: number;
}): RetrievalTrace {
  return {
    version: 5,
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
    rewrite: input.rewrite,
    legs: input.legs,
    fusion: input.fusion,
    fusedOrder: input.fusedOrder,
    rerank: input.rerank,
    evidence: input.evidence,
    chosen: input.chosen,
    abstained: input.abstained,
    abstentionReason: input.abstentionReason,
    latencyMs: Math.max(0, Math.round(input.elapsedMs)),
    cost: {
      embeddingInputTokens: input.embeddingInputTokens,
      rerankInputTokens: input.rerank.inputTokens,
      rewriteInputTokens: input.rewriteInputTokens,
      rewriteOutputTokens: input.rewriteOutputTokens,
    },
  };
}

function evidenceKnobs(config: RetrievalEvidenceConfig): {
  overlapThreshold: number;
  maxPerSource: number;
  tokenBudget: number;
  sectionExpansion: boolean;
} {
  return {
    overlapThreshold: config.overlapThreshold,
    maxPerSource: config.maxPerSource,
    tokenBudget: config.tokenBudget,
    sectionExpansion: config.sectionExpansion,
  };
}

function traceEvidence(
  assembly: EvidenceAssembly,
  config: RetrievalEvidenceConfig,
  candidateByChunkId: Map<string, RankedCandidate>,
  rankByChunkId: Map<string, number>,
): RetrievalTraceEvidence {
  const asCandidate = (passage: EvidencePassage): RetrievalTraceCandidate => {
    const candidate = candidateByChunkId.get(passage.chunkId)!;
    return traceCandidate(
      candidate.row,
      rankByChunkId.get(passage.chunkId) ?? 0,
      candidate.fusedScore,
    );
  };

  return {
    ...evidenceKnobs(config),
    tokens: assembly.tokens,
    budgetExhausted: assembly.budgetExhausted,
    items: assembly.items.map((item) => ({
      chunkId: item.passage.chunkId,
      sourceId: item.passage.sourceId,
      chunkIndex: item.passage.chunkIndex,
      tokens: item.tokens,
      sectionExpanded: item.sectionExpanded,
    })),
    droppedOverlap: assembly.droppedOverlap.map(asCandidate),
    droppedDiversity: assembly.droppedDiversity.map(asCandidate),
    droppedBudget: assembly.droppedBudget.map(asCandidate),
  };
}

function emptyTraceEvidence(
  config: RetrievalEvidenceConfig,
): RetrievalTraceEvidence {
  return {
    ...evidenceKnobs(config),
    tokens: 0,
    budgetExhausted: false,
    items: [],
    droppedOverlap: [],
    droppedDiversity: [],
    droppedBudget: [],
  };
}

function passageFromCandidate(candidate: RankedCandidate): EvidencePassage {
  return {
    chunkId: candidate.row.chunk_id,
    sourceId: candidate.row.source_id,
    chunkIndex: candidate.row.chunk_index,
    sectionPath: candidate.row.heading_path ?? [],
    content: candidate.row.content,
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

function chunkFromRow(
  row: RetrievalChunkRow,
  sectionPath: string[],
): RetrievedChunk {
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
    sectionPath,
    score: denseScoreOf(row),
  };
}

function denseScoreOf(row: RetrievalChunkRow): number {
  return Number(row.dense_score ?? row.score);
}

function candidateScore(candidate: RankedCandidate): number {
  return candidate.rerankScore ?? denseScoreOf(candidate.row);
}

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

function dedupeNearDuplicates(
  candidates: FusedCandidate<RetrievalChunkRow>[],
): FusedCandidate<RetrievalChunkRow>[] {
  const kept: {
    candidate: FusedCandidate<RetrievalChunkRow>;
    tokens: Set<string>;
  }[] = [];
  for (const candidate of candidates) {
    const tokens = textSignature(candidate.candidate.content).tokens;
    const duplicate = kept.some(
      (entry) =>
        jaccardSimilarity(entry.tokens, tokens) >= NEAR_DUPLICATE_SIMILARITY,
    );
    if (!duplicate) kept.push({ candidate, tokens });
  }
  return kept.map((entry) => entry.candidate);
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
