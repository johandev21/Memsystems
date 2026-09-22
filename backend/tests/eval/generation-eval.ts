/**
 * The Generation grounding evaluation: seeds the golden corpus, runs the real
 * GenerationGroundingService (and therefore the real retrieval pipeline) for
 * every labeled Generation request, and reports how much of each selected
 * source the grounding represents and whether the generated material can cite
 * the labeled sections.
 *
 * The `raw-slice` mode is the regression configuration: it bypasses the
 * retrieval pipeline and hands the model the first bounded set of chunks per
 * source, which cannot reach the tail of a long source. The gate must fail
 * when that mode loses a labeled section. `single-pass` is the pre-ticket
 * query plan (one brief query per source, no section passes) and is reported
 * for comparison rather than gated: on a corpus this small one bounded set
 * still spreads across the sections, which is why the gate's regression mode
 * is the raw slice.
 */

import { createId } from '@paralleldrive/cuid2';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { sourceChunks } from '../../src/database/schema';
import { chunkContextHeader } from '../../src/modules/ai/chunking.service';
import {
  DEFAULT_FUSION_K,
  RetrievalService,
} from '../../src/modules/ai/retrieval.service';
import { createCitationEvidence } from '../../src/modules/chat/chat-citations';
import {
  GENERATION_EVIDENCE_CHUNKS_PER_SOURCE,
  GenerationGroundingService,
  type GenerationGrounding,
  type GroundedSource,
} from '../../src/modules/study-materials/generation-grounding';
import {
  attachGenerationCitations,
  extractGenerationCitations,
} from '../../src/modules/study-materials/generation-citations';
import { db } from '../db';
import { seedNotebook, seedSource } from '../fixtures';
import { DeterministicEmbedder } from './deterministic-embedder';
import { DeterministicReranker } from './deterministic-reranker';
import {
  GOLDEN_GENERATIONS,
  GOLDEN_GENERATION_SOURCES,
  GOLDEN_SOURCES,
  type GoldenChunk,
  type GoldenGeneration,
  type GoldenSource,
} from './golden-set';

export const EVAL_GENERATION_EMBEDDING_MODEL = 'eval-deterministic-embedder';
export const EVAL_GENERATION_RERANK_MODEL = 'eval-coverage-reranker';
/**
 * Matches the Chat harness: the golden corpus is small, so the legs
 * over-fetch less than production while still letting a broken leg show up.
 */
export const EVAL_GENERATION_CANDIDATE_DEPTH = 8;

export type GenerationGroundingMode =
  'per-section' | 'single-pass' | 'raw-slice';

export interface GenerationEvalOptions {
  /**
   * `per-section` is the shipped grounding. `single-pass` runs the real
   * pipeline with one brief query per source (the pre-ticket behavior);
   * `raw-slice` bypasses the pipeline entirely.
   */
  grounding?: GenerationGroundingMode;
  /** Set false to measure without the reranker. */
  rerank?: boolean;
  /** Set false to measure without the lexical leg. */
  hybrid?: boolean;
}

export interface GenerationEvalRequestResult {
  requestId: string;
  selectedSources: number;
  representedSources: number;
  sourceCoverage: number;
  expectedSections: number;
  coveredSections: number;
  sectionCoverage: number;
  citedSections: number;
  citationAccuracy: number;
  citationAttachment: number;
  evidenceChunks: number;
  /** Seeded ids of the evidence, for diagnosing a failure. */
  evidenceChunkIds: string[];
  traces: number;
}

export interface GenerationEvalMetrics {
  /** Share of selected sources that contributed evidence. */
  sourceCoverage: number;
  /** Share of the labeled sections represented in the evidence. */
  sectionCoverage: number;
  /** Share of the labeled sections the material carries a citation for. */
  citationAccuracy: number;
  /** Share of requests whose material carries at least one citation. */
  citationAttachment: number;
}

export interface GenerationEvalReport {
  grounding: GenerationGroundingMode;
  rerank: boolean;
  hybrid: boolean;
  metrics: GenerationEvalMetrics;
  requests: GenerationEvalRequestResult[];
}

export interface GenerationEvalGateFailure {
  metric: string;
  baseline: number;
  actual: number;
  message: string;
}

const GENERATION_QUALITY_METRICS: (keyof GenerationEvalMetrics)[] = [
  'sourceCoverage',
  'sectionCoverage',
  'citationAccuracy',
  'citationAttachment',
];

export async function evaluateGenerationGrounding(
  options: GenerationEvalOptions = {},
): Promise<GenerationEvalReport> {
  const groundingMode = options.grounding ?? 'per-section';
  const rerankEnabled = options.rerank ?? true;
  const hybridEnabled = options.hybrid ?? true;

  const allSources = [...GOLDEN_SOURCES, ...GOLDEN_GENERATION_SOURCES];
  const corpus = allSources.flatMap((source) =>
    source.chunks.map((chunk) => contextualText(source, chunk)),
  );
  const embedder = new DeterministicEmbedder(corpus);
  const seeded = await seedGoldenCorpus(embedder, allSources);

  const retrieval = new RetrievalService(
    db as never,
    {
      embedQuery: async (text: string) => embedder.embed(text),
      queryEmbeddingModel: () => EVAL_GENERATION_EMBEDDING_MODEL,
    } as never,
    { relevanceFloor: 0 },
    {
      enabled: rerankEnabled,
      model: EVAL_GENERATION_RERANK_MODEL,
      candidateDepth: EVAL_GENERATION_CANDIDATE_DEPTH,
      threshold: 0,
      topK: GENERATION_EVIDENCE_CHUNKS_PER_SOURCE,
    },
    rerankEnabled ? (new DeterministicReranker(corpus) as never) : undefined,
    {
      enabled: hybridEnabled,
      fusionK: DEFAULT_FUSION_K,
      denseWeight: 1,
      lexicalWeight: 1,
      denseCandidateDepth: EVAL_GENERATION_CANDIDATE_DEPTH,
      lexicalCandidateDepth: EVAL_GENERATION_CANDIDATE_DEPTH,
    },
  );
  const groundingService = new GenerationGroundingService(
    db as never,
    retrieval,
  );

  const requests: GenerationEvalRequestResult[] = [];
  for (const request of GOLDEN_GENERATIONS) {
    const selectedSourceIds = request.sourceIds.map((goldenId) => {
      const id = seeded.sourceIdByGoldenId.get(goldenId);
      if (!id) throw new Error(`Golden source id not seeded: ${goldenId}`);
      return id;
    });
    const grounding =
      groundingMode === 'per-section'
        ? await groundingService.ground({
            notebookId: seeded.notebookId,
            kind: request.kind,
            brief: request.brief,
            sourceIds: selectedSourceIds,
          })
        : groundingMode === 'single-pass'
          ? await singlePassGrounding(
              retrieval,
              seeded.notebookId,
              request,
              selectedSourceIds,
              seeded,
            )
          : await rawSliceGrounding(
              seeded.notebookId,
              request,
              selectedSourceIds,
              seeded,
            );
    requests.push(buildRequestResult(request, grounding, seeded));
  }

  return {
    grounding: groundingMode,
    rerank: rerankEnabled,
    hybrid: hybridEnabled,
    metrics: computeMetrics(requests),
    requests,
  };
}

export function evaluateGenerationGate(
  report: GenerationEvalReport,
  baseline: {
    metrics: GenerationEvalMetrics;
    tolerance: { metricRatio: number };
  },
): GenerationEvalGateFailure[] {
  const failures: GenerationEvalGateFailure[] = [];
  for (const metric of GENERATION_QUALITY_METRICS) {
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
  return failures;
}

function contextualText(source: GoldenSource, chunk: GoldenChunk): string {
  return `${chunkContextHeader({
    title: source.title,
    kind: source.kind,
    headingPath: chunk.headingPath ?? [],
  })}${chunk.text}`;
}

interface SeededCorpus {
  notebookId: string;
  sourceIdByGoldenId: Map<string, string>;
  goldenIdBySeededSourceId: Map<string, string>;
  chunkIdByGoldenId: Map<string, string>;
  sourceByGoldenId: Map<string, GoldenSource>;
}

/** Persists the golden corpus the same way the indexing pipeline would. */
async function seedGoldenCorpus(
  embedder: DeterministicEmbedder,
  sources: GoldenSource[],
): Promise<SeededCorpus> {
  const notebook = await seedNotebook({
    title: 'Generation Grounding Evaluation Corpus',
  });
  const runId = createId();
  const sourceIdByGoldenId = new Map<string, string>();
  const goldenIdBySeededSourceId = new Map<string, string>();
  const chunkIdByGoldenId = new Map<string, string>();
  const sourceByGoldenId = new Map<string, GoldenSource>();

  for (const source of sources) {
    const seeded = await seedSource(notebook.id, {
      id: `eval-${runId}-source-${source.id}`,
      kind: source.kind,
      title: source.title,
      rawText: source.chunks.map((chunk) => chunk.text).join('\n\n'),
      processingStatus: source.processingStatus,
      url: source.kind === 'url' ? `https://example.test/${source.id}` : null,
    });
    sourceIdByGoldenId.set(source.id, seeded.id);
    goldenIdBySeededSourceId.set(seeded.id, source.id);
    sourceByGoldenId.set(source.id, source);

    await db.insert(sourceChunks).values(
      source.chunks.map((chunk, index) => {
        const id = `eval-${runId}-chunk-${chunk.id}`;
        chunkIdByGoldenId.set(chunk.id, id);
        const contextHeader = chunkContextHeader({
          title: source.title,
          kind: source.kind,
          headingPath: chunk.headingPath ?? [],
        });
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

  return {
    notebookId: notebook.id,
    sourceIdByGoldenId,
    goldenIdBySeededSourceId,
    chunkIdByGoldenId,
    sourceByGoldenId,
  };
}

/**
 * The pre-ticket grounding: one bounded retrieval per selected source, with
 * no section passes. The tail of a long source is decided by one query's
 * ranking instead of being represented.
 */
async function singlePassGrounding(
  retrieval: RetrievalService,
  notebookId: string,
  request: GoldenGeneration,
  selectedSourceIds: string[],
  seeded: SeededCorpus,
): Promise<GenerationGrounding> {
  const sources: GroundedSource[] = [];
  const traces: GenerationGrounding['traces'] = [];
  for (const sourceId of selectedSourceIds) {
    const outcome = await retrieval.retrieve({
      notebookId,
      query: request.brief.trim() || request.kind.replaceAll('_', ' '),
      sourceIds: [sourceId],
      topK: GENERATION_EVIDENCE_CHUNKS_PER_SOURCE,
      relevanceFloor: 0,
      rerankThreshold: 0,
    });
    traces.push(outcome.trace);
    if (outcome.chunks.length === 0) continue;
    const goldenSource = seeded.sourceByGoldenId.get(
      seeded.goldenIdBySeededSourceId.get(sourceId) ?? '',
    );
    sources.push({
      id: sourceId,
      title: goldenSource?.title ?? sourceId,
      kind: goldenSource?.kind ?? 'text',
      url: null,
      chunks: outcome.chunks,
    });
  }
  return {
    sources,
    evidence: createCitationEvidence(
      sources.flatMap((source) => source.chunks),
    ),
    unavailableSources: [],
    degradedSources: [],
    traces,
  };
}

/**
 * The fully bypassed grounding: no retrieval, just the first bounded set of
 * chunks per selected source in index order.
 */
async function rawSliceGrounding(
  notebookId: string,
  request: GoldenGeneration,
  selectedSourceIds: string[],
  seeded: SeededCorpus,
): Promise<GenerationGrounding> {
  const rows = await db
    .select({
      id: sourceChunks.id,
      sourceId: sourceChunks.sourceId,
      chunkIndex: sourceChunks.chunkIndex,
      content: sourceChunks.content,
      sourceVersionId: sourceChunks.sourceVersionId,
      locator: sourceChunks.locator,
    })
    .from(sourceChunks)
    .where(
      and(
        eq(sourceChunks.notebookId, notebookId),
        inArray(sourceChunks.sourceId, selectedSourceIds),
      ),
    )
    .orderBy(asc(sourceChunks.sourceId), asc(sourceChunks.chunkIndex));

  const bySeededSourceId = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = bySeededSourceId.get(row.sourceId) ?? [];
    list.push(row);
    bySeededSourceId.set(row.sourceId, list);
  }

  const sources: GroundedSource[] = [];
  for (const goldenId of request.sourceIds) {
    const seededId = seeded.sourceIdByGoldenId.get(goldenId);
    if (!seededId) continue;
    const sourceMeta = seeded.sourceByGoldenId.get(goldenId);
    const chunks = (bySeededSourceId.get(seededId) ?? []).slice(
      0,
      GENERATION_EVIDENCE_CHUNKS_PER_SOURCE,
    );
    if (chunks.length === 0) continue;
    sources.push({
      id: seededId,
      title: sourceMeta?.title ?? goldenId,
      kind: sourceMeta?.kind ?? 'text',
      url: null,
      chunks: chunks.map((row) => ({
        chunkId: row.id,
        chunkIndex: row.chunkIndex,
        sourceId: row.sourceId,
        title: sourceMeta?.title ?? goldenId,
        content: row.content,
        score: 0.5,
        url: null,
        kind: sourceMeta?.kind ?? 'text',
        sourceVersionId: row.sourceVersionId ?? null,
        locator: row.locator ?? null,
      })),
    });
  }

  return {
    sources,
    evidence: createCitationEvidence(
      sources.flatMap((source) => source.chunks),
    ),
    unavailableSources: [],
    degradedSources: [],
    traces: [],
  };
}

function buildRequestResult(
  request: GoldenGeneration,
  grounding: GenerationGrounding,
  seeded: SeededCorpus,
): GenerationEvalRequestResult {
  const evidenceChunkIds = new Set(
    grounding.evidence.map((item) => item.chunkId),
  );
  const selectedSeededIds = new Set(
    request.sourceIds.map((goldenId) =>
      seeded.sourceIdByGoldenId.get(goldenId),
    ),
  );
  const represented = grounding.sources.filter((source) =>
    selectedSeededIds.has(source.id),
  ).length;

  // Every seeded chunk id that belongs to each labeled section, in chunk
  // order, across the request's selected sources.
  const chunkIdsBySection = new Map<string, string[]>();
  for (const goldenSourceId of request.sourceIds) {
    const source = seeded.sourceByGoldenId.get(goldenSourceId);
    if (!source)
      throw new Error(`Golden source id not seeded: ${goldenSourceId}`);
    for (const chunk of source.chunks) {
      const section = (chunk.headingPath ?? []).join(' > ');
      const list = chunkIdsBySection.get(section) ?? [];
      const seededChunkId = seeded.chunkIdByGoldenId.get(chunk.id);
      if (seededChunkId) list.push(seededChunkId);
      chunkIdsBySection.set(section, list);
    }
  }

  const coveredSections = request.expectedSections.filter((section) =>
    (chunkIdsBySection.get(section) ?? []).some((chunkId) =>
      evidenceChunkIds.has(chunkId),
    ),
  );

  // The harness plays an ideal grounded answer: it cites the first retrieved
  // chunk of every labeled section through that chunk's evidence key, and an
  // invented key for a section with no evidence. The real extractor and
  // attachment decide what the material ends up carrying.
  const keyByChunkId = new Map(
    grounding.evidence.map((item) => [item.chunkId, item.citationKey]),
  );
  const answer = request.expectedSections
    .map((section, index) => {
      const first = (chunkIdsBySection.get(section) ?? []).find((chunkId) =>
        keyByChunkId.has(chunkId),
      );
      const key = first ? keyByChunkId.get(first) : 'R99';
      return `Claim ${index + 1} [ref:${key}].`;
    })
    .join(' ');
  const content = { title: 'eval-ideal-material', body: answer };
  const citations = attachGenerationCitations(
    content,
    extractGenerationCitations(content, grounding.evidence),
  ).citations;

  const citedSections = new Set<string>();
  for (const citation of citations) {
    if (!citation.chunkId) continue;
    for (const section of request.expectedSections) {
      if ((chunkIdsBySection.get(section) ?? []).includes(citation.chunkId)) {
        citedSections.add(section);
      }
    }
  }

  const expectedCount = request.expectedSections.length;
  return {
    requestId: request.id,
    selectedSources: request.sourceIds.length,
    representedSources: represented,
    sourceCoverage: request.sourceIds.length
      ? represented / request.sourceIds.length
      : 1,
    expectedSections: expectedCount,
    coveredSections: coveredSections.length,
    sectionCoverage: expectedCount ? coveredSections.length / expectedCount : 1,
    citedSections: citedSections.size,
    citationAccuracy: expectedCount ? citedSections.size / expectedCount : 1,
    citationAttachment: citations.length > 0 ? 1 : 0,
    evidenceChunks: grounding.evidence.length,
    evidenceChunkIds: grounding.evidence.map((item) => item.chunkId),
    traces: grounding.traces.length,
  };
}

function computeMetrics(
  requests: GenerationEvalRequestResult[],
): GenerationEvalMetrics {
  return {
    sourceCoverage: mean(requests.map((request) => request.sourceCoverage)),
    sectionCoverage: mean(requests.map((request) => request.sectionCoverage)),
    citationAccuracy: mean(requests.map((request) => request.citationAccuracy)),
    citationAttachment: mean(
      requests.map((request) => request.citationAttachment),
    ),
  };
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
