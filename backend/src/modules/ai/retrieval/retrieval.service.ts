import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../../database/schema';
import { DRIZZLE } from '../../database/database.module';
import { EmbeddingService } from '../indexing/embedding.service';
import {
  DEFAULT_EVIDENCE_CONFIG,
  RETRIEVAL_EVIDENCE_CONFIG,
  assembleEvidence,
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
} from './query-understanding';
import { reciprocalRankFusion, type FusedCandidate } from './rank-fusion';
import { RerankerService, type Reranker } from './reranker.service';
import {
  DEFAULT_HYBRID_CONFIG,
  DEFAULT_RELEVANCE_FLOOR,
  DEFAULT_RERANK_CONFIG,
  RETRIEVAL_HYBRID_CONFIG,
  RETRIEVAL_RELEVANCE_CONFIG,
  RETRIEVAL_RERANK_CONFIG,
} from './retrieval.config';
import type {
  RetrievalHybridConfig,
  RetrievalRelevanceConfig,
  RetrievalRerankConfig,
  RankedCandidate,
  RerankOutcome,
  RetrievalChunkRow,
  RetrievalOutcome,
  RetrievalPolicy,
  RetrievalRequest,
  RetrievedChunk,
} from './retrieval.types';
import { CandidateSearch } from './candidate-search';
import {
  dedupeNearDuplicates,
  mapRerankScores,
} from './retrieval-candidate-utils';
import {
  buildTrace,
  candidateScore,
  chunkFromRow,
  distinctSources,
  emptyTraceEvidence,
  passageFromCandidate,
  traceCandidate,
  traceEvidence,
} from './retrieval-mapping';
import type {
  RetrievalAbstentionReason,
  RetrievalRerankSkippedReason,
  RetrievalTraceFusion,
  RetrievalTraceLeg,
  RetrievalTraceRewrite,
} from './retrieval-trace';

export type { RetrievalAbstentionReason } from './retrieval-trace';
export type {
  CitationLocator,
  RetrievalChunkIndexRange,
  RetrievalHybridConfig,
  RetrievalOutcome,
  RetrievalRelevanceConfig,
  RetrievalRequest,
  RetrievalResult,
  RetrievalRerankConfig,
  RetrievedChunk,
  UnhelpfulSource,
} from './retrieval.types';
export {
  DEFAULT_TOP_K,
  DEFAULT_CANDIDATE_DEPTH,
  DEFAULT_FUSION_K,
  DEFAULT_HYBRID_CONFIG,
  DEFAULT_RELEVANCE_FLOOR,
  DEFAULT_RERANK_CONFIG,
  DEFAULT_RERANK_MODEL,
  DEFAULT_RERANK_THRESHOLD,
  RETRIEVAL_HYBRID_CONFIG,
  RETRIEVAL_RELEVANCE_CONFIG,
  RETRIEVAL_RERANK_CONFIG,
  loadRetrievalHybridConfig,
  loadRetrievalRelevanceConfig,
  loadRetrievalRerankConfig,
} from './retrieval.config';

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);
  private readonly relevanceFloor: number;
  private readonly rerankConfig: RetrievalRerankConfig;
  private readonly hybridConfig: RetrievalHybridConfig;
  private readonly evidenceConfig: RetrievalEvidenceConfig;
  private readonly candidateSearch: CandidateSearch;

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
    this.candidateSearch = new CandidateSearch(this.db);
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
    const scopeFilter = this.candidateSearch.scopeFilter(request);

    const legRuns = await Promise.all(
      queries.map(async (query, variant) => {
        const embedded =
          variant === 0 && understanding.hypotheticalAnswer
            ? understanding.hypotheticalAnswer
            : query;
        const queryEmbedding = await this.embeddingService.embedQuery(embedded);
        const [denseRows, lexicalRows] = await Promise.all([
          this.candidateSearch.dense(
            request.notebookId,
            queryEmbedding,
            denseDepth,
            policy.sourceIds,
            scopeFilter,
          ),
          this.hybridConfig.enabled
            ? this.candidateSearch.lexical(
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
}
