/**
 * The retrieval evaluation runner: seeds the golden corpus into the test
 * database, runs every labeled query through the real retrieval pipeline, and
 * reports the retrieval-quality metrics the continuous integration gate
 * compares against `baseline.json`.
 *
 * Run it locally with:
 *
 *   pnpm --filter backend exec vitest run tests/retrieval-eval.test.ts
 *
 * Refresh the baseline after an intentional retrieval change with:
 *
 *   RETRIEVAL_EVAL_UPDATE=1 pnpm --filter backend exec vitest run tests/retrieval-eval.test.ts
 */

import { createId } from '@paralleldrive/cuid2';
import { sourceChunks } from '../../src/database/schema';
import { chunkContextHeader } from '../../src/modules/ai/chunking.service';
import {
  DEFAULT_FUSION_K,
  RetrievalService,
} from '../../src/modules/ai/retrieval.service';
import type { Reranker } from '../../src/modules/ai/reranker.service';
import {
  createCitationEvidence,
  extractCitationEntries,
} from '../../src/modules/chat/chat-citations';
import { db } from '../db';
import { seedNotebook, seedSource } from '../fixtures';
import {
  DeterministicEmbedder,
  type EvalEmbedder,
} from './deterministic-embedder';
import { DeterministicReranker } from './deterministic-reranker';
import {
  GOLDEN_QUERIES,
  GOLDEN_SOURCES,
  type GoldenChunk,
  type GoldenQuery,
  type GoldenSource,
} from './golden-set';

/**
 * Evidence depth and relevance floor used by the harness. The floor is
 * calibrated for the deterministic lexical embedder, whose score scale is
 * compressed compared with Voyage, so it exercises the same threshold stage
 * as the production default without pretending the scales are equal.
 */
export const EVAL_TOP_K = 4;
export const EVAL_RELEVANCE_FLOOR = 0.25;

/**
 * The reranker stand-in is a coverage model, so its scores are calibrated
 * for the harness: 0.5 drops glossary entries that share one distinctive
 * term with the query while keeping passages that answer it. The candidate
 * depth is deliberately smaller than production: the golden corpus is small,
 * and over-fetching all of it would let the reranker mask a broken dense leg.
 */
export const EVAL_CANDIDATE_DEPTH = 8;
export const EVAL_RERANK_MODEL = 'eval-coverage-reranker';
export const EVAL_RERANK_THRESHOLD = 0.5;

/**
 * The model name recorded in the retrieval trace for the deterministic
 * embedder. The harness never calls Voyage; the name says so.
 */
export const EVAL_EMBEDDING_MODEL = 'eval-deterministic-embedder';

/**
 * The hybrid leg's over-fetch depth. It matches the dense depth so neither
 * leg can mask the other: disabling the lexical leg must show up in recall
 * even while reranking is on.
 */
export const EVAL_LEXICAL_CANDIDATE_DEPTH = 8;

export interface RetrievalEvalOptions {
  topK?: number;
  relevanceFloor?: number;
  /** Override to inject a deliberately regressed embedder. */
  embedder?: EvalEmbedder;
  /** Set false to measure the pipeline without reranking. */
  rerank?: boolean;
  /** Override to inject a deliberately regressed reranker. */
  reranker?: Reranker;
  /** Set false to measure the pipeline with the lexical leg disabled. */
  hybrid?: boolean;
  /**
   * Set false to seed the corpus without the document and section context
   * header (the pre-contextual representation). The gate uses it to prove
   * the contextual representation is what makes section-dependent passages
   * retrievable.
   */
  contextualize?: boolean;
}

export interface RetrievalEvalQueryResult {
  queryId: string;
  query: string;
  answerable: boolean;
  abstained: boolean;
  relevantChunkIds: string[];
  retrievedChunkIds: string[];
  firstRelevantRank: number | null;
  recall: number;
  ndcg: number;
  contextPrecision: number | null;
  citationAccuracy: number | null;
  faithfulness: number | null;
  refusalCorrect: boolean;
  latencyMs: number;
  embeddingInputTokens: number;
  rerankInputTokens: number;
}

export interface RetrievalEvalMetrics {
  recallAtK: number;
  mrr: number;
  ndcgAtK: number;
  contextPrecision: number;
  citationAccuracy: number;
  refusalAccuracy: number;
  faithfulness: number;
  latencyMsP50: number;
  latencyMsP95: number;
  costTokensPerQuery: number;
}

export interface RetrievalEvalReport {
  topK: number;
  relevanceFloor: number;
  contextualize: boolean;
  rerank: {
    enabled: boolean;
    model: string;
    candidateDepth: number;
    threshold: number;
  };
  hybrid: {
    enabled: boolean;
    fusionK: number;
    denseWeight: number;
    lexicalWeight: number;
    denseCandidateDepth: number;
    lexicalCandidateDepth: number;
  };
  metrics: RetrievalEvalMetrics;
  queries: RetrievalEvalQueryResult[];
}

export interface RetrievalEvalBaseline {
  version: 1;
  tolerance: {
    /** Relative drop a higher-is-better metric may suffer. */
    metricRatio: number;
    /** Absolute p95 latency ceiling in milliseconds. */
    latencyMsP95Ceiling: number;
    /** Relative increase the query-embedding token cost may suffer. */
    costTokensRatio: number;
  };
  metrics: RetrievalEvalMetrics;
}

export interface RetrievalEvalGateFailure {
  metric: string;
  baseline: number;
  actual: number;
  message: string;
}

const QUALITY_METRICS: (keyof RetrievalEvalMetrics)[] = [
  'recallAtK',
  'mrr',
  'ndcgAtK',
  'contextPrecision',
  'citationAccuracy',
  'refusalAccuracy',
  'faithfulness',
];

export async function evaluateRetrieval(
  options: RetrievalEvalOptions = {},
): Promise<RetrievalEvalReport> {
  const topK = options.topK ?? EVAL_TOP_K;
  const relevanceFloor = options.relevanceFloor ?? EVAL_RELEVANCE_FLOOR;
  const rerankEnabled = options.rerank ?? true;
  const hybridEnabled = options.hybrid ?? true;
  const contextualize = options.contextualize ?? true;
  // The IDF vocabulary is built from the contextual representation even when
  // the run disables it: the section tokens exist in the corpus, the chunk
  // representation just does not carry them. That is what makes the gate
  // catch a run that loses the context.
  const corpus = GOLDEN_SOURCES.flatMap((source) =>
    source.chunks.map((chunk) => contextualText(source, chunk)),
  );
  const embedder = options.embedder ?? new DeterministicEmbedder(corpus);
  const reranker =
    options.reranker ??
    (rerankEnabled ? new DeterministicReranker(corpus) : null);

  const { notebookId, chunkIdByGoldenId } = await seedGoldenCorpus(
    embedder,
    contextualize,
  );
  const service = new RetrievalService(
    db as never,
    {
      embedQuery: async (text: string) => embedder.embed(text),
      queryEmbeddingModel: () => EVAL_EMBEDDING_MODEL,
    } as never,
    { relevanceFloor },
    {
      enabled: rerankEnabled,
      model: EVAL_RERANK_MODEL,
      candidateDepth: EVAL_CANDIDATE_DEPTH,
      threshold: EVAL_RERANK_THRESHOLD,
      topK,
    },
    reranker as never,
    {
      enabled: hybridEnabled,
      fusionK: DEFAULT_FUSION_K,
      denseWeight: 1,
      lexicalWeight: 1,
      denseCandidateDepth: EVAL_CANDIDATE_DEPTH,
      lexicalCandidateDepth: EVAL_LEXICAL_CANDIDATE_DEPTH,
    },
  );

  const queries: RetrievalEvalQueryResult[] = [];
  for (const query of GOLDEN_QUERIES) {
    const outcome = await service.retrieve({
      notebookId,
      query: query.text,
      topK,
      relevanceFloor,
    });
    queries.push(buildQueryResult(query, outcome, chunkIdByGoldenId, topK));
  }

  return {
    topK,
    relevanceFloor,
    contextualize,
    rerank: {
      enabled: rerankEnabled,
      model: EVAL_RERANK_MODEL,
      candidateDepth: EVAL_CANDIDATE_DEPTH,
      threshold: EVAL_RERANK_THRESHOLD,
    },
    hybrid: {
      enabled: hybridEnabled,
      fusionK: DEFAULT_FUSION_K,
      denseWeight: 1,
      lexicalWeight: 1,
      denseCandidateDepth: EVAL_CANDIDATE_DEPTH,
      lexicalCandidateDepth: EVAL_LEXICAL_CANDIDATE_DEPTH,
    },
    metrics: computeMetrics(queries),
    queries,
  };
}

/** The document plus section context a golden chunk is represented with. */
function contextualText(source: GoldenSource, chunk: GoldenChunk): string {
  return `${chunkContextHeader({
    title: source.title,
    kind: source.kind,
    headingPath: chunk.headingPath ?? [],
  })}${chunk.text}`;
}

/**
 * Persists the golden corpus and returns the golden-id to chunk-id map. With
 * `contextualize` false the chunks are seeded with the pre-contextual
 * representation: the searchable text and the embedding are the bare body,
 * with no document or section header.
 */
async function seedGoldenCorpus(
  embedder: EvalEmbedder,
  contextualize: boolean,
): Promise<{
  notebookId: string;
  chunkIdByGoldenId: Map<string, string>;
}> {
  const notebook = await seedNotebook({
    title: 'Retrieval Evaluation Corpus',
  });
  const chunkIdByGoldenId = new Map<string, string>();
  // Unique per run: the harness may seed the corpus more than once in a test.
  const runId = createId();

  for (const source of GOLDEN_SOURCES) {
    const seeded = await seedSource(notebook.id, {
      id: `eval-${runId}-source-${source.id}`,
      kind: source.kind,
      title: source.title,
      rawText: source.chunks.map((chunk) => chunk.text).join('\n\n'),
      processingStatus: source.processingStatus,
      url: source.kind === 'url' ? `https://example.test/${source.id}` : null,
    });

    await db.insert(sourceChunks).values(
      source.chunks.map((chunk, index) => {
        const id = `eval-${runId}-chunk-${chunk.id}`;
        chunkIdByGoldenId.set(chunk.id, id);
        const contextHeader = contextualize
          ? chunkContextHeader({
              title: source.title,
              kind: source.kind,
              headingPath: chunk.headingPath ?? [],
            })
          : '';
        const searchableText = `${contextHeader}${chunk.text}`;
        return {
          id,
          sourceId: seeded.id,
          notebookId: notebook.id,
          chunkIndex: index,
          content: chunk.text,
          searchableText,
          contextHeader,
          headingPath: chunk.headingPath ?? [],
          sourceKind: source.kind,
          embedding: embedder.embed(searchableText),
        };
      }),
    );
  }

  return { notebookId: notebook.id, chunkIdByGoldenId };
}

function buildQueryResult(
  query: GoldenQuery,
  outcome: Awaited<ReturnType<RetrievalService['retrieve']>>,
  chunkIdByGoldenId: Map<string, string>,
  topK: number,
): RetrievalEvalQueryResult {
  const relevantChunkIds = query.relevantChunkIds.map((goldenId) => {
    const id = chunkIdByGoldenId.get(goldenId);
    if (!id) throw new Error(`Golden chunk id not seeded: ${goldenId}`);
    return id;
  });
  const retrievedChunkIds = outcome.chunks.map((chunk) => chunk.chunkId);
  const relevant = new Set(relevantChunkIds);
  const relevantRetrieved = retrievedChunkIds.filter((id) => relevant.has(id));
  const firstRelevantIndex = retrievedChunkIds.findIndex((id) =>
    relevant.has(id),
  );

  // Citation accuracy: the harness plays an ideal answer that cites the
  // labeled relevant chunks through their Evidence keys, plus an invented key
  // that must never resolve. Accuracy is the share of expected citations the
  // real extractor resolves to a labeled chunk, so a broken key-to-chunk map
  // or a missed relevant chunk both lower it.
  const evidence = createCitationEvidence(outcome.chunks);
  const evidenceKeyByChunkId = new Map(
    evidence.map((item) => [item.chunkId, item.citationKey]),
  );
  const expectedKeys = relevantChunkIds
    .map((id) => evidenceKeyByChunkId.get(id))
    .filter((key): key is string => Boolean(key));
  const answer = [
    ...expectedKeys.map((key) => `A grounded claim [ref:${key}].`),
    'An invented claim [ref:R99].',
  ].join(' ');
  const citations = extractCitationEntries(answer, evidence);
  const resolvedRelevant = citations.filter(
    (entry) => entry.chunkId && relevant.has(entry.chunkId),
  ).length;

  return {
    queryId: query.id,
    query: query.text,
    answerable: query.answerable,
    abstained: outcome.abstained,
    relevantChunkIds,
    retrievedChunkIds,
    firstRelevantRank: firstRelevantIndex >= 0 ? firstRelevantIndex + 1 : null,
    recall:
      relevantChunkIds.length > 0
        ? relevantRetrieved.length / relevantChunkIds.length
        : 0,
    ndcg: ndcgAtK(retrievedChunkIds, relevant, topK),
    contextPrecision:
      retrievedChunkIds.length > 0
        ? relevantRetrieved.length / retrievedChunkIds.length
        : null,
    citationAccuracy:
      relevantChunkIds.length > 0
        ? resolvedRelevant / relevantChunkIds.length
        : null,
    faithfulness: outcome.abstained
      ? null
      : retrievedChunkIds.length > 0 && relevant.has(retrievedChunkIds[0])
        ? 1
        : 0,
    refusalCorrect: query.answerable ? !outcome.abstained : outcome.abstained,
    latencyMs: outcome.trace.latencyMs,
    embeddingInputTokens: outcome.trace.cost.embeddingInputTokens,
    rerankInputTokens: outcome.trace.cost.rerankInputTokens,
  };
}

function computeMetrics(
  queries: RetrievalEvalQueryResult[],
): RetrievalEvalMetrics {
  const answerable = queries.filter((query) => query.answerable);
  const withRetrieved = queries.filter(
    (query) => query.retrievedChunkIds.length > 0,
  );
  const answered = queries.filter((query) => query.faithfulness !== null);
  const withExpectedCitations = queries.filter(
    (query) => query.citationAccuracy !== null,
  );
  const latencies = queries.map((query) => query.latencyMs);

  return {
    recallAtK: mean(answerable.map((query) => query.recall)),
    mrr: mean(
      answerable.map((query) =>
        query.firstRelevantRank ? 1 / query.firstRelevantRank : 0,
      ),
    ),
    ndcgAtK: mean(answerable.map((query) => query.ndcg)),
    contextPrecision: mean(
      withRetrieved.map((query) => query.contextPrecision ?? 0),
    ),
    citationAccuracy: mean(
      withExpectedCitations.map((query) => query.citationAccuracy ?? 0),
    ),
    refusalAccuracy: mean(
      queries.map((query) => (query.refusalCorrect ? 1 : 0)),
    ),
    faithfulness: mean(answered.map((query) => query.faithfulness ?? 0)),
    latencyMsP50: percentile(latencies, 50),
    latencyMsP95: percentile(latencies, 95),
    costTokensPerQuery: mean(
      queries.map(
        (query) => query.embeddingInputTokens + query.rerankInputTokens,
      ),
    ),
  };
}

export function evaluateRetrievalGate(
  report: RetrievalEvalReport,
  baseline: RetrievalEvalBaseline,
): RetrievalEvalGateFailure[] {
  const failures: RetrievalEvalGateFailure[] = [];

  for (const metric of QUALITY_METRICS) {
    const expected = baseline.metrics[metric];
    const actual = report.metrics[metric];
    const floor =
      expected - Math.abs(expected) * baseline.tolerance.metricRatio;
    if (actual < floor) {
      failures.push({
        metric,
        baseline: expected,
        actual,
        message: `${metric} dropped to ${actual.toFixed(4)}, below the ${floor.toFixed(4)} floor (baseline ${expected.toFixed(4)}, tolerance ${baseline.tolerance.metricRatio * 100}%).`,
      });
    }
  }

  if (report.metrics.latencyMsP95 > baseline.tolerance.latencyMsP95Ceiling) {
    failures.push({
      metric: 'latencyMsP95',
      baseline: baseline.tolerance.latencyMsP95Ceiling,
      actual: report.metrics.latencyMsP95,
      message: `retrieval p95 latency ${report.metrics.latencyMsP95}ms exceeds the ${baseline.tolerance.latencyMsP95Ceiling}ms ceiling.`,
    });
  }

  const costCeiling =
    baseline.metrics.costTokensPerQuery *
    (1 + baseline.tolerance.costTokensRatio);
  if (report.metrics.costTokensPerQuery > costCeiling) {
    failures.push({
      metric: 'costTokensPerQuery',
      baseline: baseline.metrics.costTokensPerQuery,
      actual: report.metrics.costTokensPerQuery,
      message: `average query embedding cost ${report.metrics.costTokensPerQuery.toFixed(1)} tokens exceeds the ${costCeiling.toFixed(1)} token ceiling.`,
    });
  }

  return failures;
}

/** Binary-relevance nDCG at k over the retrieved chunk order. */
function ndcgAtK(
  retrievedChunkIds: string[],
  relevant: Set<string>,
  k: number,
): number {
  const relevantCount = relevant.size;
  if (relevantCount === 0) return 0;
  const dcg = retrievedChunkIds
    .slice(0, k)
    .reduce(
      (sum, id, index) =>
        sum + (relevant.has(id) ? 1 / Math.log2(index + 2) : 0),
      0,
    );
  const idealCount = Math.min(relevantCount, k);
  let idcg = 0;
  for (let index = 0; index < idealCount; index++) {
    idcg += 1 / Math.log2(index + 2);
  }
  return idcg > 0 ? dcg / idcg : 0;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1),
  );
  return sorted[index];
}
