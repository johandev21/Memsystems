import { EMBEDDING_DIMENSIONS } from '../indexing/embedding.service';
import type {
  EvidenceAssembly,
  EvidencePassage,
  RetrievalEvidenceConfig,
} from './evidence-assembly';
import type {
  RankedCandidate,
  RetrievedChunk,
  RetrievalChunkRow,
  UnhelpfulSource,
} from './retrieval.types';
import type {
  RetrievalAbstentionReason,
  RetrievalTrace,
  RetrievalTraceCandidate,
  RetrievalTraceEvidence,
  RetrievalTraceFusion,
  RetrievalTraceLeg,
  RetrievalTraceRewrite,
} from './retrieval-trace';

const MAX_UNHELPFUL_SOURCES = 5;

export function buildTrace(input: {
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

export function evidenceKnobs(config: RetrievalEvidenceConfig): {
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

export function traceEvidence(
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

export function emptyTraceEvidence(
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

export function passageFromCandidate(
  candidate: RankedCandidate,
): EvidencePassage {
  return {
    chunkId: candidate.row.chunk_id,
    sourceId: candidate.row.source_id,
    chunkIndex: candidate.row.chunk_index,
    sectionPath: candidate.row.heading_path ?? [],
    content: candidate.row.content,
  };
}

export function traceCandidate(
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

export function chunkFromRow(
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

export function denseScoreOf(row: RetrievalChunkRow): number {
  return Number(row.dense_score ?? row.score);
}

export function candidateScore(candidate: RankedCandidate): number {
  return candidate.rerankScore ?? denseScoreOf(candidate.row);
}

export function distinctSources(chunks: RetrievedChunk[]): UnhelpfulSource[] {
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
