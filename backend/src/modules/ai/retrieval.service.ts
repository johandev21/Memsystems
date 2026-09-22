import { Inject, Injectable, Optional } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { DRIZZLE } from '../database/database.module';
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EmbeddingService,
} from './embedding.service';
import { estimateVoyageTokens } from './providers/voyage.client';
import type {
  RetrievalAbstentionReason,
  RetrievalTrace,
  RetrievalTraceCandidate,
} from './retrieval-trace';

export type { RetrievalAbstentionReason } from './retrieval-trace';

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
  score: number;
  url: string | null;
  kind: string;
  sourceVersionId: string | null;
  locator: CitationLocator | null;
}

export const DEFAULT_TOP_K = 8;

/** The distinct source behind candidates that did not clear the floor. */
export interface UnhelpfulSource {
  id: string;
  title: string;
  kind: string;
  url: string | null;
}

/**
 * The retrieval outcome. A normal result carries the Evidence chunks; an
 * abstention carries no chunks, a reason, and the sources whose candidates
 * failed the floor so the Chat can name them. Every outcome carries the
 * structured trace that callers persist for diagnosis.
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
}

/** Minimum cosine similarity for a chunk to serve as Evidence. */
export interface RetrievalRelevanceConfig {
  relevanceFloor: number;
}

/**
 * Documented default for the relevance floor. Cosine similarity below this
 * value is treated as unrelated material, not as weak Evidence.
 */
export const DEFAULT_RELEVANCE_FLOOR = 0.3;

export const RETRIEVAL_RELEVANCE_CONFIG = 'RETRIEVAL_RELEVANCE_CONFIG';

/** Sources named in a no-evidence reply, capped to keep the reply readable. */
const MAX_UNHELPFUL_SOURCES = 5;

/** Reads the relevance floor from the environment, falling back to the default. */
export function loadRetrievalRelevanceConfig(
  env: NodeJS.ProcessEnv = process.env,
): RetrievalRelevanceConfig {
  if (env.RETRIEVAL_RELEVANCE_FLOOR === undefined) {
    return { relevanceFloor: DEFAULT_RELEVANCE_FLOOR };
  }
  const parsed = Number.parseFloat(env.RETRIEVAL_RELEVANCE_FLOOR);
  if (!Number.isFinite(parsed))
    return { relevanceFloor: DEFAULT_RELEVANCE_FLOOR };
  return { relevanceFloor: Math.min(1, Math.max(0, parsed)) };
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
  score: number;
}

/**
 * The single retrieval pipeline entry point. It composes the retrieval
 * stages (query embedding, search legs, fusion, relevance threshold) and
 * returns both the Evidence and the trace that explains how it was chosen.
 * Chat and Study Material Generation both call this; later retrieval tickets
 * change the stages behind it rather than adding call sites.
 */
@Injectable()
export class RetrievalService {
  private readonly relevanceFloor: number;

  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly embeddingService: EmbeddingService,
    @Optional()
    @Inject(RETRIEVAL_RELEVANCE_CONFIG)
    relevanceConfig?: RetrievalRelevanceConfig,
  ) {
    this.relevanceFloor =
      relevanceConfig?.relevanceFloor ?? DEFAULT_RELEVANCE_FLOOR;
  }

  async retrieve(request: RetrievalRequest): Promise<RetrievalOutcome> {
    const startedAt = performance.now();
    const topK = request.topK ?? DEFAULT_TOP_K;
    const relevanceFloor = request.relevanceFloor ?? this.relevanceFloor;
    const sourceIds = request.sourceIds ? [...request.sourceIds] : null;

    // An explicitly empty selection can never match a chunk.
    if (sourceIds && sourceIds.length === 0) {
      return {
        chunks: [],
        abstained: true,
        abstentionReason: 'no_indexed_chunks',
        unhelpfulSources: [],
        trace: buildTrace({
          query: request.query,
          topK,
          sourceIds,
          relevanceFloor,
          legs: [],
          fusedOrder: [],
          chosen: [],
          abstained: true,
          abstentionReason: 'no_indexed_chunks',
          elapsedMs: performance.now() - startedAt,
          embeddingInputTokens: 0,
        }),
      };
    }

    const queryEmbedding = await this.embeddingService.embedQuery(
      request.query,
    );
    const rows = await this.search(
      request.notebookId,
      queryEmbedding,
      topK,
      sourceIds,
    );

    const ranked: RetrievalTraceCandidate[] = [];
    const chunks: RetrievedChunk[] = [];
    const chosen: RetrievalTraceCandidate[] = [];
    const belowFloor: RetrievedChunk[] = [];
    rows.forEach((row, index) => {
      ranked.push(candidateFromRow(row, index));
      const chunk = chunkFromRow(row);
      if (chunk.score >= relevanceFloor) {
        chunks.push(chunk);
        chosen.push(candidateFromRow(row, chosen.length));
      } else {
        belowFloor.push(chunk);
      }
    });

    const abstained = chunks.length === 0;
    const abstentionReason: RetrievalAbstentionReason | null = abstained
      ? rows.length === 0
        ? 'no_indexed_chunks'
        : 'below_threshold'
      : null;

    return {
      chunks,
      abstained,
      abstentionReason,
      unhelpfulSources: distinctSources(belowFloor),
      trace: buildTrace({
        query: request.query,
        topK,
        sourceIds,
        relevanceFloor,
        legs: [{ kind: 'dense', candidates: ranked }],
        // One dense leg today: fusion is the identity until hybrid retrieval
        // lands behind this seam.
        fusedOrder: ranked,
        chosen,
        abstained,
        abstentionReason,
        elapsedMs: performance.now() - startedAt,
        embeddingInputTokens: estimateVoyageTokens(request.query),
      }),
    };
  }

  private async search(
    notebookId: string,
    embedding: number[],
    topK: number,
    sourceIds: string[] | null,
  ): Promise<RetrievalChunkRow[]> {
    const vectorLiteral = `[${embedding.join(',')}]`;
    const chunkProjection = sql`
      sc.id AS chunk_id,
      sc.chunk_index,
      sc.source_id,
      s.title,
      s.url,
      s.kind,
      sc.source_version_id,
      sc.locator,
      sc.content,
      1 - (sc.embedding <=> ${vectorLiteral}::vector) AS score
    `;

    if (sourceIds) {
      const sourceFilter = sql`AND sc.source_id IN (${sql.join(
        sourceIds.map((id) => sql`${id}`),
        sql`, `,
      )})`;

      const result = await this.db.execute(
        sql`
          SELECT * FROM (
            SELECT
              ${chunkProjection},
              row_number() OVER (
                PARTITION BY sc.source_id
                ORDER BY sc.embedding <=> ${vectorLiteral}::vector, sc.id
              ) AS source_rank
            FROM source_chunks sc
            JOIN sources s ON s.id = sc.source_id
            WHERE sc.notebook_id = ${notebookId}
              AND s.processing_status <> 'degraded'
              ${sourceFilter}
          ) ranked
          WHERE ranked.source_rank <= ${topK}
          ORDER BY ranked.score DESC, ranked.chunk_id
        `,
      );
      return result.rows as unknown as RetrievalChunkRow[];
    }

    const result = await this.db.execute(
      sql`
        SELECT ${chunkProjection}
        FROM source_chunks sc
        JOIN sources s ON s.id = sc.source_id
        WHERE sc.notebook_id = ${notebookId}
          AND s.processing_status <> 'degraded'
        ORDER BY sc.embedding <=> ${vectorLiteral}::vector, sc.id
        LIMIT ${topK}
      `,
    );
    return result.rows as unknown as RetrievalChunkRow[];
  }
}

function buildTrace(input: {
  query: string;
  topK: number;
  sourceIds: string[] | null;
  relevanceFloor: number;
  legs: RetrievalTrace['legs'];
  fusedOrder: RetrievalTraceCandidate[];
  chosen: RetrievalTraceCandidate[];
  abstained: boolean;
  abstentionReason: RetrievalAbstentionReason | null;
  elapsedMs: number;
  embeddingInputTokens: number;
}): RetrievalTrace {
  return {
    version: 1,
    query: input.query,
    topK: input.topK,
    scope: {
      kind: input.sourceIds ? 'selected_sources' : 'notebook',
      sourceIds: input.sourceIds,
    },
    relevanceFloor: input.relevanceFloor,
    embedding: {
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
    },
    legs: input.legs,
    fusedOrder: input.fusedOrder,
    chosen: input.chosen,
    abstained: input.abstained,
    abstentionReason: input.abstentionReason,
    latencyMs: Math.max(0, Math.round(input.elapsedMs)),
    cost: { embeddingInputTokens: input.embeddingInputTokens },
  };
}

function candidateFromRow(
  row: RetrievalChunkRow,
  index: number,
): RetrievalTraceCandidate {
  return {
    chunkId: row.chunk_id,
    sourceId: row.source_id,
    chunkIndex: row.chunk_index,
    score: Number(row.score),
    rank: index + 1,
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
    score: Number(row.score),
  };
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
